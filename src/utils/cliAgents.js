/**
 * CLI 코딩 에이전트(오케스트레이션 `cliagents`)에서 "어느 CLI 로 돌릴지".
 *
 * 업무 설정 화면(AgentSelectField)과 채팅 입력창(Chat.vue · 휴대폰 웹)이 같은 목록 ·
 * 같은 이름표를 쓰게 여기 한 곳에 둔다. 따로 두면 한쪽에 새 CLI 가 생겨도 다른
 * 쪽에서는 고를 수 없거나, 같은 CLI 가 화면마다 다른 이름으로 보인다.
 *
 * 값은 서버(process-gpt-cli-agent · cliagents 라이브러리)의 agent_id 와 같아야 한다.
 * 서버는 모르는 값을 다른 CLI 로 바꿔 돌리지 않고 실패로 돌려준다 — 그래서 여기서도
 * 모르는 값을 아는 값으로 슬쩍 바꾸지 않는다.
 *
 * 화면도 네트워크도 모르는 순수 모듈이다(node --test 가 직접 불러온다).
 */

/**
 * 알려진 CLI. 이름표는 서버의 display_name 과 같다.
 *
 * 서버 목록(GET /process-gpt-cli-agent/agents)을 받지 못했을 때 채팅 입력창이 이 둘을
 * 보여 준다. 채팅에서는 고른 CLI 가 없으면 서버 기본값으로 돌기 때문에, 목록이 비어
 * 고를 수 없게 되는 것보다 아는 둘을 보여 주는 편이 낫다(없는 CLI 면 서버가 그렇다고 답한다).
 */
export const KNOWN_CLI_AGENTS = [
    { value: 'claude-code', title: 'Claude Code', installed: true, hint: '' },
    { value: 'codex', title: 'Codex', installed: true, hint: '' }
];

/** 고른 적이 없을 때. 서버 기본값(CLIAGENTS_DEFAULT_CLI=claude-code)과 같다. */
export const DEFAULT_AGENT_CLI = 'claude-code';

/** 비어 있으면 기본값, 아니면 그대로. */
export function agentCliOf(value) {
    const v = (value ?? '').toString().trim();
    return v || DEFAULT_AGENT_CLI;
}

/** 이름표. 모르는 값이면 값 그대로 보여 준다(서버 목록에만 있는 CLI). */
export function agentCliTitle(value, items = KNOWN_CLI_AGENTS) {
    const v = (value ?? '').toString().trim();
    const hit = (Array.isArray(items) ? items : []).find((i) => i?.value === v);
    return hit?.title || v;
}

/**
 * 서버 목록(`GET /agents` 의 agents 배열)을 선택 목록으로 바꾼다.
 *
 * 설치/인증이 안 된 이유를 그 자리에서 보여 준다. 실행을 눌러 실패 메시지로 알게
 * 되는 것보다 낫다. `t` 는 vue-i18n 의 $t — AgentSelectInfo.cliAgent.* 문구를 쓴다.
 */
export function toCliAgentItems(agents, t = (k) => k) {
    return (Array.isArray(agents) ? agents : [])
        .filter((agent) => agent && agent.agent_id)
        .map((agent) => ({
            value: agent.agent_id,
            title: agent.display_name || agent.agent_id,
            installed: !!agent.installed,
            hint: agent.installed
                ? agent.authenticated === false
                    ? `${t('AgentSelectInfo.cliAgent.cliNotAuthenticated')}${agent.auth_hint ? ` — ${agent.auth_hint}` : ''}`
                    : ''
                : `${t('AgentSelectInfo.cliAgent.cliNotInstalled')}${agent.install_hint ? ` — ${agent.install_hint}` : ''}`
        }));
}

/** 서버가 아는 실행 권한. 채팅 화면은 고르지 않는다(서버 기본값 workspace_write). */
export const CLI_PERMISSIONS = ['read_only', 'workspace_write', 'command_exec'];

/**
 * 채팅 요청의 metadata 에 실을 CLI 칸.
 *
 * 본문 맨 위(top level)가 아니라 **metadata 안**이어야 한다. 에이전트 SDK 는 아는 칸만 골라
 * ChatRequest 를 만들기 때문에, 맨 위에 둔 agent_cli 는 cli-agent 에 닿기 전에 조용히 버려진다.
 *
 * cliagents 가 아닌 대화에는 아무것도 싣지 않는다 — 다른 런타임은 이 칸을 모르고,
 * 남아 있으면 나중에 무엇이 실행을 바꿨는지 헷갈린다.
 *
 * @param {string} orchestration
 * @param {string} agentCli          고른 CLI. 비어 있으면 서버 기본값을 명시한다
 * @param {object} [options]
 * @param {string} [options.model]       agent_model (비우면 CLI 기본 모델)
 * @param {string} [options.permission]  agent_permission (모르는 값이면 싣지 않는다 — 서버 기본값)
 */
export function cliChatMetadata(orchestration, agentCli, { model = '', permission = '' } = {}) {
    if ((orchestration ?? '').toString().trim() !== 'cliagents') return {};
    const fields = { agent_cli: agentCliOf(agentCli) };
    const m = (model ?? '').toString().trim();
    if (m) fields.agent_model = m;
    const p = (permission ?? '').toString().trim();
    if (CLI_PERMISSIONS.includes(p)) fields.agent_permission = p;
    return fields;
}

