/**
 * 스킬 전용 도구와 스킬 연결(SKILL.md 머리말 `metadata.include_tools`) 편집과 판정.
 *
 * deepagents 공식 구조를 따른다 — 숨길 도구는 테넌트 관리자가 도구 쪽에서 "스킬 전용"으로
 * 지정하고, 스킬의 include_tools 는 그 도구를 열어 줄 스킬만 정한다. 스킬 전용 도구는 그 도구를
 * 적은 스킬을 읽은 뒤에만 보이고, 스킬 전용이 아닌 도구는 include_tools 에 적혀도 처음부터 보인다.
 * 이 모듈은 화면 없이 테스트할 수 있는 부분만 담는다 — 머리말의 include_tools 한 줄만 읽고 쓰기
 * (다른 필드·본문·줄바꿈 보존), 도구 상태와 확인 필요 항목, 추가·빼기·저장 순서 판정, 영향 계산,
 * 설명 보완 판정, 화면 문구.
 */

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function splitFrontmatter(content) {
    const text = content || '';
    const m = text.match(FRONTMATTER_RE);
    if (!m) return null;
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const start = text.indexOf('\n') + 1; // 여는 --- 다음
    const body = m[1];
    return { text, eol, head: text.slice(0, start), lines: body.split(/\r?\n/), tail: text.slice(start + body.length) };
}

function joinFrontmatter(parts, lines) {
    return parts.head + lines.join(parts.eol) + parts.tail;
}

function indentOf(line) {
    return (line.match(/^[ \t]*/) || [''])[0].length;
}

/** `metadata:` 블록 범위 [시작 줄, 끝 줄) 와 자식 들여쓰기. 없으면 null. */
function findMetadataBlock(lines) {
    const start = lines.findIndex((l) => /^metadata:\s*$/.test(l));
    if (start < 0) return null;
    let end = start + 1;
    while (end < lines.length && (lines[end].trim() === '' || indentOf(lines[end]) > 0)) end += 1;
    // 블록 끝의 빈 줄은 블록 밖으로 둔다
    while (end > start + 1 && lines[end - 1].trim() === '') end -= 1;
    const child = lines.slice(start + 1, end).find((l) => l.trim() !== '');
    return { start, end, indent: child ? ' '.repeat(indentOf(child)) : '  ' };
}

function unquote(value) {
    const v = value.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
    return v;
}

/** SKILL.md 머리말의 include_tools 이름 목록(공백 구분). 없거나 형식이 다르면 빈 목록. */
export function readIncludeTools(content) {
    const parts = splitFrontmatter(content);
    if (!parts) return [];
    const block = findMetadataBlock(parts.lines);
    if (!block) return [];
    for (let i = block.start + 1; i < block.end; i += 1) {
        const m = parts.lines[i].match(/^[ \t]+include_tools:\s*(.*)$/);
        if (m) return unquote(m[1].replace(/\s+#.*$/, '')).split(/\s+/).filter(Boolean);
    }
    return [];
}

/**
 * include_tools 를 names 로 바꾼 SKILL.md 를 돌려준다. 그 한 줄(필요하면 `metadata:`)만 고친다.
 * 머리말이 없으면 원문을 그대로 돌려준다(화면이 머리말을 먼저 만들게 안내).
 */
export function writeIncludeTools(content, names) {
    const parts = splitFrontmatter(content);
    if (!parts) return content;
    const unique = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))];
    const lines = [...parts.lines];
    const block = findMetadataBlock(lines);
    const value = unique.join(' ');

    if (!block) {
        if (!unique.length) return content;
        lines.push('metadata:', `  include_tools: ${value}`);
        return joinFrontmatter(parts, lines);
    }
    const idx = lines.findIndex((l, i) => i > block.start && i < block.end && /^[ \t]+include_tools:/.test(l));
    if (idx >= 0) {
        if (unique.length) {
            lines[idx] = `${lines[idx].match(/^[ \t]+/)[0]}include_tools: ${value}`;
        } else {
            lines.splice(idx, 1);
            const rest = lines.slice(block.start + 1, block.end - 1).filter((l) => l.trim() !== '');
            if (!rest.length) lines.splice(block.start, block.end - 1 - block.start);
        }
    } else if (unique.length) {
        lines.splice(block.start + 1, 0, `${block.indent}include_tools: ${value}`);
    }
    return joinFrontmatter(parts, lines);
}

