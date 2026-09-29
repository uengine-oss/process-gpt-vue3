import test from 'node:test';
import assert from 'node:assert/strict';

// decode() 가 쓰는 textarea 대역: 테스트에 나오는 엔티티만 푼다.
globalThis.document = {
    createElement: () => {
        let html = '';
        return {
            set innerHTML(v) {
                html = v;
            },
            get value() {
                return html.replace(/&quot;/g, '"').replace(/&#126;/g, '~').replace(/&amp;/g, '&');
            }
        };
    }
};

const { withKbCitations } = await import('./kbCitations.js');

function chips(html) {
    return [...withKbCitations(html).matchAll(/<a href="#" class="kb-cite" ([^>]*)>/g)].map((m) =>
        Object.fromEntries([...m[1].matchAll(/data-kb-(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]]))
    );
}

test('블록 범위와 발췌가 있는 인용', () => {
    const [c] = chips('한도다 [[법령/근로기준법.hwpx › 제60조 · b299-b301 · &quot;25일을 한도로&quot;]]');
    assert.deepEqual([c.path, c.start, c.end, c.quote], ['법령/근로기준법.hwpx', '299', '301', '25일을 한도로']);
});

test('블록 없이 발췌만 있어도 칩이 된다 — 제목 안의 · 는 제목으로 남는다', () => {
    const [c] = chips('[[법령/근로기준법.hwpx › 제2장 근로계약 · 제26조(해고의 예고) · “적어도 30일 전에 예고”]]');
    assert.deepEqual([c.title, c.start, c.quote], ['제2장 근로계약 · 제26조(해고의 예고)', '', '적어도 30일 전에 예고']);
});

test('쪽 번호와 &#126; 로 바뀐 물결 범위를 읽는다', () => {
    const [p] = chips('[[법령/개인정보보호법.pdf › 제34조 · p.24-25 · &quot;지체 없이&quot;]]');
    assert.equal(p.page, '24');
    const [r] = chips('[[법령/근로기준법.hwpx › 제60조 · b12&#126;b15]]');
    assert.deepEqual([r.start, r.end], ['12', '15']);
});

test('블록도 발췌도 없으면 그대로 둔다', () => {
    const html = '[[법령/근로기준법.hwpx › 제26조]]';
    assert.equal(withKbCitations(html), html);
});
