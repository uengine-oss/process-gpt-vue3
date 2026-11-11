/**
 * 「에이전트를 준비하고 있어요 · N초」 — 대화 Pod 가 아직 안 떴을 때의 표시.
 *
 * 왜 필요한가
 *   CLI 계열 에이전트(codex · cliagents)는 대화마다 Pod 를 하나씩 띄운다. 그 대화의 Pod 가
 *   식어 있으면 첫 답까지 16~40초가 걸리는데, 그동안 화면에는 아무것도 바뀌지 않아
 *   사용자는 AI 가 죽은 줄 알고 다시 보내거나 창을 닫았다.
 *   세션 라우터가 이제 에이전트 스트림보다 먼저 상태 프레임을 보낸다.
 *     {"type":"session_status","status":"starting","agent_type":"codex","elapsed_ms":2000}  (곧바로, 그 뒤 2초마다)
 *     {"type":"session_status","status":"ready","agent_type":"codex","waited_ms":18000}     (그 뒤 평소 스트림)
 *
 * 언제 보이고 언제 사라지는가
 *   - starting 이 와야만 보인다. 이미 떠 있는 Pod · deepagents · langchain-react 처럼 상태
 *     프레임이 없는 대화에는 한 번도 나타나지 않는다.
 *   - ready, 또는 에이전트가 낸 첫 이벤트(토큰 · 도구 · done · error)나 중지에서 사라진다.
 *     ready 가 빠진 채 토큰부터 와도 남아 있으면 안 되기 때문에, 상태 프레임이 아닌
 *     모든 이벤트에서 지운다.
 *   - 초는 서버가 준 elapsed_ms 에서 시작해 화면에서 1초씩 센다. 프레임은 2초마다 오므로
 *     프레임만 따르면 숫자가 2씩 건너뛰어 멈춘 것처럼 보인다. 새 프레임이 오면 서버
 *     값으로 다시 맞춘다.
 *
 * 화면도 네트워크도 모르는 순수 모듈이다. 포털(ChatRoomPage)과 휴대폰 웹(ChatRoomView)이
 * 같은 규칙을 쓴다 — 둘이 따로 세면 같은 대화가 화면마다 다른 초를 보인다.
 */

export const SESSION_STATUS = 'session_status';

/** 서버 경과 시간(ms)과 받은 시각으로 지금 몇 초째인지. */
export function preparingSeconds(state, now = Date.now()) {
    if (!state) return 0;
    const ms = state.baseMs + Math.max(0, now - state.at);
    return Math.max(0, Math.floor(ms / 1000));
}

/**
 * 상태 프레임 하나를 반영한 다음 상태. 보일 것이 없으면 null.
 *
 * starting 만 상태를 만든다. ready 는 물론, 아직 모르는 status 값도 지운다 —
 * 모르는 값에 표시를 남겨 두면 끝나지 않는 「준비 중」이 된다.
 */
export function nextPreparing(state, event, now = Date.now()) {
    if (!event || event.type !== SESSION_STATUS) return null;
    if (event.status !== 'starting') return null;
    const elapsed = Number(event.elapsed_ms);
    return {
        agentType: (event.agent_type || state?.agentType || '').toString(),
        baseMs: Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0,
        at: now
    };
}

/**
 * 한 번의 답(스트림 하나)에 붙는 표시 상태.
 *
 * @param {object}   deps
 * @param {Function} deps.onChange       보일 것 { agentType, seconds } 또는 null 을 받는다
 * @param {Function} [deps.now]          지금 시각(ms) — 시험에서 고정한다
 * @param {Function} [deps.setInterval]  시험에서 바꿔 끼운다
 * @param {Function} [deps.clearInterval]
 * @param {number}   [deps.tickMs]       화면에서 초를 세는 간격
 */
export function createSessionPreparing({
    onChange = () => {},
    now = () => Date.now(),
    setInterval: setTimer = (fn, ms) => globalThis.setInterval(fn, ms),
    clearInterval: clearTimer = (id) => globalThis.clearInterval(id),
    tickMs = 1000
} = {}) {
    let state = null;
    let timer = null;
    let lastSeconds = -1;

    const view = () => (state ? { agentType: state.agentType, seconds: preparingSeconds(state, now()) } : null);

    function emit(force = false) {
        const v = view();
        // 초가 바뀔 때만 알린다 — 화면 갱신이 메시지 목록 전체를 다시 계산하기 때문이다.
        if (!force && v && v.seconds === lastSeconds) return;
        lastSeconds = v ? v.seconds : -1;
        onChange(v);
    }

    function stopTimer() {
        if (timer !== null) {
            clearTimer(timer);
            timer = null;
        }
    }

    /** 상태 프레임을 받았다. */
    function update(event) {
        const next = nextPreparing(state, event, now());
        if (!next) {
            clear();
            return;
        }
        const wasShowing = !!state;
        state = next;
        if (timer === null) timer = setTimer(() => emit(false), tickMs);
        emit(!wasShowing);
    }

    /** 에이전트가 움직였거나(토큰 · 도구 · 끝 · 오류) 중지했다. 한 번만 알린다. */
    function clear() {
        stopTimer();
        if (!state) return;
        state = null;
        lastSeconds = -1;
        onChange(null);
    }

    return {
        update,
        clear,
        get active() {
            return !!state;
        },
        get view() {
            return view();
        }
    };
}

/**
 * 스트림 콜백 묶음에 표시를 끼운다.
 *
 * 상태 프레임이 아닌 콜백은 모두 부르기 전에 표시를 지운다. 콜백마다 손으로 지우게
 * 두면 새 이벤트 종류가 생길 때 그 한 곳에서 「준비 중」이 남는다.
 */
export function withSessionPreparing(callbacks, tracker) {
    const wrapped = {};
    for (const [name, fn] of Object.entries(callbacks || {})) {
        if (name === 'onSessionStatus' || typeof fn !== 'function') {
            wrapped[name] = fn;
            continue;
        }
        wrapped[name] = (...args) => {
            tracker.clear();
            return fn(...args);
        };
    }
    const own = callbacks?.onSessionStatus;
    wrapped.onSessionStatus = (event) => {
        tracker.update(event);
        if (typeof own === 'function') own(event);
    };
    return wrapped;
}
