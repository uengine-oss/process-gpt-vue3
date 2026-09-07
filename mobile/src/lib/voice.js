/**
 * 말로 입력하기.
 *
 * 포털과 같은 경로를 쓴다 — 녹음한 소리를 `/completion/upload` 로 보내면
 * 받아쓴 글이 돌아온다. 다른 방법을 쓰면 인식 품질이 화면마다 달라진다.
 *
 * 휴대폰에서 특히 쓸모가 있다. 작은 자판으로 긴 의견을 적는 것보다 말하는 편이
 * 훨씬 빠르고, 현장에서 한 손으로 쓰는 상황이 많다.
 */

/** 이 기기에서 녹음이 가능한가. */
export function canRecord(nav = globalThis.navigator, win = globalThis) {
    return Boolean(nav?.mediaDevices?.getUserMedia && win?.MediaRecorder);
}

/**
 * 왜 안 되는지 사용자가 할 수 있는 일로 바꿔 말한다.
 *
 * "NotAllowedError" 를 그대로 보여 주면 무엇을 해야 할지 알 수 없다.
 */
export function reasonText(reason) {
    if (reason === 'denied') return '마이크 사용을 허용해 주세요.';
    if (reason === 'unsupported') return '이 기기에서는 음성 입력을 쓸 수 없습니다.';
    if (reason === 'empty') return '소리가 녹음되지 않았습니다. 다시 시도해 주세요.';
    if (reason === 'failed') return '받아쓰지 못했습니다. 다시 시도해 주세요.';
    return '음성 입력에 실패했습니다.';
}

/** 권한 거부인가. 그 밖의 실패와 안내가 달라야 한다. */
export function isDenied(error) {
    const name = (error?.name || '').toString();
    return name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError';
}

/**
 * 녹음을 시작한다. 멈추는 함수를 돌려준다.
 *
 * 멈추면 녹음된 소리 덩어리가 나온다. 마이크는 반드시 놓아 준다 — 놓지 않으면
 * 안드로이드 상단에 녹음 표시가 계속 남아 사용자가 불안해한다.
 */
export async function startRecording({ nav = globalThis.navigator, win = globalThis } = {}) {
    if (!canRecord(nav, win)) return { ok: false, reason: 'unsupported' };

    let stream;
    try {
        stream = await nav.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
        return { ok: false, reason: isDenied(e) ? 'denied' : 'failed' };
    }

    const recorder = new win.MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => {
        if (e?.data) chunks.push(e.data);
    };
    recorder.start();

    return {
        ok: true,
        stop: () =>
            new Promise((resolve) => {
                const finish = () => {
                    // 마이크를 놓지 않으면 녹음 표시가 계속 남는다.
                    try {
                        stream.getTracks().forEach((t) => t.stop());
                    } catch (_e) {}
                    resolve(chunks.length ? new win.Blob(chunks, { type: 'audio/wav' }) : null);
                };
                if (recorder.state === 'recording') {
                    recorder.onstop = finish;
                    recorder.stop();
                } else {
                    finish();
                }
            })
    };
}

/**
 * 받아쓴다.
 *
 * @param {Blob} blob
 * @param {{post: Function}} deps  axios 같은 것
 */
export async function transcribe(blob, { post }) {
    if (!blob) return { ok: false, reason: 'empty' };

    const form = new FormData();
    form.append('audio', blob);

    try {
        const response = await post('/completion/upload', form);
        const text = (response?.data?.transcript || '').toString().trim();
        if (!text) return { ok: false, reason: 'empty' };
        return { ok: true, text };
    } catch (_e) {
        return { ok: false, reason: 'failed' };
    }
}

/**
 * 받아쓴 글을 지금 쓰고 있던 글 뒤에 잇는다.
 *
 * 덮어쓰면 이미 적어 둔 것이 사라진다. 말로 덧붙이는 쓰임이 더 흔하다.
 */
export function appendTranscript(current, text) {
    const before = (current || '').toString().trimEnd();
    const added = (text || '').toString().trim();
    if (!added) return current || '';
    return before ? `${before} ${added}` : added;
}
