/**
 * 에이전트가 만든 산출물 파일을 화면에서 가리킬 수 있게 한다.
 *
 * 워크아이템에는 파일의 **경로**만 적힌다 — 예: /workspace/.bpmn/<instId>/안내문.hwpx
 * 그 경로는 에이전트가 일하는 곳 안쪽이라 브라우저가 바로 열 수 없다.
 * deepagents 가 그 경로를 받아 파일을 내려주는 자리를 열어 두었고, 여기서 그 주소를 만든다.
 */

/** 워크스페이스 파일처럼 생긴 값인가. */
export function isWorkspacePath(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const v = value.trim();
    if (!v || v.includes(' ')) return false;
    // 이미 열 수 있는 주소면 그대로 쓰면 된다.
    if (/^(https?:)?\/\//.test(v) || v.startsWith('data:') || v.startsWith('blob:')) return false;
    return v.startsWith('/workspace/') || v.startsWith('workspace/');
}

/** 경로에서 파일 이름만. 화면에는 어디 있는지가 아니라 무엇인지가 필요하다. */
export function fileNameOf(value: string): string {
    return String(value).split('?')[0].split('#')[0].split(/[\\/]/).pop() || String(value);
}

/**
 * 내려받을 주소. inline 이면 브라우저가 열 수 있는 것은 열어 준다.
 *
 * 절대 주소로 돌려준다 — 받는 쪽(FileField 등)은 'http 로 시작하는가'로
 * 외부 파일인지를 가르고, 그렇지 않으면 스토리지에서 찾으려다 빈손으로 돌아온다.
 */
export function workspaceFileUrl(path: string, inline = false): string {
    // 괄호까지 감싼다 — 대화 본문은 [이름](주소) 꼴을 괄호로 끊어 읽으므로,
    // 파일 이름에 괄호가 있으면 링크가 중간에서 잘린다.
    const encoded = encodeURIComponent(path).replace(/\(/g, '%28').replace(/\)/g, '%29');
    const q = `path=${encoded}${inline ? '&inline=1' : ''}`;
    const base = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    return `${base}/deepagents/api/internal/workspace-file?${q}`;
}

/**
 * 폼 값에 들어 있는 작업 공간 경로를 바로 쓸 수 있는 주소로 바꿔 둔다.
 *
 * 에이전트가 남긴 값은 두 가지 모양이다 — 경로 문자열 그대로이거나,
 * {path, name, html_url} 처럼 감싼 꾸러미다. 어느 쪽이든 path 만 바꾸고
 * 나머지는 그대로 둔다.
 */
export function withWorkspaceUrl<T>(value: T): T {
    if (typeof value === 'string') {
        return (isWorkspacePath(value) ? workspaceFileUrl(value) : value) as unknown as T;
    }
    if (value && typeof value === 'object') {
        const v = value as Record<string, unknown>;
        const path = v.path || v.fullPath || v.file_path;
        if (isWorkspacePath(path)) {
            return { ...v, path: workspaceFileUrl(String(path)), name: v.name || fileNameOf(String(path)) } as unknown as T;
        }
    }
    return value;
}
