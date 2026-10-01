/**
 * 채팅에서 프로세스를 시작한 흔적(execute_process 도구 호출)을 카드로 그릴 값으로 읽는다.
 *
 * 전에는 도구가 끝나자마자 인스턴스 화면으로 넘겨 버려, 대화하던 채팅방을 잃었고
 * 나중에 그 채팅방을 다시 열어도 무엇을 시작했는지 남아 있지 않았다. 이제는 채팅방에
 * '프로세스를 시작하는 중…' → '… 프로세스가 실행되었습니다' 카드를 남기고, 카드를 눌러야 넘어간다.
 *
 * 도구 호출 기록(toolCalls: name · status · input · output)은 메시지와 함께 저장되므로
 * 따로 저장할 것 없이 그 기록에서 다시 읽는다 — 채팅방을 다시 열어도 같은 카드가 보인다.
 */
import { parseMcpToolOutput } from './toolOutput.js';

/** 도구 이름이 프로세스 실행인가. MCP 서버 접두어가 붙어 오기도 한다(work-assistant__execute_process). */
export function isExecuteProcessTool(name) {
    return /(^|[^a-z0-9_]|__)execute_process$/i.test(String(name || ''));
}

function inputOf(toolCall) {
    const raw = toolCall && toolCall.input;
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    return parseMcpToolOutput(raw) || {};
}

function errorText(parsed) {
    const e = parsed && parsed.error;
    if (!e) return '';
    if (typeof e === 'string') return e;
    return e.message || JSON.stringify(e);
}

/**
 * 도구 호출 하나 → 실행 카드 값.
 *
 * @returns {null | {
 *   state: 'starting' | 'started' | 'failed',
 *   instanceId: string,
 *   definitionId: string,
 *   error: string
 * }}
 */
export function processLaunchOf(toolCall) {
    if (!toolCall || !isExecuteProcessTool(toolCall.name)) return null;
    const input = inputOf(toolCall);
    const definitionId = String(input.process_definition_id || input.processDefinitionId || '');
    const base = { instanceId: '', definitionId, error: '' };

    if (toolCall.status === 'running') return { ...base, state: 'starting' };

    const parsed = parseMcpToolOutput(toolCall.output);
    const instanceId = String((parsed && (parsed.process_instance_id || parsed.processInstanceId || parsed.instance_id)) || '');
    const error = errorText(parsed);
    if (toolCall.status === 'error' || error || !instanceId) {
        return { ...base, state: 'failed', error: error || '실행 결과에서 인스턴스를 찾지 못했습니다.' };
    }
    return { ...base, state: 'started', instanceId };
}

/**
 * 메시지에 남은 프로세스 실행 카드들(시작한 순서대로).
 *
 * - 같은 인스턴스를 가리키는 카드는 하나만 둔다 — 서버가 중복 실행을 막고 이미 시작한
 *   인스턴스를 돌려주면(already_started) 같은 카드가 또 생긴다.
 * - 실행에 성공한 것이 있으면 실패한 시도는 뺀다 — 에이전트가 뒤 단계로 잘못 부른 것을
 *   서버가 거절한 흔적이라, 성공 카드 옆에 '시작하지 못했습니다' 가 붙으면 실패한 것처럼 보인다.
 */
export function processLaunchesOf(message) {
    const tools = message && Array.isArray(message.toolCalls) ? message.toolCalls : [];
    const all = tools.map(processLaunchOf).filter(Boolean);
    const seen = new Set();
    const unique = all.filter((l) => {
        if (l.state !== 'started') return true;
        if (seen.has(l.instanceId)) return false;
        seen.add(l.instanceId);
        return true;
    });
    return seen.size ? unique.filter((l) => l.state !== 'failed') : unique;
}

/** 인스턴스 채팅 주소. 라우터는 id 의 점을 _DOT_ 으로 받는다. */
export function instanceRouteOf(instanceId) {
    return `/instancelist/${String(instanceId || '').replace(/\./g, '_DOT_')}`;
}

/**
 * 카드 제목. 정의 이름이 이미 '프로세스' 로 끝나면 한 번 더 붙이지 않는다
 * ('국민신문고 프로세스 프로세스가' 가 되지 않게).
 */
export function launchTitle(processName, state) {
    const name = String(processName || '').trim();
    const subject = !name ? '프로세스' : /프로세스$/.test(name) ? name : `${name} 프로세스`;
    // subject 는 늘 '프로세스' 로 끝나므로 조사는 를 · 가 로 고정이다.
    if (state === 'starting') return `${subject}를 시작하는 중…`;
    if (state === 'failed') return `${subject}를 시작하지 못했습니다`;
    return `${subject}가 실행되었습니다`;
}
