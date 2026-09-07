/**
 * 색상 테마.
 *
 * 지키려는 것: **모르는 값이 들어와도 색이 잡히는 것.**
 * 값이 어긋나면 CSS 가 아무 테마도 못 고르고, 배경도 글자색도 없는 화면이 된다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { APPEARANCES, DEFAULT_APPEARANCE, apply, normalize, restore, saved } from './appearance.js';

function fakeStore(initial) {
    const data = new Map(initial ? Object.entries(initial) : []);
    return {
        data,
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, v)
    };
}

function fakeDoc() {
    const attrs = {};
    return { attrs, documentElement: { setAttribute: (k, v) => (attrs[k] = v) } };
}

test('아는 값은 그대로 쓴다', () => {
    for (const a of APPEARANCES) assert.equal(normalize(a), a);
});

test('모르는 값은 기본값으로 되돌린다', () => {
    assert.equal(normalize('처음보는테마'), DEFAULT_APPEARANCE);
    assert.equal(normalize(''), DEFAULT_APPEARANCE);
    assert.equal(normalize(null), DEFAULT_APPEARANCE);
});

test('기본값은 포털과 같은 sky 다', () => {
    assert.equal(DEFAULT_APPEARANCE, 'sky');
});

test('적용하면 문서에 표시하고 저장한다', () => {
    const doc = fakeDoc();
    const store = fakeStore();

    apply('dark', doc, store);

    assert.equal(doc.attrs['data-appearance'], 'dark');
    assert.equal(store.getItem('pg-appearance'), 'dark');
});

test('저장을 못 해도 화면에는 적용한다', () => {
    // 저장이 막혔다고 색까지 포기할 이유는 없다.
    const doc = fakeDoc();
    const broken = { getItem: () => null, setItem: () => { throw new Error('막힘'); } };

    assert.equal(apply('light', doc, broken), 'light');
    assert.equal(doc.attrs['data-appearance'], 'light');
});

test('포털이 쓰는 것과 같은 키를 읽는다', () => {
    // 같은 브라우저에서 포털을 쓰던 사람이면 그 선택이 이어진다.
    assert.equal(saved(fakeStore({ 'pg-appearance': 'light' })), 'light');
});

test('저장소를 못 읽어도 기본값을 준다', () => {
    const broken = { getItem: () => { throw new Error('막힘'); } };

    assert.equal(saved(broken), DEFAULT_APPEARANCE);
});

// ---------------------------------------------------------------------------
// 처음 켤 때
// ---------------------------------------------------------------------------

test('고른 적이 있으면 그것을 쓴다', () => {
    const win = { localStorage: fakeStore({ 'pg-appearance': 'light' }), document: fakeDoc(), matchMedia: () => ({ matches: true }) };

    assert.equal(restore(win), 'light', '기기가 어두워도 고른 값이 우선이다');
});

test('고른 적이 없고 기기가 어두우면 어둡게 시작한다', () => {
    // 밝은 화면이 갑자기 켜지는 것을 피한다.
    const win = { localStorage: fakeStore(), document: fakeDoc(), matchMedia: () => ({ matches: true }) };

    assert.equal(restore(win), 'dark');
});

test('고른 적이 없고 기기가 밝으면 기본값', () => {
    const win = { localStorage: fakeStore(), document: fakeDoc(), matchMedia: () => ({ matches: false }) };

    assert.equal(restore(win), DEFAULT_APPEARANCE);
});
