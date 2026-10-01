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
    const body = withKbCitations(html).split('<div class="kb-cite-list">')[0];
    return [...body.matchAll(/<a href="#" class="kb-cite" ([^>]*)>/g)].map((m) =>
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

test('발췌 여럿을 붙인 인용은 발췌마다 칩이 된다', () => {
    const got = chips(
        '[[법령/시행령.pdf › 제2조 · &quot;귀책사유로 휴업한 기간&quot; / &quot;육아휴직 기간&quot;]] ' +
            '[[법령/전자상거래법.pdf › 제17조 · “3개월 이내” 및 “30일 이내”]]'
    );
    assert.deepEqual(
        got.map((c) => c.quote),
        ['귀책사유로 휴업한 기간', '육아휴직 기간', '3개월 이내', '30일 이내']
    );
});

test('블록도 발췌도 없으면 그대로 둔다', () => {
    const html = '[[법령/근로기준법.hwpx › 제26조]]';
    assert.equal(withKbCitations(html), html);
});
