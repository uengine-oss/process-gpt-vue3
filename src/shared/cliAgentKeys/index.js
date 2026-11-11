/**
 * CLI 에이전트 API 키 — 회사(테넌트) 관리자가 넣는 Anthropic · OpenAI 키의 상태 읽기 · 저장 · 판단 (2026-11-11)
 *
 * 왜 있나
 *   cli-agent(Claude Code · Codex CLI)는 지금 한 사람의 Claude 구독 토큰으로 모든 업무를 돌린다. 구독 자격 증명은
 *   여러 사람이 나눠 쓸 수 없고, 회사가 직접 만든 API 키는 그 회사의 승인된 사용자가 쓸 수 있다. 그래서 관리자가
 *   설정 › 「CLI 에이전트 API 키」에서 회사 키를 넣고, cli-agent 는 실행마다 그 키로 돈다.
 *
 * 서버 계약 (supabase/migrations/20261111000001_cli_agent_credentials.sql)
 *   - cli_agent_credential_set(p_provider, p_secret)  관리자만. 빈 문자열이면 지운다. 테넌트는 서버가 토큰에서 정한다.
 *   - cli_agent_credential_status()                   같은 회사 사용자 누구나. 비밀 값은 오지 않는다
 *                                                    (끝 네 자리 · 바꾼 사람은 관리자에게만).
 *   화면은 키를 다시 읽을 길이 없다(쓰기 전용). 꺼내는 함수는 service_role 만 부른다.
 *
 * 공급자마다 그 키로 도는 CLI 가 하나다 — anthropic → claude-code, openai → codex. 채팅은 키가 있는 CLI 만 고르게 한다.
 * OpenAI 키만 넣은 회사에서 기본값(claude-code)으로 돌면 결국 공용 개인 구독으로 Claude 가 돈다 — 이 기능이 막으려는 일이다.
 *
 * 이 파일은 Vue 를 모른다. supabase 클라이언트는 인자로 받을 수 있다(단위 시험은 가짜를 넘긴다).
 */
import { KNOWN_CLI_AGENTS, agentCliOf } from '../../utils/cliAgents.js';

/** 공급자 — 화면의 줄 순서이기도 하다. 값은 서버 check 제약과 같아야 한다. */
export const CLI_KEY_PROVIDERS = Object.freeze([
    Object.freeze({
        provider: 'anthropic',
        agent: 'Claude Code',
        cli: 'claude-code',
        prefix: 'sk-ant-',
        consoleUrl: 'https://console.anthropic.com/settings/keys'
    }),
    Object.freeze({
        provider: 'openai',
        agent: 'Codex',
        cli: 'codex',
        prefix: 'sk-',
        consoleUrl: 'https://platform.openai.com/api-keys'
    })
]);

export const CLI_KEY_RPC = Object.freeze({
    status: 'cli_agent_credential_status',
    set: 'cli_agent_credential_set'
});

/** 채팅 선택지가 상태를 다시 묻기까지(밀리초). 방을 열 때마다 묻지 않게 한다. */
export const STATUS_TTL_MS = 60_000;

const PROVIDER_IDS = CLI_KEY_PROVIDERS.map((p) => p.provider);

function clientOf(client) {
    // 노드(시험)에는 window 가 없다. 그쪽은 client 를 직접 넘긴다.
    return client || (typeof window !== 'undefined' ? window.$supabase : null);
}

function requireClient(client) {
    const supabase = clientOf(client);
    if (!supabase || typeof supabase.rpc !== 'function') throw new Error('로그인 정보를 불러오지 못했습니다.');
    return supabase;
}

/** supabase 오류(일반 객체일 수 있다)를 화면이 message 로 읽을 수 있는 Error 로. 서버 문구 · 코드는 그대로 둔다. */
function toError(error) {
    if (error instanceof Error) return error;
    const e = new Error(error?.message || String(error));
    if (error?.code) e.code = error.code;
    return e;
}

