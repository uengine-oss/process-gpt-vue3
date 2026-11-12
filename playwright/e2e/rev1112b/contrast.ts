/**
 * 2026-11-12 다크 테마 점검 도구 — 글자색이 바탕과 거의 같아 안 보이는 곳을 찾는다.
 */
import type { Page } from '@playwright/test';

/**
 * 다크 테마에서 글자색이 바탕과 거의 같은 곳을 찾는다(대비 2.5 미만).
 * 배경은 조상 중 처음 불투명한 것을 쓴다(반투명은 무시 — 근사).
 */
export async function lowContrast(page: Page, root = 'body') {
    return page.evaluate((rootSel) => {
        const parse = (c: string) => {
            const m = c.match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const p = m[1].split(',').map((x) => parseFloat(x));
            return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
        };
        const lum = (c: any) => {
            const f = (v: number) => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
        };
        const bgOf = (el: Element | null): any => {
            while (el) {
                const c = parse(getComputedStyle(el).backgroundColor);
                if (c && c.a > 0.5) return c;
                el = el.parentElement;
            }
            return { r: 255, g: 255, b: 255, a: 1 };
        };
        const out: any[] = [];
        const seen = new Set<string>();
        const walker = document.createTreeWalker(document.querySelector(rootSel) || document.body, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
            const text = (n.textContent || '').trim();
            if (!text) continue;
            const el = n.parentElement!;
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.1) continue;
            const fg = parse(cs.color);
            if (!fg) continue;
            const bg = bgOf(el);
            const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
            const ratio = (a + 0.05) / (b + 0.05);
            if (ratio >= 2.5) continue;
            const path: string[] = [];
            let p: Element | null = el;
            for (let i = 0; p && i < 4; i++, p = p.parentElement) {
                path.push(p.tagName.toLowerCase() + (p.className && typeof p.className === 'string' ? '.' + p.className.trim().split(/\s+/).slice(0, 3).join('.') : ''));
            }
            const key = path[0] + text.slice(0, 12);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ ratio: Math.round(ratio * 100) / 100, color: cs.color, bg: `rgb(${bg.r},${bg.g},${bg.b})`, text: text.slice(0, 30), path: path.join(' < ') });
        }
        return out;
    }, root);
}
