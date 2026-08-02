/**
 * 하드코딩된 색상값을 디자인 시스템 토큰으로 치환한다.
 *
 * `<style>` 블록과 인라인 `style="..."` 만 건드린다. `<script>` 안의 값은
 * THREE.Color / 차트 옵션 / bpmn-js 렌더러처럼 CSS 가 아닌 곳에서 쓰여
 * `var(--x)` 를 넣으면 깨지기 때문이다.
 *
 *   node scripts/tokenize-colors.mjs --dry    변경 예정만 출력
 *   node scripts/tokenize-colors.mjs          실제 치환
 */
import fs from 'fs';
import path from 'path';

const DRY = process.argv.includes('--dry');
const ROOT = 'src';

/** 역할별 색상군 → 토큰 */
const ROLES = {
    border: {
        token: 'var(--cds-border)',
        colors: ['e0e0e0','e2e8f0','ddd','eee','e5e7eb','e6e8ee','f0f0f0','e9ecef','dfe5ef','d9d9d9','ced4da','dee2e6','e5eaef','ebebeb','ececec','e8e8e8','dcdcdc','e4e4e7','e1e1e1','d1d5db','cbd5e1','e3e3e3','eaeaea','e4e6ea','dfe1e6','d0d7de','e7ecf0']
    },
    surfaceMuted: {
        token: 'var(--cds-bg-neutral)',
        colors: ['f5f5f5','f8f9fa','fafafa','f8fafc','f1f5f9','f7f7f7','fbfbfb','f9f9f9','f4f4f5','f6f9fc','f5f8fb','f2f2f2','fcfcfc','f3f4f6','f7f8fa','fafbfc','f8fafb','f2f4f7','eef0f3']
    },
    textStrong: {
        token: 'var(--cds-text-primary)',
        colors: ['333','1e293b','1f2937','111827','212121','2a3547','000000','000','111c2d','0f172a','222','1a1a1a','2d3748','111','1d2129','1e2330','1c1e21']
    },
    textMid: {
        token: 'var(--cds-text-secondary)',
        colors: ['444','666','475569','52525b','697084','64748b','707a82','555','4a5568','374151','5a5a5a','616161','6b7280','495057','4b5563','343a40']
    },
    textMuted: {
        token: 'var(--cds-text-muted)',
        colors: ['888','999','94a3b8','9ca3af','aaa','ccc','bbb','a0aec0','8c8c8c','9e9e9e','757575','78716c','b0b0b0','9aa0ad','808080','adb5bd','6c757d']
    },
    brand: {
        token: 'hsl(var(--accent-brand))',
        colors: ['1976d2','3b82f6','0085db','60a5fa','03689a','2196f3','1e88e5','42a5f5','0d6efd','007bff','2563eb','1565c0','0288d1','1867c0','5c6bc0','3f51b5','1b4fcb','1d4ed8','667eea','4f46e5','3d5afe']
    },
    accentBg: {
        token: 'var(--cds-bg-accent)',
        colors: ['e3f2fd','dbeafe','eff6ff','e1f5fa','e5f3fb','bbdefb','e8eaf6','eef2ff','eaf1ff','edf2ff','e7f0ff']
    },
    success: {
        token: 'var(--cds-text-success)',
        colors: ['4caf50','2e7d32','10b981','059669','22c55e','16a34a','43a047','388e3c','4bd08b','00c853','22a05b','15803d','006300']
    },
    successBg: {
        token: 'var(--cds-bg-success)',
        colors: ['e8f5e9','dcfce7','d1fae5','dffff3','c8e6c9','f0fdf4','a7f3d0','caeac7']
    },
    danger: {
        token: 'var(--cds-text-danger)',
        colors: ['ef4444','f44336','dc2626','e53935','d32f2f','fb977d','c62828','b91c1c','e74c3c','721c24','8e2626']
    },
    dangerBg: {
        token: 'var(--cds-bg-danger)',
        colors: ['ffebee','fee2e2','fef2f2','ffede9','ffcdd2','fef1f1']
    },
    warning: {
        token: 'var(--cds-text-warning)',
        colors: ['f59e0b','ff9800','f57c00','fb8c00','d97706','ffa726','f8c076','ef6c00','e0922b','734500','b45309']
    },
    warningBg: {
        token: 'var(--cds-bg-warning)',
        colors: ['fff3e0','fdf2d0','fef3c7','fffbeb','fff6ea','ffe0b2']
    }
};

