// 답변의 인용 `[[<path> › <섹션 제목> · bS-bE · p.N · "발췌"]]` 을 누를 수 있는 번호로 바꾸고 끝에 출처 목록을 붙인다.
// 블록·쪽은 없을 수 있고 발췌가 앵커다(블록이나 발췌 중 하나는 있어야 한다). 형식은 process-gpt-codex docs/specs/workspace.md.
// 마크다운을 HTML 로 바꾼 뒤에 처리한다(인라인 코드로 감싸도 잡는다). `~` 는 escapeSingleTildes 가 &#126; 로 바꿔 둔다.
const DASH = '(?:[-–~]|&#126;)';
const CITE = new RegExp(
    '(?:<code>)?\\[\\[\\s*([^[\\]›<]+?)\\s*›\\s*([^[\\]<]*?)' +
        `(?:\\s*·\\s*b(\\d+)(?:\\s*${DASH}\\s*b?(\\d+))?)?` +
        `(?:\\s*·\\s*p\\.?\\s*(\\d+)(?:\\s*${DASH}\\s*\\d+)?)?` +
        '(?:\\s*·\\s*(?:&quot;|["“])([^"”[\\]<]*?)(?:&quot;|["”]))?' +
        '\\s*\\]\\](?:<\\/code>)?',
    'g'
);

function decode(text) {
    const el = document.createElement('textarea');
    el.innerHTML = text;
    return el.value;
}

function esc(text) {
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function anchor(cls, cite, inner, title) {
    return (
        `<a href="#" class="${cls}" data-kb-path="${esc(cite.path)}" data-kb-start="${cite.start ?? ''}" ` +
        `data-kb-end="${cite.end ?? ''}" data-kb-page="${cite.page ?? ''}" data-kb-quote="${esc(cite.quote || '')}" ` +
        `data-kb-title="${esc(cite.title || '')}" ` +
        `title="${esc(title)}">${inner}</a>`
    );
}

export function withKbCitations(html) {
    if (typeof html !== 'string' || html.indexOf('[[') < 0) return html;
    const order = new Map();
    const list = [];
    const body = html.replace(CITE, (match, rawPath, rawTitle, s, e, pg, rawQuote) => {
        const quote = rawQuote ? decode(rawQuote.trim()) : '';
        if (!s && !quote) return match;
        const path = decode(rawPath.trim());
        const title = decode(rawTitle.trim());
        const a = s ? Number(s) : null;
        const b = s ? Number(e || s) : null;
        const cite = {
            path,
            title,
            quote,
            start: s ? Math.min(a, b) : null,
            end: s ? Math.max(a, b) : null,
            page: pg ? Number(pg) : null
        };
        const key = `${cite.path}|${cite.start}|${cite.end}|${quote}`;
        if (!order.has(key)) {
            order.set(key, list.length + 1);
            list.push({ ...cite, n: list.length + 1 });
        }
        const tip = quote ? `${path} › ${title}\n“${quote}”` : `${path} › ${title}`;
        return anchor('kb-cite', cite, String(order.get(key)), tip);
    });
    if (!list.length) return html;
    // 같은 문서·섹션을 여러 번 인용하면 한 줄로 묶고 번호만 나열한다.
    const groups = new Map();
    for (const c of list) {
        const key = `${c.path}|${c.title}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
    }
    const items = [...groups.values()]
        .map((cites) => {
            const [first] = cites;
            const name = anchor('kb-cite-item', first, `${esc(first.path.split('/').pop())} › ${esc(first.title)}`, `${first.path} › ${first.title}`);
            const numbers = cites.map((c) => anchor('kb-cite', c, String(c.n), c.quote ? `“${c.quote}”` : c.path)).join('');
            return `<span class="kb-cite-group">${name}${numbers}</span>`;
        })
        .join('');
    return `${body}<div class="kb-cite-list"><div class="kb-cite-list__label">출처</div>${items}</div>`;
}
