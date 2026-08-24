export function toSafeText(value: unknown, fallback = ''): string {
    if (value === null || value === undefined) return fallback;

    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    if (typeof value === 'symbol') return value.description || fallback;

    if (Array.isArray(value)) {
        return value.map((item) => toSafeText(item)).filter(Boolean).join(' ');
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
    }

    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        for (const key of ['name', 'title', 'label', 'text', 'displayName', 'id', 'value', 'key']) {
            try {
                const candidate = record[key];
                if (candidate !== null && candidate !== undefined && candidate !== value) {
                    const text = toSafeText(candidate);
                    if (text) return text;
                }
            } catch {
                // Ignore non-readable proxy fields.
            }
        }

        try {
            const json = JSON.stringify(value);
            return typeof json === 'string' ? json : fallback;
        } catch {
            return fallback;
        }
    }

    try {
        return String(value);
    } catch {
        return fallback;
    }
}