function requireProvider(provider) {
    const p = String(provider || '').trim().toLowerCase();
    if (!PROVIDER_IDS.includes(p)) throw new Error(`알 수 없는 공급자: ${provider}`);
    return p;
}

/**
 * 키 저장소(DB 함수)가 아직 없는 서버인가 — 운영 DB 에는 SQL 을 사람이 적용하므로, 화면이 먼저 배포되면
 * 함수가 없다. 그때는 오류가 아니라 「준비 안 됨」으로 보인다.
 * 이 기능의 함수 · 표가 없을 때만이다(PGRST202 · 42883 + cli_agent_credential…, 42P01 + cli_agent_credentials).
 * 다른 것이 없다는 오류(예: 함수 안에서 쓰는 다른 표)는 진짜 오류라 그대로 보여 준다.
 */
export function isStoreMissing(error) {
    const code = String(error?.code || '');
    const msg = String(error?.message || '');
    if ((code === 'PGRST202' || code === '42883') && /cli_agent_credential/i.test(msg)) return true;
    if (code === '42P01' && /cli_agent_credentials/i.test(msg)) return true;
    return false;
}

/**
 * 서버 행을 화면 모양으로. 공급자 둘을 늘 같은 순서로 돌려준다 — 서버가 행을 빠뜨려도 「설정 안 됨」 줄이 남는다.
 * 서버가 혹시 secret 같은 칸을 실어 보내도 여기서 버린다(화면 상태에 평문이 머물지 않게).
 */
export function normalizeStatus(rows) {
    const byProvider = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
        const p = String(row?.provider || '').toLowerCase();
        if (PROVIDER_IDS.includes(p)) byProvider.set(p, row);
    }
    return CLI_KEY_PROVIDERS.map(({ provider }) => {
        const row = byProvider.get(provider);
        const configured = row?.configured === true;
        return {
            provider,
            configured,
            last4: configured && row?.last4 ? String(row.last4) : null,
            updatedAt: configured && row?.updated_at ? String(row.updated_at) : null,
            updatedByName: configured && row?.updated_by_name ? String(row.updated_by_name) : null
        };
    });
}

/** 회사 키가 하나라도 있나. */
export function anyKeyConfigured(rows) {
    return normalizeStatus(rows).some((r) => r.configured);
}

/** 회사 키가 있는 CLI(agent_id) — 공급자 순서(claude-code, codex). 채팅의 「CLI 코딩 에이전트」는 이것이 있을 때 열린다. */
export function configuredCliAgents(rows) {
    const configured = new Set(normalizeStatus(rows).filter((r) => r.configured).map((r) => r.provider));
    return CLI_KEY_PROVIDERS.filter((p) => configured.has(p.provider)).map((p) => p.cli);
}

/**
 * 채팅에서 고를 수 있는 CLI 와 지금 보낼 CLI.
 *
 *   items         서버 목록(GET /process-gpt-cli-agent/agents → toCliAgentItems). 비어 있으면 아는 둘.
 *   companyClis   회사 키가 있는 CLI(configuredCliAgents)
 *   current       지금 고른 값(방에 기억된 값)
 *
 * 회사 키가 있으면 키가 있는 CLI 만 고르게 하고, 지금 값이 그중에 없으면 첫째(키가 있는 첫 CLI)로 바꾼다.
 * 서버 목록에 없는 CLI 라도 키가 있으면 아는 이름으로 보여 준다(설치 여부는 서버가 답한다).
 * 회사 키가 없으면(플래그로 연 배포) 지금처럼 — 목록 그대로, 방에 기억된 값이 목록에 없으면 그것도 덧붙인다.
 */
