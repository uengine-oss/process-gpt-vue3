const STATUS_LABELS: Record<string, string> = {
    OPEN: '검토 대기',
    CHANGES_REQUESTED: '변경 요청됨',
    APPROVED: '승인됨',
    MERGED: '병합됨',
    CLOSED: '닫힘'
};

const STATUS_COLORS: Record<string, string> = {
    OPEN: 'primary',
    CHANGES_REQUESTED: 'warning',
    APPROVED: 'success',
    MERGED: 'deep-purple',
    CLOSED: 'default'
};

const BADGE_CLASSES: Record<string, string> = {
    OPEN: 'st-open',
    CHANGES_REQUESTED: 'st-chg',
    APPROVED: 'st-app',
    MERGED: 'st-merged',
    CLOSED: 'st-closed'
};

const ACCENT_CLASSES: Record<string, string> = {
    OPEN: 'ac-open',
    CHANGES_REQUESTED: 'ac-chg',
    APPROVED: 'ac-app',
    MERGED: 'ac-merged',
    CLOSED: 'ac-closed'
};

const AVATAR_COLORS = [
    '#2F6BFF', '#E0822B', '#22A05B', '#8268D8',
    '#E04848', '#0097A7', '#7B1FA2', '#C62828'
];

export function prStatusLabel(status: string): string {
    return STATUS_LABELS[status] || status;
}

export function prStatusColor(status: string): string {
    return STATUS_COLORS[status] || 'default';
}

export function prBadgeClass(status: string): string {
    return BADGE_CLASSES[status] || 'st-open';
}

export function prAccentClass(status: string): string {
    return ACCENT_CLASSES[status] || 'ac-open';
}

export function getInitial(name: string | null | undefined): string {
    if (!name) return '?';
    if (/[가-힣]/.test(name)) return name[0];
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase();
}

export function getAvatarColor(name: string | null | undefined): string {
    if (!name) return '#9E9E9E';
    let h = 0;
    for (let i = 0; i < name.length; i++) {
        h = name.charCodeAt(i) + ((h << 5) - h);
    }
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function shortBranch(branch: string | null | undefined): string {
    if (!branch || branch.length <= 26) return branch || '';
    const parts = branch.split('/');
    if (parts.length > 1) return parts[0] + '/…' + parts[parts.length - 1].slice(-10);
    return branch.slice(0, 10) + '…' + branch.slice(-8);
}

export function formatRelativeTime(ts: string | null | undefined): string {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    const ms = Date.now() - d.getTime();
    if (ms < 0) return d.toLocaleString();
    const m = Math.floor(ms / 60000);
    if (m < 1) return '방금';
    const h = Math.floor(m / 60);
    if (h < 1) return `${m}분 전`;
    const day = Math.floor(h / 24);
    if (day < 1) return `${h}시간 전`;
    if (day === 1) return '어제';
    if (day < 7) return `${day}일 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function formatDate(ts: string | null | undefined): string {
    if (!ts) return '';
    try {
        return new Date(ts).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return String(ts);
    }
}