/** 머리말 description(한 줄 또는 `>`/`|` 블록). */
export function readDescription(content) {
    const parts = splitFrontmatter(content);
    if (!parts) return '';
    const i = parts.lines.findIndex((l) => /^description:/.test(l));
    if (i < 0) return '';
    const first = parts.lines[i].replace(/^description:\s*/, '');
    if (first && !/^[>|][-+]?\s*$/.test(first)) return unquote(first);
    const out = [];
    for (let j = i + 1; j < parts.lines.length && (parts.lines[j].trim() === '' || indentOf(parts.lines[j]) > 0); j += 1) {
        out.push(parts.lines[j].trim());
    }
    return out.join(' ').trim();
}

/**
 * 고른 도구들의 영향. bindings 는 GET /skill-tools/bindings 의 bindings.
 * @returns {{tools: Array, totalTokens: number}}
 */
export function bindingImpact(selected, catalogTools, bindings, skillName) {
    const byName = new Map((catalogTools || []).map((t) => [t.name, t]));
    const tools = (selected || []).map((name) => {
        const tool = byName.get(name);
        const binding = (bindings || {})[name] || {};
        return {
            name,
            known: Boolean(tool),
            tokens: tool ? tool.schema_tokens || 0 : 0,
            otherSkills: (binding.skills || []).filter((s) => s !== skillName),
            directAssignments: binding.direct_assignments || [],
        };
    });
    return { tools, totalTokens: tools.reduce((sum, t) => sum + t.tokens, 0) };
}

const SYNONYMS = {
    email: ['메일', '이메일', 'mail'],
    mail: ['메일', '이메일', 'email'],
    send: ['발송', '보내', '전송'],
    process: ['프로세스'],
    execute: ['실행'],
    order: ['주문'],
    document: ['문서'],
    search: ['검색'],
    table: ['테이블'],
    file: ['파일'],
    calendar: ['일정', '캘린더'],
    slack: ['슬랙'],
};
const STOP = new Set(['get', 'set', 'list', 'tool', 'tools', 'the', 'and', 'for', 'via', 'with', 'from', 'into', 'this', 'that', 'use']);

function keywordsOf(tool) {
    const words = new Set();
    const add = (w) => {
        const k = w.toLowerCase();
        if (k.length >= 3 && !STOP.has(k)) words.add(k);
    };
    String(tool.name || '').split(/[_\-\s]+/).forEach(add);
    String(tool.description || '').split(/[^A-Za-z]+/).slice(0, 12).forEach(add);
    return words;
}

/**
 * 스킬 description 에 묶은 도구로 할 수 있는 일이 드러나지 않는 도구 이름들.
 * MCP 도구는 서버 단위로 본다 — 설명에 서버 이름이나 그 서버의 묶은 도구 중 하나의 핵심어가 있으면
 * 그 서버 도구 전부를 설명된 것으로 본다(도구마다 따지면 같은 서버 도구 수십 개가 모두 걸린다).
 * 단순 문자열 판정이라 오탐이 있을 수 있으므로 화면은 안내만 한다.
 */
export function descriptionHints(description, selected, catalogTools) {
    const text = String(description || '').toLowerCase();
    const byName = new Map((catalogTools || []).map((t) => [t.name, t]));
    const mentions = (tool) => {
        for (const word of keywordsOf(tool)) {
            if (text.includes(word)) return true;
            if ((SYNONYMS[word] || []).some((s) => text.includes(s.toLowerCase()))) return true;
        }
        return false;
    };
    const groups = new Map();
    for (const name of selected || []) {
        const tool = byName.get(name);
        if (!tool) continue;
        const key = tool.server ? `mcp:${tool.server}` : `tool:${name}`;
        if (!groups.has(key)) groups.set(key, { server: tool.server, tools: [] });
        groups.get(key).tools.push(tool);
    }
    const missing = [];
    for (const group of groups.values()) {
        const serverNamed = group.server && text.includes(String(group.server).toLowerCase().split(/[-_]/)[0]);
        if (serverNamed || group.tools.some(mentions)) continue;
        missing.push(...group.tools.map((t) => t.name));
    }
    return missing;
}

// ---------------------------------------------------------------------------
// 상태와 판정 — 화면은 이 결과만 그린다(openspec skill-tool-binding-ui).
// 입력은 카탈로그(GET /skill-tools/catalog 의 tools), 연결 현황(GET /skill-tools/bindings 의
// bindings), 스킬 전용 지정 목록(GET /skill-tools/skill-only 의 tools 또는 화면이 바꾼 값)이다.
// ---------------------------------------------------------------------------

