import { mimeIcon } from '@/utils/fileIcon';

const EXT_MIME = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    hwp: 'application/x-hwp',
    hwpx: 'application/vnd.hancom.hwpx',
    md: 'text/markdown',
    txt: 'text/plain',
    csv: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg'
};

export function extOf(name) {
    return (name || '').split('.').pop()?.toLowerCase() || '';
}

export function iconOf(name) {
    return mimeIcon(EXT_MIME[extOf(name)] || '');
}

export function formatBytes(b) {
    if (b == null || Number.isNaN(Number(b))) return '-';
    const n = Number(b);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function leafOf(path) {
    const segs = (path || '').split('/').filter(Boolean);
    return segs[segs.length - 1] || '';
}

export function parentOf(path) {
    const p = (path || '').replace(/^\/+|\/+$/g, '');
    return p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
}

export function ancestorsOf(path) {
    const out = [];
    let acc = '';
    for (const s of (path || '').split('/').filter(Boolean)) {
        acc = acc ? `${acc}/${s}` : s;
        out.push(acc);
    }
    return out;
}
