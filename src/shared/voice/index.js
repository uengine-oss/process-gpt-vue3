/**
 * 말로 하는 대화의 규칙.
 *
 * 음성 세션은 오디오만 오가는 것이 아니다. 오간 말은 **글로도 남아야** 한다 —
 * 나중에 그 대화를 다시 열었을 때 아무것도 없으면 무슨 이야기를 했는지 알 수
 * 없고, 웹에서 이어 보려 해도 빈 방이 된다.
 *
 * 여기 담은 것은 오디오와 무관한 판단들뿐이다. 누가 말할 수 있는가, 오간 말을
 * 어떤 모양으로 남기는가, 순서를 어떻게 세우는가. 오디오를 다루는 부분
 * (@/components/ui/VoiceAgentDesktopMode)은 웹과 앱이 **같은 컴포넌트**를
 * 그대로 쓴다 — 두 벌이면 한쪽에서만 되는 기능이 생긴다.
 */

const textOf = (v) => (v === null || v === undefined ? '' : String(v)).trim();

/**
 * 이 대화에서 말로 할 수 있는가.
 *
 * 사람이 여럿 있는 방에서는 쓰지 않는다. 마이크가 잡은 말이 누구에게 가는지
 * 모호해지고, 남의 발화까지 이 사람 이름으로 기록된다.
 *
 * 그래서 **나와 에이전트 단둘일 때만** 연다. 포털의 규칙(isVoiceEnabled)과
 * 같은 것이다.
 *
 * @param {Array} participants 방 참가자들. `is_agent` 로 사람과 에이전트를 가른다.
 */
export function canUseVoice(participants) {
    const list = Array.isArray(participants) ? participants.filter(Boolean) : [];
    if (list.length !== 2) return false;

    const agents = list.filter((p) => p?.is_agent === true || p?.isAgent === true);
    return agents.length === 1;
}

/**
 * 세션을 시작할 때 서버에 넘길 지난 대화.
 *
 * 없으면 에이전트는 방금 전까지 글로 나눈 이야기를 모르는 채 말을 시작한다 —
 * 사용자는 같은 설명을 두 번 하게 된다.
 *
 * 최근 것부터 스무 마디만 보낸다. 전부 보내면 길어질수록 응답이 느려지고,
 * 실제로 필요한 것은 앞뒤 맥락뿐이다.
 */
export function voiceHistory(messages, limit = 20) {
    return (Array.isArray(messages) ? messages : [])
        .filter((m) => m && !m.isLoading)
        .map((m) => ({
            role: m.mine || m.role === 'user' ? 'user' : 'assistant',
            content: textOf(m.text ?? m.content)
        }))
        .filter((m) => m.content)
        .slice(-limit);
}

/**
 * 사용자가 말한 것을 대화에 남길 한 줄로.
 *
 * `contentType: 'voice'` 를 붙여 둔다 — 포털이 같은 표시를 쓰므로, 앱에서 말한
 * 것을 웹에서 열어도 말로 한 것임을 알 수 있다.
 */
export function voiceUserMessage({ text, user, uuid, at = new Date().toISOString() }) {
    const content = textOf(text);
    if (!content) return null;

    const name = textOf(user?.username || user?.name || user?.email);
    return {
        uuid,
        clientUuid: uuid,
        role: 'user',
        content,
        contentType: 'voice',
        timeStamp: at,
        email: textOf(user?.email) || null,
        name,
        userName: name,
        images: [],
        files: [],
        isVoiceMessage: true
    };
}

/** 에이전트가 말한 것을 대화에 남길 한 줄로. */
export function voiceAgentMessage({ text, agent, uuid, at = new Date().toISOString() }) {
    const content = textOf(text);
    if (!content) return null;

    const name = textOf(agent?.username || agent?.name) || 'AI';
    return {
        uuid,
        role: 'assistant',
        content,
        contentType: 'text',
        isLoading: false,
        isVoiceResponse: true,
        timeStamp: at,
        email: textOf(agent?.email) || 'voice-agent@system',
        name,
        userName: name
    };
}

/**
 * 사용자가 한 말을 어디에 끼워 넣을 것인가.
 *
 * OpenAI 는 **에이전트의 글이 사용자의 전사보다 먼저 온다.** 규격상 정상이다.
 * 그대로 뒤에 붙이면 대화가 "답변 → 질문" 순으로 뒤집혀 보인다.
 *
 * 그래서 이미 들어간 에이전트 말이 있으면 그 **앞에** 끼운다.
 *
 * @returns {Array} 새 목록. 원본은 건드리지 않는다.
 */
export function placeUserMessage(messages, message, agentMessageId) {
    const list = Array.isArray(messages) ? [...messages] : [];
    if (!message) return list;

    if (agentMessageId) {
        const at = list.findIndex((m) => m && (m.uuid || m.id) === agentMessageId);
        if (at >= 0) {
            list.splice(at, 0, message);
            return list;
        }
    }

    list.push(message);
    return list;
}

/**
 * 지금 무슨 일이 일어나고 있는지 한 마디로.
 *
 * 말로 하는 동안 화면에는 글자가 거의 없다. 그래서 지금 듣고 있는지, 생각
 * 중인지, 말하는 중인지를 말해 주지 않으면 사용자는 멈춘 줄 알고 다시 누른다.
 */
const STATUS_TEXT = {
    idle: '',
    connecting: '연결하는 중…',
    listening: '듣고 있습니다',
    speaking: '말씀하세요',
    responding: '생각하는 중…',
    playing: '대답하는 중',
    error: '연결하지 못했습니다'
};

export function voiceStatusText(status) {
    return STATUS_TEXT[status] ?? '';
}

/**
 * 음성 서버로 가는 주소.
 *
 * 앱의 화면은 `https://localhost` 위에 있다. 거기에 대고 WebSocket 을 열면
 * **앱 자신에게** 연결하려다 실패한다 — 오류도 조용해서 "연결 중" 에서 멈춘
 * 것처럼 보인다. 그래서 조직 서버 주소를 받아서 쓴다.
 *
 * @param {string} origin 예: `https://uengine.process-gpt.io`
 */
export function voiceSocketUrl(origin) {
    const base = textOf(origin);
    if (!base) return '';

    try {
        const url = new URL(base);
        const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${url.host}/voice/ws`;
    } catch (_e) {
        return '';
    }
}