/** 화면 문구. 내부 용어(include_tools·바인딩·여는 스킬)를 쓰지 않는다 — 테스트가 지킨다. */
export const COPY = {
    always: '모든 대화에서 사용',
    afterSkill: '스킬을 읽은 뒤 사용',
    unusable: '사용 불가 · 연결된 스킬 없음',
    notInTenant: '이 테넌트에 없는 도구',
    panelTitle: '이 스킬을 읽어야 쓰는 도구',
    panelHelp: '여기 있는 도구는 에이전트가 이 스킬의 지침을 읽은 뒤에만 쓸 수 있습니다. 지침을 건너뛰고 바로 쓰는 일을 막습니다.',
    connectedButAlways: '스킬 전용으로 지정해야 이 스킬을 읽은 뒤에만 쓰게 됩니다',
    adminOnly: '관리자만 스킬 전용으로 지정할 수 있습니다',
    designateConfirm: (tool, skills) =>
        skills.length
            ? `${tool} 은 저장하면 모든 대화에서 숨겨지고, ${skills.join(', ')} 을 읽은 뒤에만 쓸 수 있습니다.`
            : `${tool} 은 지정하면 연결된 스킬이 없어 어떤 대화에서도 쓸 수 없게 됩니다.`,
    directUse: (n) => `이 도구의 서버를 직접 쓰는 업무 ${n}곳도 스킬을 읽어야 쓸 수 있습니다.`,
    releaseConfirm: (tool, skills) =>
        skills.length
            ? `${tool} 이 모든 대화에서 다시 보입니다. ${skills.join(', ')} 의 지침을 읽지 않고도 쓸 수 있게 됩니다.`
            : `${tool} 이 모든 대화에서 다시 보입니다.`,
    // 관리자 현황(바로 저장): 연결 스킬이 같은 도구를 한 문장으로
    designateGroup: (tools, skills) =>
        skills.length
            ? `지정하면 ${tools.join(', ')} 이 모든 대화에서 숨겨지고, ${skills.join(', ')} 을 읽은 뒤에만 쓸 수 있습니다.`
            : `지정하면 ${tools.join(', ')} 은 연결된 스킬이 없어 어떤 대화에서도 쓸 수 없게 됩니다.`,
    releaseGroup: (tools, skills) =>
        skills.length
            ? `해제하면 ${tools.join(', ')} 이 모든 대화에서 다시 보입니다. ${skills.join(', ')} 의 지침을 읽지 않고도 쓸 수 있게 됩니다.`
            : `해제하면 ${tools.join(', ')} 이 모든 대화에서 다시 보입니다.`,
    lastConnection: (tool) => `이 스킬을 빼면 ${tool} 을 쓸 수 있는 스킬이 없어집니다.`,
    deferForMerge: '저장소에 연결된 스킬이라 병합된 뒤에 반영됩니다. 병합되면 관리자 현황의 \'확인 필요\'에서 지정할 수 있습니다.',
    deferReleaseForMerge: '병합되면 관리자 현황의 \'확인 필요\'에서 지정을 해제할 수 있습니다.',
    designateFailed: '연결은 저장됐지만 스킬 전용 지정은 되지 않았습니다. 관리자 현황에서 다시 지정해 주세요.',
    adminHelp: '스킬 전용으로 지정한 도구는 모든 대화에서 숨겨지고, 그 도구를 연결한 스킬을 에이전트가 읽은 뒤에만 쓸 수 있습니다. 스킬에 연결하는 일은 스킬 편집 화면의 도구 버튼에서 합니다.',
    undesignatedGroup: (skill, n) => `${skill} 에 연결된 도구 ${n}개가 모든 대화에서 보입니다`,
    otherSkills: (tool, skills) => `${tool} 을 연결한 다른 스킬(${skills.join(', ')})도 지정 뒤에는 그 스킬을 읽어야 쓸 수 있습니다.`,
    nowAfterSkill: '은(는) 이제 모든 대화에서 숨겨지고, 이 스킬을 읽은 뒤에만 쓸 수 있습니다.',
    nowAlways: '은(는) 이제 모든 대화에서 다시 보입니다.',
    forbidden: '관리자만 바꿀 수 있습니다'
};

const asSet = (v) => (v instanceof Set ? v : new Set(v || []));

/**
 * 도구 하나의 상태. kind: always(모든 대화) · after-skill(스킬을 읽은 뒤) · unusable(연결 스킬 없음).
 * @returns {{kind: string, label: string, skills: string[]}}
 */
export function toolStatus(name, skillOnly, bindings) {
    const skills = ((bindings || {})[name] || {}).skills || [];
    if (!asSet(skillOnly).has(name)) return { kind: 'always', label: COPY.always, skills };
    if (!skills.length) return { kind: 'unusable', label: COPY.unusable, skills };
    return { kind: 'after-skill', label: `${COPY.afterSkill} · ${skills.join(', ')}`, skills };
}

