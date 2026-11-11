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
 * 이 파일은 Vue 를 모른다. supabase 클라이언트는 인자로 받을 수 있다(단위 시험은 가짜를 넘긴다).
 */

/** 공급자 — 화면의 줄 순서이기도 하다. 값은 서버 check 제약과 같아야 한다. */
export const CLI_KEY_PROVIDERS = Object.freeze([
    Object.freeze({
        provider: 'anthropic',
        agent: 'Claude Code',
        prefix: 'sk-ant-',
        consoleUrl: 'https://console.anthropic.com/settings/keys'
    }),
    Object.freeze({
        provider: 'openai',
        agent: 'Codex',
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
 * 서버 행을 화면 모양으로. 공급자 둘을 늘 같은 순서로 돌려준다 — 서버가 행을 빠뜨려도 「설정 안 됨」 줄이 남는다.
 * 서버가 혹시 secret 같은 칸을 실어 보내도 여기서 버린다(화면 상태에 평문이 머물지 않게).
 */
/**
 * 키 저장소(DB 함수)가 아직 없는 서버인가 — 운영 DB 에는 SQL 을 사람이 적용하므로, 화면이 먼저 배포되면
 * 함수가 없다(PostgREST PGRST202 · Postgres 42883 · 표 없음 42P01). 그때는 오류가 아니라 「준비 안 됨」으로 보인다.
 */
export function isStoreMissing(error) {
    const code = String(error?.code || '');
    const msg = String(error?.message || '');
    return ['PGRST202', '42883', '42P01', '3F000'].includes(code) || /could not find the function|does not exist/i.test(msg);
}

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

/** 회사 키가 하나라도 있나 — 채팅의 「CLI 코딩 에이전트」를 열지 정한다. */
export function anyKeyConfigured(rows) {
    return normalizeStatus(rows).some((r) => r.configured);
}

/** 상태를 읽는다. 실패하면 던진다(설정 화면이 오류를 보여 준다). */
export async function fetchCliKeyStatus({ client } = {}) {
    const supabase = requireClient(client);
    const { data, error } = await supabase.rpc(CLI_KEY_RPC.status);
    if (error) throw toError(error);
    const rows = normalizeStatus(data);
    remember(rows);
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

// ── 채팅 선택지용: 회사 키가 있는지만, 짧게 기억한다 ────────────────────────────────

let cached = { at: 0, value: null, pending: null };
// 저장 · 지우기마다 올린다. 그 전에 떠난 읽기가 늦게 돌아와 옛 값을 기억하지 않게 한다.
let generation = 0;

function remember(rows) {
    cached = { at: Date.now(), value: anyKeyConfigured(rows), pending: null };
}

/** 저장 · 지우기 뒤에는 다음 물음에서 새로 읽는다. */
export function invalidateCliKeyStatus() {
    generation += 1;
    cached = { at: 0, value: null, pending: null };
}

/**
 * 회사 키가 하나라도 설정돼 있나(채팅의 「CLI 코딩 에이전트」 선택지). 절대 던지지 않는다 — 못 읽으면 false
 * (선택지가 없던 지금 상태 그대로). 실패는 기억하지 않는다(다음에 다시 묻는다).
 * 60초 안에는 다시 묻지 않고, 동시에 여러 번 물어도 요청은 하나다.
 */
export function companyCliKeyConfigured({ client, ttlMs = STATUS_TTL_MS, now = Date.now() } = {}) {
    if (cached.value !== null && now - cached.at < ttlMs) return Promise.resolve(cached.value);
    if (cached.pending) return cached.pending;
    const startedAt = generation;
    const ask = async () => {
        const supabase = clientOf(client);
        if (!supabase || typeof supabase.rpc !== 'function') return false;
        const { data, error } = await supabase.rpc(CLI_KEY_RPC.status);
        if (error) return false;
        const value = anyKeyConfigured(data);
        if (startedAt === generation) cached = { at: Date.now(), value, pending: null };
        return value;
    };
    const pending = ask()
        .catch(() => false)
        .finally(() => {
            if (cached.pending === pending) cached.pending = null;
        });
    cached.pending = pending;
    return pending;
}
