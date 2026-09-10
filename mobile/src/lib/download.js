/**
 * 만들어진 문서·산출물을 기기로 내려받는다.
 *
 * 왜 앱에서 따로 다뤄야 하는가
 *   앱 화면은 Capacitor 가 띄우는 내부 서버 위에 있다. 여기서 `<a download>`
 *   를 누르면 내부 서버가 그 파일을 모르기 때문에 아무 일도 일어나지 않는다.
 *   실패조차 조용해서 사용자는 눌렀는데 왜 안 되는지 알 수 없다.
 *
 *   그래서 **바깥 브라우저로 넘긴다.** 안드로이드·iOS 모두 그쪽이 내려받기와
 *   미리보기를 맡아 주고, 사용자가 아는 방식으로 파일이 저장된다.
 */

/** 내려받을 수 있는 주소인가. 없는 주소로 버튼을 만들면 눌러도 아무 일이 없다. */
export function downloadUrl(file) {
    const url = file?.url || file?.fileUrl || file?.publicUrl || file?.fullPath || file?.path || '';
    return String(url).trim();
}

/** 저장될 이름. 없으면 주소 끝을 쓴다. */
export function downloadName(file) {
    const name = String(file?.name || file?.fileName || '').trim();
    if (name) return name;

    const url = downloadUrl(file);
    const last = url.split('?')[0].split('#')[0].split('/').pop() || '';
    return decodeURIComponent(last) || '첨부파일';
}

/**
 * 내려받기.
 *
 * @returns {{ok: boolean, reason?: string}}
 */
export function download(file, win = globalThis) {
    const url = downloadUrl(file);
    if (!url) return { ok: false, reason: 'no-url' };

    // 앱이면 기기의 브라우저로 넘긴다. 브라우저면 새 탭이 곧 그 역할이다.
    const opener = win?.Capacitor?.Plugins?.Browser;
    try {
        if (opener?.open) {
            void opener.open({ url });
            return { ok: true };
        }
        win?.open?.(url, '_blank', 'noopener');
        return { ok: true };
    } catch (_e) {
        return { ok: false, reason: 'failed' };
    }
}

/** 왜 안 됐는지 사람이 할 수 있는 일로 바꿔 말한다. */
export function reasonText(reason) {
    if (reason === 'no-url') return '내려받을 주소가 없습니다.';
    return '내려받지 못했습니다. 다시 시도해 주세요.';
}
