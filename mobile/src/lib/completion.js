/**
 * 완료 요청이 실제로 성공했는가.
 *
 * 왜 따로 판단해야 하는가
 *   공용 axios 는 실패를 **Error 가 아니라 응답 본문 그대로** 거절한다
 *   (src/utils/axios.ts: `Promise.reject(error.response.data ...)`).
 *   그리고 putWorkItemComplete 는 그것을 catch 해서 `return error` 로 돌려준다.
 *   그래서 `result instanceof Error` 만 보면 404 도 통과해 버린다 —
 *   실제로 서버가 404 를 냈는데 화면은 목록으로 돌아가 완료된 것처럼 보였다.
 *   업무를 처리했다고 믿고 넘어가는 것이 가장 나쁜 실패다.
 */

/** 서버가 실패를 알리는 칸들. FastAPI 는 `detail`, 그 밖에는 `error`/`message`. */
const ERROR_KEYS = ['detail', 'error', 'errors', 'cannotProceedErrors'];

export function completionFailed(result) {
    if (result instanceof Error) return true;

    // 빈 응답. 무엇이 됐는지 알 수 없으면 됐다고 보지 않는다.
    if (result === null || result === undefined) return true;

    if (typeof result === 'string') return false;
    if (typeof result !== 'object') return false;

    return ERROR_KEYS.some((key) => {
        const value = result[key];
        if (value === null || value === undefined) return false;
        if (Array.isArray(value)) return value.length > 0;
        return Boolean(value);
    });
}

/**
 * 왜 실패했는지 사람이 읽을 한 줄.
 *
 * "제출하지 못했습니다" 만 보여 주면 다시 눌러 보는 것 말고 할 수 있는 일이 없다.
 */
export function failureText(result) {
    const fallback = '제출하지 못했습니다. 다시 시도해 주세요.';
    if (result instanceof Error) return result.message || fallback;
    if (!result || typeof result !== 'object') return fallback;

    for (const key of ERROR_KEYS) {
        const value = result[key];
        if (typeof value === 'string' && value.trim()) return `제출하지 못했습니다 — ${value.trim()}`;
        if (Array.isArray(value) && value.length) {
            const first = value[0];
            const text = typeof first === 'string' ? first : first?.message || first?.type;
            if (text) return `제출하지 못했습니다 — ${text}`;
        }
    }
    return fallback;
}
