/**
 * BPMN 캔버스용 디자인 토큰 해석기.
 *
 * bpmn-js 는 SVG **속성**(`fill`, `stroke`)에 색을 직접 써 넣는다. SVG 속성값은
 * `var(--x)` 를 해석하지 못하므로(CSS 속성일 때만 가능), 토큰을 실제 색으로
 * 바꿔서 넘겨야 한다. 여기서 그 변환을 담당한다.
 *
 * 반환값은 **항상 불투명 `#rrggbb`** 이다. 렌더러가 채움색의 명도를 계산해
 * 글자색(흰색/검정)을 고르는데(`getRelativeLuminance`), 그 파서가 hex 만 읽기
 * 때문이다. hsl()/rgba() 를 그대로 넘기면 명도 0으로 계산돼 밝은 배경 위에
 * 흰 글자가 찍힌다.
 *
 * 다크 모드로 바꾸면 토큰 값이 달라지므로 캐시를 비우고 다시 그려야 한다
 * (`resetDsPaletteCache()` — `src/ds/mode.ts` 가 호출한다).
 */

/** 토큰 이름 → [CSS 변수 또는 hsl 채널 변수, 폴백 hex] */
const TOKENS = {
    // 도형 본체
    surface: { var: '--cds-surface-2', fallback: '#ffffff' },
    surfaceMuted: { channels: '--bg-300', fallback: '#efeeea' },
    // 외곽선
    stroke: { channels: '--text-400', fallback: '#77756f' },
    strokeSoft: { channels: '--text-500', fallback: '#a8a7a2' },
    // 글자
    text: { var: '--cds-text-primary', fallback: '#0b0b0b' },
    textSecondary: { var: '--cds-text-secondary', fallback: '#52514e' },
    textMuted: { var: '--cds-text-muted', fallback: '#898781' },
    onBrand: { fallback: '#ffffff' },
    // 상태
    brand: { channels: '--accent-brand', fallback: '#d97757' },
    danger: { var: '--cds-text-danger', fallback: '#8e2626' },
    accent: { var: '--cds-text-accent', fallback: '#184f95' },
    warning: { var: '--cds-text-warning', fallback: '#734500' },
    warningBg: { channels: '--accent-brand', fallback: '#d97757' }
};

let cache = null;

function readVar(name) {
    if (!name || typeof window === 'undefined') return '';
    try {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    } catch {
        return '';
    }
}

/**
 * 임의의 CSS 색 문자열을 불투명 #rrggbb 로 정규화한다.
 * 브라우저가 `rgb(r, g, b)` 로 계산해 주는 것을 이용한다.
 * 알파가 있으면 흰 배경 위에 합성한 값으로 만든다.
 */
function toHex(cssColor) {
    if (!cssColor || typeof document === 'undefined') return null;
    if (/^#[0-9a-f]{6}$/i.test(cssColor)) return cssColor.toLowerCase();

    const probe = document.createElement('span');
    probe.style.display = 'none';
    probe.style.color = cssColor;
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();

    const m = computed.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;

    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    const [r, g, b] = parts;
    const a = parts.length > 3 ? parts[3] : 1;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;

    // 알파가 있으면 흰 배경 위에 합성 (캔버스 배경이 밝은 표면이라는 전제)
    const mix = (c) => Math.round(a * c + (1 - a) * 255);
    const hex = (c) => mix(c).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function build() {
    const out = {};
    for (const [key, spec] of Object.entries(TOKENS)) {
        let raw = '';
        if (spec.channels) {
            // "H S% L%" 채널 문자열이라 hsl() 로 조립해야 한다
            const ch = readVar(spec.channels);
            if (ch) raw = `hsl(${ch})`;
        } else if (spec.var) {
            raw = readVar(spec.var);
        }
        out[key] = toHex(raw) || spec.fallback;
    }
    return out;
}

/** 토큰 이름으로 불투명 hex 색을 얻는다. */
export function dsColor(name) {
    if (!cache) cache = build();
    return cache[name] || TOKENS[name]?.fallback || '#000000';
}

/** 테마(라이트/다크)가 바뀐 뒤 호출해 캐시를 비운다. */
export function resetDsPaletteCache() {
    cache = null;
}

export default dsColor;
