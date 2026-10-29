/**
 * 에이전트 산출물(agents/<id>.json)의 안정적 DB id 유틸.
 *
 * 배경: deepagent 는 에이전트 파일 id 를 슬러그(예: 'approval-notifier')로 만든다.
 * 그런데 users.id 는 uuid 타입이라 슬러그를 그대로 쓸 수 없다. 매번 랜덤 uuid 를 발급하면
 * 방 재진입(워크스페이스 파일 재복원) 시 값이 달라져 편집기(/agent-chat/{id})가 draft 저장된
 * 에이전트를 못 찾는다. → 슬러그에서 **결정적(deterministic) uuid** 를 파생해, 편집 이동·draft 저장·
 * 최종 저장이 영속화 없이도 항상 동일한 id 를 쓰게 한다.
 */

export function isUuid(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((v || '').toString());
}

/** 문자열 → 결정적 uuid(버전4 형식). 같은 입력 → 항상 같은 uuid. */
export function slugToUuid(s) {
    const str = (s || '').toString();
    const bytes = [];
    for (let salt = 0; salt < 4; salt++) {
        let h = (0x811c9dc5 ^ salt) >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        bytes.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
    const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * 에이전트 객체/파일경로에서 안정적 DB id 를 구한다.
 * - obj.id 가 이미 uuid 면 그대로.
 * - 아니면 obj.id(슬러그) 또는 파일명 stem 에서 결정적 uuid 파생.
 */
export function agentStableId(obj, filePath) {
    const rawId = (obj && obj.id ? obj.id : '').toString().trim();
    if (isUuid(rawId)) return rawId;
    let seed = rawId;
    if (!seed && filePath) {
        const m = (filePath || '').replace(/\\/g, '/').match(/\/agents\/([^/]+)\.json$/i);
        if (m) seed = m[1];
    }
    if (!seed) seed = (filePath || '').toString();
    return slugToUuid(seed);
}

// ---------------------------------------------------------------------------
// 작업 폴더 에이전트 ↔ 프로세스 정의의 에이전트 참조
//
// deepagent 는 process-definition.json 의 activity.agent 와 roles[].endpoint 에도 같은 슬러그를
// 쓴다(bpmn-process-generation-skill references/05-agents.md). 실행 엔진은 담당자를 users 의
// id 또는 email 로만 찾으므로(completion polling_service/database.py fetch_user_info·
// is_user_in_tenant), 정의를 슬러그 그대로 저장하면 에이전트 단계에 담당 에이전트가 붙지 않는다.
// 저장할 때 정의 안의 슬러그를 그 에이전트가 저장될 users.id 로 바꿔야 한다.
// ---------------------------------------------------------------------------

const PER_AGENT_FILE = /\/agents\/([^/]+)\.json$/i;

function normalizePath(p) {
    return (p || '').toString().replace(/\\/g, '/');
}

function parseJson(text) {
    try {
        return JSON.parse((text || '').toString());
    } catch (e) {
        return null;
    }
}

/**
 * 문자열 밖에서 열린 채로 끝난 { [ 를 닫은 문자열. 고칠 수 없으면 ''.
 * 문자열 안에서 끝났거나(내용이 잘림) 괄호 짝이 어긋나면 고치지 않는다. 끝의 쉼표 하나는 지운다.
 */
function closeUnterminatedJson(raw) {
    const stack = [];
    let inString = false;
    let escaped = false;
    for (const ch of raw) {
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{' || ch === '[') stack.push(ch);
        else if (ch === '}' || ch === ']') {
            const open = stack.pop();
            if ((ch === '}' && open !== '{') || (ch === ']' && open !== '[')) return '';
        }
    }
    if (inString || stack.length === 0) return '';
    const body = raw.replace(/\s+$/, '').replace(/,$/, '');
    return (
        body +
        stack
            .reverse()
            .map((c) => (c === '{' ? '}' : ']'))
            .join('')
    );
}

/**
 * 에이전트 파일(agents/<id>.json) 내용을 읽는다.
 *
 * 깨진 JSON 이면 끝에 빠진 닫는 괄호만 채워 한 번 더 읽어 본다 — 딥 에이전트가 write_file 내용 끝의 `}` 를
 * 빠뜨린 일이 있었다(VM 녹화 agents/quote_calc_agent.json, 튜토리얼 회차 estimate_agent.json). 고친 결과가
 * 이름(name)이 있는 객체일 때만 받아들이고, 그 밖에는 읽지 못한 것으로 둔다(지어내지 않는다).
 *
 * @returns {{ value: any, repaired: boolean, error: string }}
 */
export function readAgentJson(text) {
    const raw = (text || '').toString();
    try {
        return { value: JSON.parse(raw), repaired: false, error: '' };
    } catch (e) {
        const fixed = closeUnterminatedJson(raw);
        if (fixed) {
            try {
                const value = JSON.parse(fixed);
                if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.name === 'string' && value.name.trim()) {
                    return { value, repaired: true, error: '' };
                }
            } catch (e2) {
                /* 고쳐도 못 읽으면 아래로 */
            }
        }
        return { value: null, repaired: false, error: (e && e.message) || 'JSON 형식 오류' };
    }
}

function isLegacyAgentsFile(f) {
    const name = ((f && f.name) || '').toLowerCase();
    const p = normalizePath(f && f.path).toLowerCase();
    return name === 'agents.json' || p === 'agents.json' || p.endsWith('/agents.json');
}

/**
 * 작업 폴더 파일 목록에서 에이전트 산출물을 모으고, 읽지 못한 에이전트 파일도 함께 돌려준다.
 * - agents/<id>.json(단일 객체, 파일 1개 = 에이전트 1명) — 끝 괄호만 빠졌으면 채워 읽는다(readAgentJson)
 * - 레거시 agents.json(배열 또는 { agents: [...] }) — 첫 파일 하나만
 *
 * agents 각 항목: { agent, sourceId(파일 안의 원래 id), fileStem(파일명), id(users.id 로 저장할 값), path, repaired }
 * id 는 agentStableId 로 정한다 — draft 저장·최종 저장·편집 이동이 모두 이 값을 쓴다.
 * unreadable 각 항목: { path, fileStem, error } — 저장하지 않는다. 정의 안의 그 슬러그도 바꾸지 않는다
 * (저장할 에이전트가 없으니 가리킬 id 가 없다). 예전에는 이런 파일을 말없이 건너뛰어, 고른 에이전트 둘 중
 * 하나가 저장되지 않은 것을 사용자가 알 수 없었다.
 */
export function readWorkspaceAgents(files) {
    const list = Array.isArray(files) ? files : [];
    const agents = [];
    const unreadable = [];
    for (const f of list) {
        const m = normalizePath(f && f.path).match(PER_AGENT_FILE);
        if (!m) continue;
        const { value: obj, repaired, error } = readAgentJson(f.content);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            unreadable.push({ path: f.path, fileStem: m[1], error: error || '에이전트 객체가 아닙니다' });
            continue;
        }
        agents.push({
            agent: obj,
            sourceId: (obj.id || '').toString().trim(),
            fileStem: m[1],
            id: agentStableId(obj, f.path),
            path: f.path,
            repaired
        });
    }
    const legacy = list.find(isLegacyAgentsFile);
    if (legacy) {
        const parsed = parseJson(legacy.content);
        if (parsed === null && (legacy.content || '').toString().trim()) {
            unreadable.push({ path: legacy.path, fileStem: '', error: 'JSON 형식 오류' });
        }
        const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed && parsed.agents) ? parsed.agents : [];
        for (const a of arr) {
            if (!a || typeof a !== 'object') continue;
            agents.push({
                agent: a,
                sourceId: (a.id || '').toString().trim(),
                fileStem: '',
                id: agentStableId(a, legacy.path),
                path: legacy.path,
                repaired: false
            });
        }
    }
    return { agents, unreadable };
}

/** 작업 폴더의 에이전트 산출물(읽은 것만). 읽지 못한 파일까지 필요하면 readWorkspaceAgents 를 쓴다. */
export function collectWorkspaceAgents(files) {
    return readWorkspaceAgents(files).agents;
}

/**
 * 읽지 못한·고쳐 읽은 에이전트 파일을 사용자에게 알릴 문장. 없으면 ''.
 * - notSaved: 읽지 못해 저장하지 않은 파일(채팅 저장 결과 카드의 「저장 실패」 줄에 보인다)
 * - repaired: 끝 괄호를 채워 읽고 저장한 파일
 */
export function describeAgentFileProblems({ agents = [], unreadable = [] } = {}) {
    const fileLabel = (p) => {
        const m = normalizePath(p).match(/(agents\/[^/]+\.json|agents\.json)$/i);
        return m ? m[1] : normalizePath(p);
    };
    const notSaved = unreadable.map((u) => {
        const file = fileLabel(u.path);
        const slug = u.fileStem ? ` 프로세스에서 이 에이전트를 가리키는 「${u.fileStem}」 값은 그대로 두었습니다.` : '';
        return `에이전트 파일 ${file} 을 읽을 수 없어(JSON 형식 오류) 이 에이전트는 저장하지 않았습니다.${slug} 파일을 고친 뒤 다시 저장하세요.`;
    });
    const repaired = agents
        .filter((a) => a && a.repaired)
        .map((a) => {
            const file = fileLabel(a.path);
            const name = (a.agent && a.agent.name) || a.fileStem;
            return `에이전트 파일 ${file} 끝의 닫는 괄호가 빠져 있어 채워서 읽고 저장했습니다(${name}).`;
        });
    return { notSaved: notSaved.join(' '), repaired: repaired.join(' ') };
}

/** 하이픈·밑줄·공백·대소문자 차이만 있는 슬러그를 같은 것으로 본다(stock_agent ↔ stock-agent). */
function looseKey(s) {
    return (s || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** 에이전트 목록 → (정의에 적힌 값) → 저장 id 를 찾는 함수. 못 찾으면 null. */
export function agentRefResolver(agents) {
    const exact = new Map();
    const loose = new Map(); // 같은 느슨한 키가 서로 다른 에이전트를 가리키면 null(애매함) 로 둔다.
    const add = (key, id) => {
        const k = (key || '').toString().trim();
        if (!k || !id || k === id) return;
        if (!exact.has(k)) exact.set(k, id);
        const lk = looseKey(k);
        if (!lk) return;
        if (!loose.has(lk)) loose.set(lk, id);
        else if (loose.get(lk) !== id) loose.set(lk, null);
    };
    for (const a of Array.isArray(agents) ? agents : []) {
        if (!a || !a.id) continue;
        add(a.sourceId, a.id);
        add(a.fileStem, a.id);
    }
    return (value) => {
        if (typeof value !== 'string') return null;
        const v = value.trim();
        if (!v || isUuid(v)) return null;
        if (exact.has(v)) return exact.get(v);
        return loose.get(looseKey(v)) || null;
    };
}

/**
 * 프로세스 정의 안의 에이전트 참조를 저장 id 로 바꾼 사본을 돌려준다(원본은 그대로).
 *
 * 바꾸는 곳 — 실행 엔진이 담당자로 읽는 칸:
 * - roles[].endpoint / roles[].default (문자열 또는 문자열 배열)
 * - activity.agent / activity.rootAgent / activity.agents[] (문자열 또는 { id })
 *   flattened(activities[]) 와 elements[] 형식 모두, subProcesses[].children 안쪽까지.
 * 에이전트 파일에 없는 값(사람 email·이미 있는 에이전트 uuid·external_customer 등)은 건드리지 않는다.
 *
 * @returns {{ definition: object, replaced: { path: string, from: string, to: string }[] }}
 */
export function remapAgentRefs(definition, agents) {
    if (!definition || typeof definition !== 'object') return { definition, replaced: [] };
    const resolve = agentRefResolver(agents);
    const replaced = [];
    const copy = JSON.parse(JSON.stringify(definition));

    const swap = (value, where) => {
        const to = resolve(value);
        if (!to) return value;
        replaced.push({ path: where, from: value, to });
        return to;
    };
    const swapEach = (value, where) => {
        if (typeof value === 'string') return swap(value, where);
        if (Array.isArray(value)) return value.map((v, i) => (typeof v === 'string' ? swap(v, `${where}[${i}]`) : v));
        return value;
    };

    const remapActivity = (act, where) => {
        if (!act || typeof act !== 'object') return;
        if (typeof act.agent === 'string') act.agent = swap(act.agent, `${where}.agent`);
        if (typeof act.rootAgent === 'string') act.rootAgent = swap(act.rootAgent, `${where}.rootAgent`);
        if (Array.isArray(act.agents)) {
            act.agents = act.agents.map((ag, i) => {
                if (typeof ag === 'string') return swap(ag, `${where}.agents[${i}]`);
                if (ag && typeof ag === 'object' && typeof ag.id === 'string') {
                    const id = swap(ag.id, `${where}.agents[${i}].id`);
                    return id === ag.id ? ag : { ...ag, id };
                }
                return ag;
            });
        }
    };

    const remapDefinition = (def, where) => {
        if (!def || typeof def !== 'object') return;
        if (Array.isArray(def.roles)) {
            def.roles.forEach((role, i) => {
                if (!role || typeof role !== 'object') return;
                if ('endpoint' in role) role.endpoint = swapEach(role.endpoint, `${where}roles[${i}].endpoint`);
                if ('default' in role) role.default = swapEach(role.default, `${where}roles[${i}].default`);
            });
        }
        if (Array.isArray(def.activities)) def.activities.forEach((a, i) => remapActivity(a, `${where}activities[${i}]`));
        if (Array.isArray(def.elements)) {
            def.elements.forEach((el, i) => {
                if (!el || typeof el !== 'object') return;
                if (!el.elementType || el.elementType === 'Activity') remapActivity(el, `${where}elements[${i}]`);
                if (el.children && typeof el.children === 'object') remapDefinition(el.children, `${where}elements[${i}].children.`);
            });
        }
        if (Array.isArray(def.subProcesses)) {
            def.subProcesses.forEach((sp, i) => {
                if (sp && sp.children && typeof sp.children === 'object')
                    remapDefinition(sp.children, `${where}subProcesses[${i}].children.`);
            });
        }
    };

    remapDefinition(copy, '');
    return { definition: copy, replaced };
}
