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

function isLegacyAgentsFile(f) {
    const name = ((f && f.name) || '').toLowerCase();
    const p = normalizePath(f && f.path).toLowerCase();
    return name === 'agents.json' || p === 'agents.json' || p.endsWith('/agents.json');
}

/**
 * 작업 폴더 파일 목록에서 에이전트 산출물을 모은다.
 * - agents/<id>.json(단일 객체, 파일 1개 = 에이전트 1명)
 * - 레거시 agents.json(배열 또는 { agents: [...] }) — 첫 파일 하나만
 *
 * 각 항목: { agent, sourceId(파일 안의 원래 id), fileStem(파일명), id(users.id 로 저장할 값), path }
 * id 는 agentStableId 로 정한다 — draft 저장·최종 저장·편집 이동이 모두 이 값을 쓴다.
 */
export function collectWorkspaceAgents(files) {
    const list = Array.isArray(files) ? files : [];
    const out = [];
    for (const f of list) {
        const m = normalizePath(f && f.path).match(PER_AGENT_FILE);
        if (!m) continue;
        const obj = parseJson(f.content);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
        out.push({
            agent: obj,
            sourceId: (obj.id || '').toString().trim(),
            fileStem: m[1],
            id: agentStableId(obj, f.path),
            path: f.path
        });
    }
    const legacy = list.find(isLegacyAgentsFile);
    if (legacy) {
        const parsed = parseJson(legacy.content);
        const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed && parsed.agents) ? parsed.agents : [];
        for (const a of arr) {
            if (!a || typeof a !== 'object') continue;
            out.push({
                agent: a,
                sourceId: (a.id || '').toString().trim(),
                fileStem: '',
                id: agentStableId(a, legacy.path),
                path: legacy.path
            });
        }
    }
    return out;
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
