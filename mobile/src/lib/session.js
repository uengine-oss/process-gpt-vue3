/**
 * 로그인 상태 다루기.
 *
 * 포털과 같은 Supabase 세션을 쓴다. 앱이 따로 계정을 두지 않으므로 웹에서 쓰던
 * 아이디로 그대로 들어오고, 권한도 웹과 똑같이 적용된다.
 */

/** 지금 로그인돼 있는가. 없으면 null. */
export async function currentSession(supabase = globalThis.$supabase) {
    if (!supabase?.auth) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
}

/**
 * 로그인이 왜 안 됐는지 가른다.
 *
 * 왜 가르는가
 *   서버에 닿지도 못한 것과 아이디·비밀번호가 틀린 것은 사용자가 할 일이 다르다.
 *   앞은 연결을 확인해야 하고, 뒤는 입력을 고쳐야 한다. 둘을 뭉뚱그리면 네트워크가
 *   막혔을 때 "비밀번호가 틀렸다" 고 말하게 되고, 사용자는 맞는 비밀번호를 계속
 *   다시 친다. 실제로 겪은 일이다 — 에뮬레이터에서 평문 통신이 막혔는데 화면에는
 *   비밀번호 오류로 떴다.
 *
 * 어떻게 가르는가
 *   서버가 답을 했으면 그 답에 HTTP 상태가 실린다. 닿지 못했으면 상태가 없다.
 *   Supabase 는 재시도 가능한 통신 실패를 AuthRetryableFetchError 로 알려 주기도 한다.
 *
 * 무엇을 감추는가
 *   서버가 거절한 경우에는 이유를 더 나누지 않는다. "없는 계정" 과 "비밀번호 틀림"
 *   을 구분해 주면 그것으로 계정이 있는지 확인할 수 있다. 통신 실패는 계정과
 *   무관하므로 알려 줘도 아무것도 노출되지 않는다.
 */
export function classifyAuthError(error) {
    if (!error) return null;

    const name = (error.name || '').toString();
    const message = (error.message || '').toString().toLowerCase();

    if (name === 'AuthRetryableFetchError') return 'offline';
    // 브라우저·웹뷰가 요청 자체를 막거나 실패시킨 경우.
    if (message.includes('failed to fetch') || message.includes('networkerror')) return 'offline';
    if (message.includes('load failed')) return 'offline'; // 사파리/웹킷의 표현

    const status = Number(error.status);
    // 서버까지 갔고 거절당했다.
    if (Number.isFinite(status) && status > 0) {
        // 너무 자주 시도해 잠긴 경우는 비밀번호 문제가 아니다.
        if (status === 429) return 'too-many';
        return 'rejected';
    }

    // 상태가 없으면 서버 답이 아니다.
    return 'offline';
}

/**
 * 아이디와 비밀번호로 들어간다.
 *
 * 던져진 예외도 같은 방식으로 가른다 — 어떤 실패는 반환이 아니라 예외로 온다.
 */
export async function signIn(email, password, supabase = globalThis.$supabase) {
    if (!supabase?.auth) return { ok: false, reason: 'unavailable' };

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: (email || '').trim(),
            password: password || ''
        });
        if (error) return { ok: false, reason: classifyAuthError(error) };
        return { ok: true, session: data?.session || null };
    } catch (e) {
        return { ok: false, reason: classifyAuthError(e) || 'offline' };
    }
}

export async function signOut(supabase = globalThis.$supabase) {
    if (!supabase?.auth) return;
    await supabase.auth.signOut();
}