export function cliChoicesFor(items, companyClis, current) {
    const base = Array.isArray(items) && items.length ? items : KNOWN_CLI_AGENTS;
    const cur = agentCliOf(current);
    const allowed = (Array.isArray(companyClis) ? companyClis : []).filter(Boolean);
    if (!allowed.length) {
        const list = base.some((i) => i?.value === cur) ? base : [...base, { value: cur, title: cur, installed: true, hint: '' }];
        return { items: list, value: cur };
    }
    const list = base.filter((i) => allowed.includes(i?.value));
    for (const v of allowed) {
        if (!list.some((i) => i.value === v)) list.push(KNOWN_CLI_AGENTS.find((k) => k.value === v) || { value: v, title: v, installed: true, hint: '' });
    }
    return { items: list, value: allowed.includes(cur) ? cur : allowed[0] };
}

/** 상태를 읽는다. 실패하면 던진다(설정 화면이 오류를 보여 준다). */
export async function fetchCliKeyStatus({ client } = {}) {
    const supabase = requireClient(client);
    const { data, error } = await supabase.rpc(CLI_KEY_RPC.status);
    if (error) throw toError(error);
    const rows = normalizeStatus(data);
    await remember(supabase, rows);
    return rows;
}

/** 키를 넣거나 바꾼다. 앞뒤 공백은 떼고 보낸다(서버도 뗀다). 빈 값은 지우기와 헷갈리니 여기서 막는다. */
export async function saveCliKey(provider, secret, { client } = {}) {
    const p = requireProvider(provider);
    const value = String(secret ?? '').trim();
    if (!value) throw new Error('API 키를 입력하세요.');
    const supabase = requireClient(client);
    invalidateCliKeyStatus();
    const { error } = await supabase.rpc(CLI_KEY_RPC.set, { p_provider: p, p_secret: value });
    if (error) throw toError(error);
}

/** 키를 지운다 — 서버 계약상 빈 문자열이 지우기다. */
export async function deleteCliKey(provider, { client } = {}) {
    const p = requireProvider(provider);
    const supabase = requireClient(client);
    invalidateCliKeyStatus();
    const { error } = await supabase.rpc(CLI_KEY_RPC.set, { p_provider: p, p_secret: '' });
    if (error) throw toError(error);
}

/**
 * 키 모양 가벼운 검사 — 경고 코드만 돌려주고 막지 않는다(공급자가 키 형식을 바꿀 수 있다).
 * 돌려주는 값: '' | 'whitespace' | 'anthropicPrefix' | 'openaiPrefix' | 'looksAnthropic'
 * 화면은 cliAgentKeys.warn.<코드> 문구를 보인다.
 */
export function keyShapeWarning(provider, secret) {
    const value = String(secret ?? '').trim();
    if (!value) return '';
    // 공백 · 줄바꿈이 섞이면 서버가 받지 않는다(CLI 환경 변수로 넣으면 인증이 늘 실패한다). 저장 전에 알려 준다.
    if (/\s/.test(value)) return 'whitespace';
    const p = String(provider || '').toLowerCase();
    if (p === 'anthropic' && !value.startsWith('sk-ant-')) return 'anthropicPrefix';
    if (p === 'openai') {
        // Anthropic 키를 Codex 줄에 붙여 넣는 실수가 가장 흔하다 — sk- 로 시작해 접두사 검사만으로는 못 잡는다.
        if (value.startsWith('sk-ant-')) return 'looksAnthropic';
        if (!value.startsWith('sk-')) return 'openaiPrefix';
    }
    return '';
}