/**
 * 관리자 현황의 "확인 필요" 항목.
 * - unusable: 스킬 전용인데 연결 스킬이 없는 도구(카탈로그에 있는 것만)
 * - undesignated: 스킬에 연결됐지만 지정 안 된 도구를 스킬 단위로 묶은 것
 * @returns {{unusable: string[], undesignated: Array<{skill: string, tools: string[]}>}}
 */
export function actionItems(catalogTools, bindings, skillOnly) {
    const designated = asSet(skillOnly);
    const bindable = new Set((catalogTools || []).filter((t) => t.category !== 'unbindable').map((t) => t.name));
    const unusable = [...bindable].filter((n) => designated.has(n) && !(((bindings || {})[n] || {}).skills || []).length).sort();
    const bySkill = new Map();
    for (const [tool, info] of Object.entries(bindings || {})) {
        if (!bindable.has(tool) || designated.has(tool)) continue;
        for (const skill of (info && info.skills) || []) {
            if (!bySkill.has(skill)) bySkill.set(skill, []);
            bySkill.get(skill).push(tool);
        }
    }
    const undesignated = [...bySkill.entries()]
        .map(([skill, tools]) => ({ skill, tools: tools.sort() }))
        .sort((a, b) => b.tools.length - a.tools.length || a.skill.localeCompare(b.skill));
    return { unusable, undesignated };
}

/**
 * 관리자 현황 표의 행. 기본 도구는 빼고, 지금 목록에 없는 지정도 행으로 넣는다(해제할 수 있게).
 * kind: undesignated(연결됐지만 지정 안 됨) · after-skill(지정·연결) · unusable(지정됐지만 연결 없음) ·
 * missing(목록에 없는 지정) · free(연결도 지정도 없음)
 * @returns {{name: string, server: string, description: string, skills: string[], designated: boolean, kind: string}[]}
 */