/**
 * 방에 기억할 CLI(chat_rooms.context.agent_cli). cliagents 방이 아니면 빈 객체.
 * 포털 · 휴대폰 웹이 같은 칸을 읽고 쓴다 — 웹에서 고른 CLI 가 휴대폰에서도 이어진다.
 */
export function cliRoomContext(orchestration, agentCli) {
    if ((orchestration ?? '').toString().trim() !== 'cliagents') return {};
    return { agent_cli: agentCliOf(agentCli) };
}

/**
 * cli-agent 가 보내는 오류 코드 → 읽을 수 있는 문구의 locale 키.
 *   cli_not_selected  CLI 를 고르지 않았다(available 에 고를 수 있는 것)
 *   cli_unavailable   고른 CLI 가 이 서버에 설치되어 있지 않다
 *   empty_message     보낼 내용이 비어 있다
 *   company_key_required      그 CLI 에 쓸 회사 API 키가 없다(또는 키 저장소가 아직 없다) — 관리자에게 설정 자리를 알린다
 *   company_key_check_failed  회사 키를 잠깐 확인하지 못했다 — 다시 보내면 된다
 * 회사 키 둘은 cli-agent 가 개인 구독 자격 증명으로 채팅을 돌리지 않으려고 거절할 때 온다(2026-11-11).
 */
export const CLI_ERROR_KEYS = {
    cli_not_selected: 'chats.agentErrors.cliNotSelected',
    cli_unavailable: 'chats.agentErrors.cliUnavailable',
    empty_message: 'chats.agentErrors.emptyMessage',
    company_key_required: 'chats.agentErrors.companyKeyRequired',
    company_key_check_failed: 'chats.agentErrors.companyKeyCheckFailed'
};

/** company_key_required 뒤에 붙이는 한 줄 — 누가 어디서 고치는지. */
export const COMPANY_KEY_ADMIN_HINT_KEY = 'chats.agentErrors.companyKeyAdminHint';

/**
 * 휴대폰 웹(한국어만)이 쓰는 같은 문구. 포털은 locale(ko.json · en.json)의 같은 키를 쓴다 —
 * 문구를 고칠 때는 두 곳을 함께 고친다.
 */
const KO_TEXT = {
    'chats.agentErrors.cliNotSelected': '실행할 CLI를 먼저 고르세요.',
    'chats.agentErrors.cliUnavailable': '고른 CLI가 이 서버에 설치되어 있지 않습니다. 다른 CLI를 고르세요.',
    'chats.agentErrors.emptyMessage': '보낼 내용이 비어 있습니다.',
    'chats.agentErrors.companyKeyRequired': '이 CLI에 쓸 회사 API 키가 없습니다.',
    'chats.agentErrors.companyKeyAdminHint': '관리자는 설정 › CLI 에이전트 API 키에서 회사 키를 넣을 수 있습니다.',
    'chats.agentErrors.companyKeyCheckFailed': '회사 API 키를 확인하지 못했습니다. 잠시 뒤 다시 보내 주세요.'
};

/**
 * 스트림 오류를 사람이 읽을 문구로. 아는 코드면 그 문구, 아니면 서버가 준 글 그대로.
 *
 * 서버 글(content)만 보이면 "cli_not_selected" 같은 기술 문구나 영어가 섞여, 사용자는
 * 무엇을 해야 하는지(CLI 를 고르면 된다) 알 수 없다.
 *
 * @param {Error & {code?: string, available?: string[]}} err  서비스가 만든 오류(code · available 이 붙어 온다)
 * @param {(key: string) => string} [t]  vue-i18n 의 $t. 없으면 한국어
 */
export function readableAgentError(err, t) {
    const raw = (err?.message || '').toString();
    const key = CLI_ERROR_KEYS[err?.code];
    if (!key) return raw;
    const translate = typeof t === 'function' ? t : (k) => KO_TEXT[k] || k;
    let text = translate(key);
    if (err.code === 'cli_not_selected' && Array.isArray(err.available) && err.available.length) {
        text += ` (${err.available.map((v) => agentCliTitle(v)).join(' · ')})`;
    }
    // 설치되지 않은 CLI 는 서버 글에 어느 CLI 인지 · 어떻게 설치하는지가 들어 있다. 버리지 않는다.
    if (err.code === 'cli_unavailable' && raw && raw !== 'Agent error') text += ` — ${raw}`;
    // 회사 키가 없으면 보낸 사람이 고칠 수 없다 — 관리자가 어디서 넣는지 한 줄 덧붙인다.
    if (err.code === 'company_key_required') text += ` ${translate(COMPANY_KEY_ADMIN_HINT_KEY)}`;
    return text;
}

/**
 * 스트림의 `type: error` 프레임 → Error. 서버가 준 code · available 을 붙여, 화면이
 * 읽을 문구(readableAgentError)를 고를 수 있게 한다.
 */
export function agentStreamError(message, parsed) {
    const err = new Error((message || 'Agent error').toString());
    if (parsed?.code) err.code = String(parsed.code);
    if (Array.isArray(parsed?.available)) err.available = parsed.available.map(String);
    return err;
}
