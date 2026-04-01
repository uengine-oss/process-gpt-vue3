function fallbackHash(content) {
    let hash = 2166136261;

    for (let i = 0; i < content.length; i += 1) {
        hash ^= content.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return `fallback-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export async function calculateContentHash(content) {
    const text = String(content ?? '');

    if (globalThis?.crypto?.subtle?.digest) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    return fallbackHash(text);
}
