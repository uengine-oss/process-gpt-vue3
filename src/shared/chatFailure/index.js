/**
 * 채팅이 실패했을 때 사용자에게 무엇을 보여 줄 것인가.
 *
 * 이 모듈이 생긴 이유는 운영에서 겪은 증상 하나다. 메시지를 보내면 내 말풍선만
 * 남고 답이 오지 않는데, 화면에는 아무 설명도 없었다. 로그를 봐야 알 수 있었다 —
 * 프런트가 `chats` 저장을 실패하며 재시도를 반복해 브라우저 커넥션 풀을 다 써
 * 버렸고(`ERR_INSUFFICIENT_RESOURCES`), 그래서 채팅 요청이 아예 나가지 못했다.
 *
 * 두 가지를 여기서 다룬다.
 *
 * 1. **원인을 사람 말로 옮긴다.** `TypeError: Failed to fetch` 를 그대로 보여 주면
 *    사용자는 무엇을 해야 할지 모른다. 무엇이 막혔는지와 다음에 할 일을 적는다.
 * 2. **저장 실패에 상한을 둔다.** 연속으로 실패하면 더 부르지 않는다. 재시도가
 *    브라우저 자원을 먹어 채팅 자체를 막는 것이 애초의 사고였다.
 *
 * 규칙을 화면 파일(ChatRoomPage.vue) 밖에 두는 것은 단위 테스트가 보게 하기
 * 위해서다.
 */

/** 연속 실패가 이만큼 쌓이면 저장을 멈춘다. */
export const PERSIST_FAILURE_LIMIT = 3;

/** 원인별 안내. `match` 가 처음으로 맞는 것을 쓴다. */
const CAUSES = [
    {
        id: 'browser-resources',
        match: (t) => t.includes('ERR_INSUFFICIENT_RESOURCES') || t.includes('insufficient resources'),
        text: '브라우저가 더 이상 요청을 열지 못하는 상태입니다. 이 대화를 연 탭이 여러 개면 하나만 남기고 닫은 뒤, 페이지를 새로고침해 주세요.'
    },
    {
        id: 'offline',
        match: (t, { online }) => online === false,
        text: '네트워크에 연결되어 있지 않습니다. 연결을 확인한 뒤 다시 보내 주세요.'
    },
    {
        id: 'network',
        match: (t) => t.includes('failed to fetch') || t.includes('networkerror') || t.includes('err_network') || t.includes('err_connection'),
        text: '서버에 연결하지 못했습니다. 잠시 뒤 다시 보내 주세요.'
    },
    {
        id: 'timeout',
        match: (t) => t.includes('timeout') || t.includes('etimedout') || t.includes('504'),
        text: '서버 응답이 제한 시간을 넘었습니다. 잠시 뒤 다시 보내 주세요.'
    },
    {
        id: 'unauthorized',
        match: (t) => t.includes('401') || t.includes('403') || t.includes('unauthorized') || t.includes('forbidden'),
        text: '이 대화를 보낼 권한이 없습니다. 다시 로그인한 뒤 시도해 주세요.'
    },
    {
        id: 'too-many-sessions',
        match: (t) => t.includes('429'),
        text: '동시에 열려 있는 대화가 너무 많습니다. 쓰지 않는 대화를 닫고 잠시 뒤 다시 보내 주세요.'
    },
    {
        id: 'server',
        match: (t) => t.includes('500') || t.includes('502') || t.includes('503'),
        text: '서버에서 오류가 났습니다. 잠시 뒤 다시 보내 주세요.'
    },
    {
        // 위의 어느 것도 아니지만 저장 계층에서 난 것은 알아볼 수 있다. 원인을
        // 특정하지 못하더라도 "대화를 저장하다 실패했다" 는 것만 알려 줘도,
        // 사용자는 다시 보내면 되는지 기다려야 하는지를 판단할 수 있다.
        id: 'persist',
        match: (t) => t.includes('putobject') || t.includes('putstring') || t.includes('storagebase'),
        text: '대화를 저장하지 못해 메시지를 보내지 못했습니다. 잠시 뒤 다시 보내 주세요.'
    }
];

/**
 * 오류 객체에서 사람이 읽을 원문을 뽑는다.
 *
 * `cause` 사슬을 끝까지 따라간다. 저장 계층이 원본을 감싸기 때문이다
 * (`StorageBaseError('error in putObject', 원본)`). 겉만 보면 "error in putObject"
 * 하나뿐이라, 무엇 때문에 실패했는지가 통째로 가려진다.
 */
