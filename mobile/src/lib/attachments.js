/**
 * 첨부.
 *
 * 포털 채팅은 사진과 파일을 함께 보낼 수 있다. 앱에서 못 보내면 "사진 한 장
 * 보내려고 노트북을 켠다" 가 되어, 정작 휴대폰을 쓰는 상황(현장 사진, 영수증,
 * 스캔한 서류)에서 앱이 쓸모없어진다.
 *
 * 저장 모양은 **포털이 쓰는 것과 같아야 한다.** 앱에서 보낸 사진이 웹에서는 안
 * 보이거나 그 반대가 되면, 같은 대화가 기기마다 다르게 남는다.
 *   사진: { id, url }            → 메시지의 `image`(1장) / `images`(여러 장)
 *   파일: { fileName, fileUrl, publicUrl, fullPath, path, fileType, fileSize }
 */

/** 포털 입력창의 accept 와 같다. */
export const FILE_ACCEPT =
    'image/*,.pdf,.doc,.docx,.hwp,.hwpx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.json,.md,.markdown,.yaml,.yml,.xml,.html,.htm,.js,.ts,.jsx,.tsx,.py,.java,.go,.rs,.sql,.sh,.env,.ini,.toml,.log,.zip';

export const IMAGE_ACCEPT = 'image/*';

/** 한 번에 올릴 수 있는 크기. 넘으면 올리는 중에 끊기고 이유를 알 수 없다. */
export const MAX_BYTES = 25 * 1024 * 1024;

export function isImage(file) {
    return Boolean(file && (file.type || '').startsWith('image/'));
}

/**
 * 같은 것을 두 번 고르면 하나로 본다.
 *
 * 사진첩에서 골랐다가 다시 열어 또 고르는 일이 흔하다. 그대로 두면 같은 사진이
 * 두 번 올라가고 두 번 보인다.
 */
