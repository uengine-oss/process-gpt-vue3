/**
 * 시간·비용·토큰 표시 형식.
 * BottleneckAnalysis.vue 가 갖고 있던 formatDuration 을 꺼내 공유한다.
 *
 * 단위(초/분/시간/일)는 로케일에 따라 달라지므로 i18n 을 거친다. 이 파일은 컴포넌트가
 * 아니라서 useI18n() 을 쓸 수 없고, main.ts 가 전역에 심어 둔 $i18n 을 쓴다
 * (stores/auth.ts 와 같은 방식). i18n 이 아직 없으면 한국어 기본형으로 떨어진다.
 */
const FALLBACK: Record<string, (p: Record<string, number | string>) => string> = {
    'duration.sec': (p) => `${p.n}초`,
    'duration.minSec': (p) => `${p.m}분 ${p.s}초`,
    'duration.hourMin': (p) => `${p.h}시간 ${p.m}분`,
    'duration.dayHour': (p) => `${p.d}일 ${p.h}시간`,
    'duration.day': (p) => `${p.d}일`,
    'duration.hour': (p) => `${p.h}시간`,
    'duration.min': (p) => `${p.m}분`
};

function unit(key: string, params: Record<string, number | string>): string {
    const i18n = (window as any)?.$i18n?.global;
    if (i18n && typeof i18n.t === 'function') {
        const text = i18n.t(key, params);
        // vue-i18n 은 키가 없으면 키 문자열을 그대로 돌려준다 — 그때는 기본형을 쓴다.
        if (text && text !== key) return text as string;
    }
    return FALLBACK[key](params);
}

export function formatDuration(seconds?: number | null): string {
    if (seconds === null || seconds === undefined) return '-';
    if (seconds < 60) return unit('duration.sec', { n: Math.round(seconds) });
    if (seconds < 3600) return unit('duration.minSec', { m: Math.floor(seconds / 60), s: Math.round(seconds % 60) });
    if (seconds < 86400) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return unit('duration.hourMin', { h, m });
    }
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    return unit('duration.dayHour', { d, h });
}

export function formatMs(ms?: number | null): string {
    if (ms === null || ms === undefined) return '-';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return unit('duration.sec', { n: (ms / 1000).toFixed(2) });
    return formatDuration(ms / 1000);
}

export function formatTokens(n?: number | null): string {
    if (!n) return '-';
    if (n < 1000) return String(n);
    return `${(n / 1000).toFixed(1)}k`;
}

export function formatCost(usd?: number | null): string {
    if (usd === null || usd === undefined) return '-';
    if (usd === 0) return '$0';
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
}

/**
 * 긴 대기를 사람이 읽는 단위로. "3일 12시간" 처럼 두 단위까지만 쓴다 —
 * 리드타임이 며칠인데 초 단위까지 붙으면 오히려 안 읽힌다.
 */
export function formatDurationLong(seconds?: number | null): string {
    if (seconds === null || seconds === undefined) return '-';
    const s = Math.max(Math.round(seconds), 0);
    if (s < 60) return unit('duration.sec', { n: s });

    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);

    if (d > 0) return h > 0 ? unit('duration.dayHour', { d, h }) : unit('duration.day', { d });
    if (h > 0) return m > 0 ? unit('duration.hourMin', { h, m }) : unit('duration.hour', { h });
    return unit('duration.min', { m });
}

export function useDuration() {
    return { formatDuration, formatMs, formatTokens, formatCost, formatDurationLong };
}