/** 끝 네 자리를 가린 꼴로. 없으면 ''. */
export function maskedLast4(last4) {
    const s = String(last4 ?? '').trim();
    return s ? `••••${s}` : '';
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

/** 바꾼 때를 「11.11 21:30」 꼴로(보는 사람의 시간대). 읽을 수 없으면 ''. */
export function formatUpdatedAt(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * 상태 줄의 조각 — 「설정됨 · ••••1234 · 장진영 · 11.11 21:30」의 뒤쪽 셋.
 * 앞의 「설정됨 / 설정 안 됨」은 화면이 언어에 맞게 붙인다. 관리자가 아니면 서버가 끝 네 자리 · 이름을 비워 보낸다.
 */
export function statusDetails(row) {
    if (!row?.configured) return [];
    return [maskedLast4(row.last4), row.updatedByName || '', formatUpdatedAt(row.updatedAt)].filter(Boolean);
}

// ── 채팅 선택지용: 회사 키가 있는 CLI 를 짧게 기억한다 ────────────────────────────────
//
// 기억은 「사용자 + 테넌트」 하나에만 묶는다(세션의 user id 와 app_metadata.tenant_id). 로그아웃 · 다른 사람으로 로그인 ·
// 조직 바꾸기로 열쇠가 달라지면 기억을 버리고 새로 읽는다 — 앞 사람 회사의 답이 다음 사람에게 쓰이지 않게.
// 세션을 모르면(로그인 전 · SSO 헤더 교환 등) 기억하지 않고 매번 읽는다.

let cache = { key: '', at: 0, agents: null, pending: null };
// 저장 · 지우기마다 올린다. 그 전에 떠난 읽기가 늦게 돌아와 옛 값을 기억하지 않게 한다.
let generation = 0;

async function sessionKey(supabase) {
    try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        if (!user?.id) return '';
        return `${user.id}|${user.app_metadata?.tenant_id || ''}`;
    } catch (_e) {
        return '';
    }
}

/** 이 열쇠의 기억. 열쇠가 바뀌었으면 앞의 기억을 버린다. */
function entryFor(key) {
    if (cache.key !== key) cache = { key, at: 0, agents: null, pending: null };
    return cache;
}

async function remember(supabase, rows) {
    const key = await sessionKey(supabase);
    if (!key) return;
    const entry = entryFor(key);
    entry.at = Date.now();
    entry.agents = configuredCliAgents(rows);
}

/** 상태를 읽어 키가 있는 CLI 로. 못 읽으면 null(기억하지 않는다). */
async function readCompanyClis(supabase) {
    try {
        const { data, error } = await supabase.rpc(CLI_KEY_RPC.status);
        if (error) return null;
        return configuredCliAgents(data);
    } catch (_e) {
        return null;
    }
}

/** 저장 · 지우기 · 로그아웃 뒤에는 다음 물음에서 새로 읽는다. */
export function invalidateCliKeyStatus() {
    generation += 1;
    cache = { key: '', at: 0, agents: null, pending: null };
}

/**
 * 회사 키가 있는 CLI 목록(채팅의 「CLI 코딩 에이전트」와 실행 CLI 고르기). 절대 던지지 않는다 — 못 읽으면 []
 * (선택지가 없던 지금 상태 그대로). 실패는 기억하지 않는다(다음에 다시 묻는다).
 * 같은 사용자 · 테넌트면 60초 안에는 다시 묻지 않고, 동시에 여러 번 물어도 요청은 하나다.
 */
export async function companyCliAgents({ client, ttlMs = STATUS_TTL_MS, now = Date.now() } = {}) {
    const supabase = clientOf(client);
    if (!supabase || typeof supabase.rpc !== 'function') return [];
    const key = await sessionKey(supabase);
    if (!key) return (await readCompanyClis(supabase)) || [];
    const entry = entryFor(key);
    if (entry.agents && now - entry.at < ttlMs) return entry.agents;
    if (entry.pending) return entry.pending;
    const startedAt = generation;
    const pending = readCompanyClis(supabase)
        .then((agents) => {
            if (agents && cache === entry && startedAt === generation) {
                entry.at = Date.now();
                entry.agents = agents;
            }
            return agents || [];
        })
        .finally(() => {
            if (entry.pending === pending) entry.pending = null;
        });
    entry.pending = pending;
    return pending;
}

/** 회사 키가 하나라도 있나(companyCliAgents 를 참/거짓으로). */
export async function companyCliKeyConfigured(options = {}) {
    return (await companyCliAgents(options)).length > 0;
}