export function dedupe(files) {
    const seen = new Set();
    const out = [];
    for (const f of Array.isArray(files) ? files : []) {
        if (!f) continue;
        const key = `${f.name}|${f.size}|${f.lastModified}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(f);
    }
    return out;
}

/** 너무 큰 것을 미리 걸러 낸다. 올리다 실패하는 것보다 먼저 말하는 편이 낫다. */
export function tooBig(file, max = MAX_BYTES) {
    return Number.isFinite(file?.size) && file.size > max;
}

/** "2.4 MB" 처럼. 바이트 숫자는 사람이 읽지 못한다. */
export function sizeText(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 저장소에 올릴 경로.
 *
 * 파일 이름에 한글이나 공백이 있으면 저장소가 400 으로 거절한다. 포털과 같은
 * 규칙으로, 그런 이름은 무작위 식별자로 바꾸고 확장자만 남긴다.
 */
export function storagePath(name, id) {
    const original = (name || '').toString();
    const dot = original.lastIndexOf('.');
    const rawExt = dot > -1 ? original.slice(dot) : '';
    const ext = /^\.[0-9A-Za-z]+$/.test(rawExt) ? rawExt : '';
    const unsafe = !original || /[^0-9A-Za-z._-]/.test(original);
    return unsafe ? `uploads/${id}${ext}` : `uploads/${original}`;
}

/**
 * 올린 결과를 포털이 읽는 모양으로 바꾼다.
 *
 * 서버가 주는 주소 이름이 응답마다 달라(public_url · publicUrl · fullPath …)
 * 하나만 보면 어떤 경로에서는 주소가 비어 사진이 깨진다.
 */
export function toFileInfo(file, result) {
    const url =
        result?.public_url ||
        result?.publicUrl ||
        result?.fullPath ||
        result?.fileUrl ||
        result?.url ||
        result?.path ||
        '';

    return {
        fileName: file?.name || '',
        name: file?.name || '',
        fileUrl: url,
        publicUrl: result?.publicUrl || url,
        fullPath: result?.fullPath || url,
        path: result?.path || '',
        fileType: file?.type || '',
        fileSize: Number.isFinite(file?.size) ? file.size : null
    };
}

/** 올리지 못한 것도 목록에는 남긴다 — 사라지면 사용자는 보냈다고 믿는다. */
export function toFailedFileInfo(file, message) {
    return {
        ...toFileInfo(file, null),
        uploadError: true,
        uploadErrorMessage: message || '올리지 못했습니다.'
    };
}

/**
 * 보낼 수 있는 첨부인가. 주소가 없으면 상대는 아무것도 열지 못한다.
 *
 * 주소가 들어 있는 칸 이름이 하나가 아니다. 서버가 준 것은 `fileUrl` 계열이고,
 * 저장된 메시지에서 다시 꺼낸 것(messageAttachments)은 `url` 이다.
 * `url` 을 빼먹으면 지난 대화의 파일이 **전부 걸러져** 에이전트가 문서를 잊는다 —
 * 실제로 그래서 다음 턴마다 "첨부된 문서가 없습니다" 가 나왔다.
 */
export function isUsable(info) {
    if (!info || info.uploadError) return false;
    return Boolean(info.fileUrl || info.publicUrl || info.fullPath || info.path || info.url);
}

/**
 * 붙여넣기에서 사진을 꺼낸다.
 *
 * 화면을 캡처해 바로 붙여넣는 쓰임이 흔하다. 이것이 없으면 사용자는 한 번
 * 파일로 저장한 뒤 다시 골라야 한다.
 */
export function imagesFromClipboard(clipboardData) {
    const items = clipboardData?.items ? Array.from(clipboardData.items) : [];
    return items
        .filter((it) => it?.kind === 'file' && (it.type || '').startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter(Boolean);
}

/**
 * 저장된 메시지에서 첨부를 꺼낸다.
 *
 * 포털은 사진을 한 장일 때 `image`, 여러 장일 때 `images` 로 저장해 왔다.
 * 한쪽만 읽으면 옛 대화의 사진이 통째로 안 보인다.
 */
export function messageAttachments(message) {
    const images = [];
    const seen = new Set();

    const pushImage = (value) => {
        const url = typeof value === 'string' ? value : value?.url || value?.publicUrl || value?.fileUrl || '';
        if (!url || seen.has(url)) return;
        seen.add(url);
        images.push({ url });
    };

    if (message?.image) pushImage(message.image);
    for (const i of Array.isArray(message?.images) ? message.images : []) pushImage(i);

    const files = (Array.isArray(message?.files) ? message.files : [])
        .filter(Boolean)
        .map((f) => ({
            name: f.fileName || f.name || '첨부파일',
            url: f.fileUrl || f.publicUrl || f.fullPath || f.path || '',
            size: Number.isFinite(f.fileSize) ? f.fileSize : null
        }));

    return { images, files };
}

/**
 * 고른 것들을 올린다.
 *
 * 사진과 그 밖의 파일은 가는 곳이 다르다 — 포털과 같다.
 *   사진: 저장소에 바로 올리고 주소를 받는다
 *   파일: memento 를 거친다. 거기서 내용을 읽어 두어야 에이전트가 그 문서를
 *         근거로 답할 수 있다. 저장소에만 올리면 "첨부는 됐는데 못 읽는" 상태다.
 *
 * 하나가 실패해도 나머지는 보낸다. 다 막아 버리면 사진 한 장 때문에 쓴 글까지
 * 못 보낸다. 대신 무엇이 실패했는지는 반드시 돌려준다.
 */
export async function uploadAll(files, deps) {
    const list = dedupe(files);
    const images = [];
    const uploaded = [];
    const errors = [];

    for (const file of list) {
        if (tooBig(file, deps.maxBytes || MAX_BYTES)) {
            errors.push(`${file.name}: 너무 큽니다 (${sizeText(file.size)})`);
            continue;
        }

        try {
            if (isImage(file)) {
                const path = storagePath(file.name, deps.uuid());
                const result = await deps.uploadImage(path, file);
                const url = result?.path ? await deps.getImageUrl(result.path) : '';
                if (!url) throw new Error('주소를 받지 못했습니다.');
                images.push({ id: `${file.name}-${file.size}`, url });
            } else {
                const result = await deps.uploadFileToStorage(file, deps.roomId ? { room_id: deps.roomId } : {});
                const info = toFileInfo(file, result);
                if (!isUsable(info)) throw new Error('주소를 받지 못했습니다.');
                uploaded.push(info);
            }
        } catch (e) {
            errors.push(`${file.name}: ${e?.message || '올리지 못했습니다.'}`);
            if (!isImage(file)) uploaded.push(toFailedFileInfo(file, e?.message));
        }
    }

    return { images, files: uploaded, errors };
}