/** 색 → 토큰 조회표 */
const COLOR_TO_TOKEN = new Map();
for (const { token, colors } of Object.values(ROLES)) {
    for (const c of colors) COLOR_TO_TOKEN.set(c.toLowerCase(), token);
}

/** 흰색·검정은 CSS 속성에 따라 의미가 달라 별도 처리 */
const BG_PROPS = /^(background|background-color|fill|border-color|border(-(top|right|bottom|left))?-color|outline-color|box-shadow|caret-color|stroke)$/;
const WHITE = new Set(['fff', 'ffffff']);

// 선언 전체(prop: value)를 잡아 value 안의 모든 색을 속성 문맥으로 치환한다.
// 색 하나만 바꾸면 `linear-gradient(.., var(--x) 0%, #dc2626 100%)` 처럼
// 토큰과 리터럴이 섞여 다크에서 한쪽만 뒤집힌다.
const DECL = /([-a-zA-Z]+)\s*:\s*([^;{}]+)/g;
const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

function mapColor(hex, prop) {
    const raw = hex.slice(1).toLowerCase();

    if (WHITE.has(raw)) {
        // 배경/테두리로 쓰인 흰색만 표면 토큰으로. 글자색 흰색은 그대로 둔다
        // (브랜드 버튼 위 흰 글자 등은 다크에서도 흰색이어야 한다).
        return BG_PROPS.test(prop) ? 'var(--cds-surface-2)' : null;
    }
    return COLOR_TO_TOKEN.get(raw) || null;
}

/** CSS 텍스트 안의 색을 속성 문맥을 보며 치환 */
function tokenizeCss(css, stats) {
    return css.replace(DECL, (whole, prop, value) => {
        if (!HEX.test(value)) return whole;
        HEX.lastIndex = 0;

        const nextValue = value.replace(HEX, (hex) => {
            const token = mapColor(hex, prop.toLowerCase());
            if (!token) {
                stats.skipped.set(hex.toLowerCase(), (stats.skipped.get(hex.toLowerCase()) || 0) + 1);
                return hex;
            }
            stats.replaced += 1;
            return token;
        });

        return `${prop}: ${nextValue.trim()}`;
    });
}

function processFile(file, stats) {
    const src = fs.readFileSync(file, 'utf8');
    let out = src;

    // 1) <style> 블록
    out = out.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, open, body, close) => open + tokenizeCss(body, stats) + close);

    // 2) 인라인 style="..." (템플릿 영역만 — script/style 블록은 위에서 처리됨)
    out = out.replace(/style\s*=\s*"([^"]*)"/g, (m, body) => {
        if (!/#[0-9a-fA-F]{3,6}/.test(body)) return m;
        return `style="${tokenizeCss(body, stats)}"`;
    });

    if (out !== src) {
        stats.files += 1;
        if (!DRY) fs.writeFileSync(file, out);
        return true;
    }
    return false;
}

const stats = { files: 0, replaced: 0, skipped: new Map() };
function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        // 디자인 시스템 자체는 토큰 정의부라 제외한다.
        // (다크에서도 흰색이어야 하는 스위치 노브 등, 의도적인 리터럴이 있다)
        if (e.isDirectory()) {
            if (p === path.join('src', 'ds')) continue;
            walk(p);
        } else if (p.endsWith('.vue')) processFile(p, stats);
    }
}
walk(ROOT);

console.log(`${DRY ? '[dry-run] ' : ''}파일 ${stats.files}개 / 치환 ${stats.replaced}건`);
const top = [...stats.skipped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log(`매핑 없어 남긴 색 상위 ${top.length}종:`);
console.log('  ' + top.map(([c, n]) => `${c}(${n})`).join(' '));
