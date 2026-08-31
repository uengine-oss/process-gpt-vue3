export interface ReviewVersionedItem {
    review_id?: string | null;
    proc_def_id?: string | null;
    process_name?: string | null;
    version?: string | number | null;
    version_label?: string | null;
    major_version?: number | null;
    minor_version?: number | null;
    submitted_at?: string | null;
    updated_at?: string | null;
    created_at?: string | null;
}

export interface ReviewVersionGroup<T> {
    key: string;
    procDefId: string;
    processName: string;
    latest: T;
    previousVersions: T[];
    items: T[];
}

interface ParsedVersion {
    major: number;
    minor: number;
    raw: number;
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function parseVersionParts(item: ReviewVersionedItem): ParsedVersion {
    const majorVersion = toNumber(item.major_version);
    const minorVersion = toNumber(item.minor_version);

    if (majorVersion !== null || minorVersion !== null) {
        return {
            major: majorVersion ?? 0,
            minor: minorVersion ?? 0,
            raw: majorVersion ?? 0
        };
    }

    const versionText = String(item.version_label || item.version || '').trim();
    const labelMatch = versionText.match(/v?\s*(\d+)(?:\.(\d+))?/i);
    if (labelMatch) {
        return {
            major: Number(labelMatch[1] || 0),
            minor: Number(labelMatch[2] || 0),
            raw: Number(labelMatch[1] || 0)
        };
    }

    return {
        major: 0,
        minor: 0,
        raw: toNumber(item.version) ?? 0
    };
}

function getTimestamp(item: ReviewVersionedItem): number {
    const candidates = [item.submitted_at, item.updated_at, item.created_at];
    for (const value of candidates) {
        if (!value) continue;
        const parsed = new Date(value).getTime();
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

export function compareReviewItemsByVersionRecency<T extends ReviewVersionedItem>(a: T, b: T): number {
    const left = parseVersionParts(a);
    const right = parseVersionParts(b);

    if (left.major !== right.major) return right.major - left.major;
    if (left.minor !== right.minor) return right.minor - left.minor;
    if (left.raw !== right.raw) return right.raw - left.raw;

    const leftTimestamp = getTimestamp(a);
    const rightTimestamp = getTimestamp(b);
    if (leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp;

    return String(b.review_id || '').localeCompare(String(a.review_id || ''));
}

export function groupReviewItemsByProcess<T extends ReviewVersionedItem>(items: T[]): ReviewVersionGroup<T>[] {
    const groups = new Map<string, T[]>();

    for (const item of items) {
        const key = String(item.proc_def_id || item.review_id || '').trim();
        if (!key) continue;
        const bucket = groups.get(key) || [];
        bucket.push(item);
        groups.set(key, bucket);
    }

    return Array.from(groups.entries())
        .map(([key, bucket]) => {
            const sortedItems = [...bucket].sort(compareReviewItemsByVersionRecency);
            return {
                key,
                procDefId: key,
                processName: String(sortedItems[0]?.process_name || '').trim(),
                latest: sortedItems[0],
                previousVersions: sortedItems.slice(1),
                items: sortedItems
            };
        })
        .sort((a, b) => compareReviewItemsByVersionRecency(a.latest, b.latest));
}
