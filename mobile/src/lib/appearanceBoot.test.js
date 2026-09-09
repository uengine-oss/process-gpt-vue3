/**
 * 켜지기 전에 색을 정하는 규칙.
 *
 * 무엇이 잘못돼 있었나
 *     테마는 appearance.js 가 정하는데 그것은 번들 안에 있다. 즉 자바스크립트를
 *     다 받고 나서야 색이 잡힌다. 다크를 쓰는 사람은 앱을 켤 때마다 밝은 화면이
 *     번쩍인 뒤 어두워졌다. 알림을 눌러 앱이 꺼진 상태에서 시작할 때 특히 길다.
 *
 * 그래서 index.html 의 <head> 에 같은 규칙을 한 번 더 적어 두었다. **같은 규칙을
 * 두 곳에 적은 것**이므로, 한쪽만 바뀌면 조용히 어긋난다 — 그때 나는 증상은
 * "가끔 색이 번쩍인다" 뿐이라 원인을 찾기 어렵다.
 *
 * 여기서 고정하는 것
 *     index.html 안의 그 스크립트를 실제로 꺼내 돌려서, appearance.js 의
 *     restore() 와 **모든 경우에 같은 답**을 내는지 본다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { restore } from './appearance.js';

const HTML = fileURLToPath(new URL('../../index.html', import.meta.url));

/** index.html 의 <head> 안 인라인 스크립트를 꺼낸다. */
function bootScript() {
    const html = readFileSync(HTML, 'utf8');
    const found = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map((m) => m[1])
        .filter((s) => s.includes('pg-appearance'));

    assert.equal(found.length, 1, 'index.html 에서 테마 스크립트를 찾지 못했다');
    return found[0];
}

function fakeStore(initial) {
    const data = new Map(initial ? Object.entries(initial) : []);
    return {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, v)
    };
}

function fakeWin({ stored, prefersDark = false, throwOnRead = false }) {
    const store = throwOnRead
        ? {
              getItem() {
                  throw new Error('사생활 보호 모드');
              },
              setItem() {}
          }
        : fakeStore(stored ? { 'pg-appearance': stored } : undefined);

    return {
        localStorage: store,
        matchMedia: (q) => ({ matches: q.includes('dark') ? prefersDark : false }),
        document: { documentElement: { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } } }
    };
}

/** index.html 의 스크립트를 그 가짜 전역 위에서 돌린 결과. */
function bootResult(win) {
    const run = new Function(
        'window', 'document', 'localStorage',
        `${bootScript()}; return document.documentElement.attrs['data-appearance'];`
    );
    return run(win, win.document, win.localStorage);
}

/** appearance.js 의 restore() 결과. */
function moduleResult(win) {
    return restore(win);
}

const CASES = [
    ['고른 적 없음 + 기기가 밝음', { stored: null, prefersDark: false }],
    ['고른 적 없음 + 기기가 어두움', { stored: null, prefersDark: true }],
    ['라이트를 골랐음', { stored: 'light' }],
    ['스카이를 골랐음', { stored: 'sky' }],
    ['다크를 골랐음', { stored: 'dark' }],
    ['다크를 골랐고 기기는 밝음', { stored: 'dark', prefersDark: false }],
    ['모르는 값이 들어 있음', { stored: 'neon' }],
    ['빈 값이 들어 있음', { stored: '' }],
    ['앞뒤 공백이 붙어 있음', { stored: '  dark  ' }],
    ['저장소를 읽을 수 없음', { throwOnRead: true }],
    ['저장소를 읽을 수 없고 기기가 어두움', { throwOnRead: true, prefersDark: true }]
];

for (const [name, opts] of CASES) {
    test(`같은 답을 낸다 — ${name}`, () => {
        const fromHtml = bootResult(fakeWin(opts));
        const fromModule = moduleResult(fakeWin(opts));

        assert.equal(
            fromHtml,
            fromModule,
            `index.html 과 appearance.js 가 갈라졌다 (html=${fromHtml}, module=${fromModule})`
        );
    });
}

test('아는 값만 내놓는다', () => {
    for (const [, opts] of CASES) {
        assert.ok(
            ['light', 'sky', 'dark'].includes(bootResult(fakeWin(opts))),
            '모르는 값을 내놓으면 CSS 가 아무 테마도 못 고른다'
        );
    }
});

test('저장은 하지 않는다', () => {
    // 저장은 번들의 restore() 가 곧 이어서 한다. 여기서 또 쓰면 실패했을 때
    // 어느 쪽이 쓴 값인지 알 수 없다.
    const win = fakeWin({ stored: null, prefersDark: true });
    let wrote = false;
    win.localStorage.setItem = () => {
        wrote = true;
    };

    bootResult(win);

    assert.equal(wrote, false);
});

test('켜지는 동안 보여 줄 것이 #app 안에 들어 있다', () => {
    // 비어 있으면 번들을 받는 동안 아무것도 없는 흰 화면이 남는다.
    // 알림을 눌러 앱이 꺼진 상태에서 시작하면 그것이 십 초 가까이 간다.
    const html = readFileSync(HTML, 'utf8');
    const app = html.match(/<div id="app">([\s\S]*?)<\/div>\s*<script/);

    assert.ok(app, '#app 을 찾지 못했다');
    assert.match(app[1], /불러오는 중/, '켜지는 동안 보여 줄 표시가 없다');
});