export function adminRows(catalogTools, bindings, skillOnly) {
    const designated = asSet(skillOnly);
    const rows = [];
    const listed = new Set();
    for (const tool of catalogTools || []) {
        if (tool.category === 'unbindable') continue;
        listed.add(tool.name);
        const skills = [...((((bindings || {})[tool.name] || {}).skills) || [])].sort();
        const isDesignated = designated.has(tool.name);
        const kind = isDesignated ? (skills.length ? 'after-skill' : 'unusable') : skills.length ? 'undesignated' : 'free';
        rows.push({ name: tool.name, server: tool.source === 'mcp' ? tool.server : '서비스', description: tool.description || '', skills, designated: isDesignated, kind });
    }
    for (const name of designated) {
        if (!listed.has(name)) rows.push({ name, server: '', description: '', skills: [], designated: true, kind: 'missing' });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** 관리자 현황 표의 보기(필터). 지정 안 됨 · 지정됨 · 사용 불가 · 전체 */
export const ADMIN_FILTERS = [
    { value: 'undesignated', label: '지정 안 됨', kinds: ['undesignated'] },
    { value: 'designated', label: '지정됨', kinds: ['after-skill', 'unusable', 'missing'] },
    { value: 'unusable', label: '사용 불가', kinds: ['unusable', 'missing'] },
    { value: 'all', label: '전체', kinds: null }
];

/** 보기·스킬·검색어로 행을 거른다. */
export function filterAdminRows(rows, { filter = 'all', skill = '', query = '' } = {}) {
    const f = ADMIN_FILTERS.find((x) => x.value === filter);
    const q = String(query || '').trim().toLowerCase();
    return (rows || []).filter(
        (r) =>
            (!f || !f.kinds || f.kinds.includes(r.kind)) &&
            (!skill || r.skills.includes(skill)) &&
            (!q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
    );
}

/**
 * 스킬 상세에서 도구를 추가할 때 할 일.
 * connect(이미 스킬 전용 — 연결만) · designate-and-connect(관리자 — 확인 후 지정과 연결) ·
 * not-allowed(관리자가 아님) · unbindable(기본 도구) · unknown(테넌트에 없음)
 */
export function addToolPlan(tool, { isAdmin, skillOnly }) {
    if (!tool) return 'unknown';
    if (tool.category === 'unbindable') return 'unbindable';
    if (asSet(skillOnly).has(tool.name)) return 'connect';
    return isAdmin ? 'designate-and-connect' : 'not-allowed';
}

/**
 * 스킬 상세에서 도구를 뺄 때 할 일.
 * disconnect(그냥 뺀다) · last-connection(관리자 — 지정 해제/유지 선택) · last-connection-warn(관리자 아님 — 경고만)
 */
export function removeToolPlan(name, skillName, { bindings, skillOnly, isAdmin }) {
    if (!asSet(skillOnly).has(name)) return 'disconnect';
    const others = ((((bindings || {})[name] || {}).skills) || []).filter((s) => s !== skillName);
    if (others.length) return 'disconnect';
    return isAdmin ? 'last-connection' : 'last-connection-warn';
}

/**
 * 지정·해제를 언제 서버에 보낼지. 연결(SKILL.md)이 반영된 뒤여야 도구가 그 사이 사라지지 않는다.
 * 로컬 저장 스킬은 저장 직후(after-save), 저장소 스킬은 병합 뒤 관리자 현황에서(defer).
 */
export function designationTiming({ gitBacked }) {
    return gitBacked ? 'defer' : 'after-save';
}

/**
 * 확인 창 문장 묶기 — 연결 스킬이 같은 도구끼리 모은다(20개를 한 문장으로).
 * @returns {Array<{tools: string[], skills: string[]}>}
 */
export function groupBySkills(names, bindings) {
    const groups = new Map();
    for (const name of names || []) {
        const skills = [...(((bindings || {})[name] || {}).skills || [])].sort();
        const key = skills.join('\u0000');
        if (!groups.has(key)) groups.set(key, { tools: [], skills });
        groups.get(key).tools.push(name);
    }
    return [...groups.values()];
}

/** 설명의 첫 문장 한 줄(최대 max 자). 원문은 화면에서 펼쳐서 본다. */
export function oneLine(description, max = 90) {
    const text = String(description || '').replace(/\s+/g, ' ').trim();
    const m = text.match(/^(.+?[.!?。])(\s|$)/);
    const first = (m ? m[1] : text).trim();
    return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

/** "도구 추가" 검색. 에이전트 기본 도구는 빼고, 이름·설명으로 찾아 출처별로 묶는다. */
export function searchTools(catalogTools, query) {
    const q = String(query || '').trim().toLowerCase();
    const groups = new Map();
    for (const tool of catalogTools || []) {
        if (tool.category === 'unbindable') continue;
        if (q && !tool.name.toLowerCase().includes(q) && !String(tool.description || '').toLowerCase().includes(q)) continue;
        const key = tool.source === 'mcp' ? `mcp:${tool.server}` : 'service';
        const label = tool.source === 'mcp' ? `MCP 서버 · ${tool.server}` : '서비스 기본 도구';
        if (!groups.has(key)) groups.set(key, { key, label, tools: [] });
        groups.get(key).tools.push(tool);
    }
    const order = (k) => (k.startsWith('mcp:') ? 0 : 1);
    return [...groups.values()].sort((a, b) => order(a.key) - order(b.key) || a.label.localeCompare(b.label));
}

/**
 * 스킬 목록 배지. after: 스킬을 읽은 뒤 쓰는 도구 수, undesignated: 연결됐지만 지정 안 된 도구 수.
 * @returns {Map<string, {after: number, undesignated: number}>}
 */
export function skillBadges(bindings, skillOnly) {
    const designated = asSet(skillOnly);
    const out = new Map();
    for (const [tool, info] of Object.entries(bindings || {})) {
        for (const skill of (info && info.skills) || []) {
            if (!out.has(skill)) out.set(skill, { after: 0, undesignated: 0 });
            out.get(skill)[designated.has(tool) ? 'after' : 'undesignated'] += 1;
        }
    }
    return out;
}

/**
 * SKILL.md 의 unified diff 패치에서 include_tools 변경을 뽑는다 — 병합 요청 검토의 "도구 바인딩 변경".
 * @returns {{added: string[], removed: string[]} | null} 변경이 없으면 null
 */
export function includeToolsChangeFromPatch(patch) {
    const before = [];
    const after = [];
    let sawRemoved = false;
    let sawAdded = false;
    for (const line of String(patch || '').split('\n')) {
        const m = line.match(/^([ +-])\s*include_tools:\s*(.*)$/);
        if (!m) continue;
        const names = unquote(m[2].replace(/\s+#.*$/, '')).split(/\s+/).filter(Boolean);
        if (m[1] === '-') {
            before.push(...names);
            sawRemoved = true;
        } else if (m[1] === '+') {
            after.push(...names);
            sawAdded = true;
        } else {
            before.push(...names);
            after.push(...names);
        }
    }
    if (!sawRemoved && !sawAdded) return null;
    const added = [...new Set(after.filter((n) => !before.includes(n)))];
    const removed = [...new Set(before.filter((n) => !after.includes(n)))];
    return added.length || removed.length ? { added, removed } : null;
}