export function errorText(error) {
    if (!error) return '';
    if (typeof error === 'string') return error;

    const parts = [];
    const seen = new Set();
    let cur = error;
    while (cur && typeof cur === 'object' && !seen.has(cur)) {
        seen.add(cur);
        const m = (cur.message || '').toString().trim();
        if (m && !parts.includes(m)) parts.push(m);
        cur = cur.cause;
    }
    if (typeof cur === 'string' && cur.trim() && !parts.includes(cur.trim())) parts.push(cur.trim());
    if (parts.length === 0) return (error.toString?.() || '').toString();
    return parts.join(' ← ');
}

/**
 * 실패 원인을 사람 말로 옮긴다.
 *
 * @returns {{id: string, text: string, detail: string}}
 */
export function explainChatFailure(error, { online } = {}) {
    const detail = errorText(error);
    const probe = detail.toLowerCase();
    const found = CAUSES.find((c) => {
        try {
            return c.match(detail, { online }) || c.match(probe, { online });
        } catch {
            return false;
        }
    });
    if (found) return { id: found.id, text: found.text, detail };
    return {
        id: 'unknown',
        text: '메시지를 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
        detail
    };
}

/** 말풍선에 넣을 원문의 길이 상한. 넘으면 뒤를 자른다. */
export const DETAIL_MAX = 200;

/**
 * 원문을 사람이 읽을 만한 한 줄로 다듬는다.
 *
 * 다듬지 않으면 스택 트레이스가 통째로 말풍선에 들어가고("at https://…/index.js:47:53373"),
 * 계층마다 감싸며 같은 말이 서너 번 반복된다. 화면에서 실제로 그렇게 나왔다.
 */
export function tidyDetail(detail) {
    const firstLine = (detail || '').split('\n')[0].trim();
    if (!firstLine) return '';

    // 감싸인 계층이 같은 말을 여러 번 싣는다. 구분자도 계층마다 달라서("A: B", "A B")
    // 조각으로 잘라 비교하는 것만으로는 남는다. 바로 뒤에 되풀이되는 구절을 접는다.
    let collapsed = firstLine;
    for (let i = 0; i < 5; i++) {
        const next = collapsed.replace(/(\S.{3,}?)(?:[:\s]+\1)+/g, '$1');
        if (next === collapsed) break;
        collapsed = next;
    }

    // 그러고도 똑같이 되풀이되는 조각은 접는다.
    const kept = [];
    for (const piece of collapsed.split(/\s*(?:←|:)\s*/)) {
        const t = piece.trim();
        if (!t || kept.includes(t)) continue;
        kept.push(t);
    }
    const joined = kept.join(': ');
    return joined.length > DETAIL_MAX ? `${joined.slice(0, DETAIL_MAX)}…` : joined;
}

/**
 * 채팅 말풍선에 넣을 본문.
 *
 * 원인 설명을 먼저 쓰고, 원문은 뒤에 괄호로 붙인다. 사용자는 앞 문장만 읽어도
 * 무엇을 할지 알 수 있고, 문의가 들어오면 원문이 단서가 된다.
 */
export function chatFailureMessage(error, { online } = {}) {
    const { text, detail } = explainChatFailure(error, { online });
    const tidy = tidyDetail(detail);
    return tidy ? `⚠️ ${text}\n\n(원인: ${tidy})` : `⚠️ ${text}`;
}

/**
 * 저장 실패 차단기.
 *
 * 성공하면 0 으로 돌아가고, 연속 실패가 한도에 닿으면 더 부르지 않는다.
 * 애초의 사고가 "실패하는 저장을 계속 다시 부른 것" 이었다.
 */
export function createPersistCircuit(limit = PERSIST_FAILURE_LIMIT) {
    let failures = 0;
    let notified = false;
    return {
        get failures() {
            return failures;
        },
        /** 지금 저장을 시도해도 되는가. */
        shouldAttempt() {
            return failures < limit;
        },
        recordSuccess() {
            failures = 0;
            notified = false;
        },
        /** @returns {boolean} 이번 실패로 차단기가 처음 열렸는가(= 사용자에게 한 번 알릴 시점인가). */
        recordFailure() {
            failures += 1;
            if (failures >= limit && !notified) {
                notified = true;
                return true;
            }
            return false;
        },
        reset() {
            failures = 0;
            notified = false;
        }
    };
}
