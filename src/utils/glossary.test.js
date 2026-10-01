import test from 'node:test';
import assert from 'node:assert/strict';

import { glossaryTermKey, groupGlossaryTerms, pickReusableTerms } from './glossary.js';

const rows = [
    {
        id: '1',
        proc_def_id: 'p-audit',
        proc_def_name: '내부심사 프로세스',
        term: '내부심사',
        definition: '1자 심사 절차',
        updated_at: '2026-09-01'
    },
    {
        id: '2',
        proc_def_id: 'p-corrective',
        proc_def_name: '시정조치 프로세스',
        term: ' 내부심사 ',
        definition: '심사 결과 후속 절차의 근거',
        updated_at: '2026-09-10'
    },
    {
        id: '3',
        proc_def_id: 'p-audit',
        proc_def_name: '내부심사 프로세스',
        term: 'FA(Focus Area)',
        definition: '핵심 분야',
        updated_at: '2026-09-02'
    },
    { id: '4', proc_def_id: 'p-x', proc_def_name: null, term: '', definition: '무시되어야 함' }
];

test('용어 키는 trim + 소문자 — 공백·대소문자 차이를 같은 용어로 본다', () => {
    assert.equal(glossaryTermKey(' FA(Focus Area) '), 'fa(focus area)');
    assert.equal(glossaryTermKey('내부심사'), glossaryTermKey(' 내부심사 '));
});

test('통합 사전 그룹: 같은 용어를 묶고 빈 용어는 제외한다', () => {
    const groups = groupGlossaryTerms(rows);
    assert.deepEqual(
        groups.map((g) => g.term),
        ['FA(Focus Area)', '내부심사']
    );
    const audit = groups.find((g) => g.term === '내부심사');
    assert.equal(audit.usages.length, 2);
    // 사용처는 프로세스명 순
    assert.deepEqual(
        audit.usages.map((u) => u.proc_def_id),
        ['p-audit', 'p-corrective']
    );
});

test('재사용 후보: 용어별 대표 1건 — 최근 갱신 행의 정의를 쓴다', () => {
    const reusable = pickReusableTerms(rows);
    assert.equal(reusable.length, 2);
    const audit = reusable.find((t) => glossaryTermKey(t.term) === '내부심사');
    assert.equal(audit.id, '2'); // updated_at 이 더 최신인 행
    assert.equal(audit.definition, '심사 결과 후속 절차의 근거');
});
