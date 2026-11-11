/**
 * 초안을 폼에 채우고 요약을 만든다 — 요약 · 팀 구성은 폼 값이 아니므로 채우지 않는다.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { draftValues, fallbackLines, fillableDraft, hasUserInput, summaryLines, teamNote } from './draft.js';

const FORM = 'def_write_proposal_form';

describe('draftValues', () => {
    it('폼 id 로 감싼 초안에서 그 폼의 값', () => {
        const task = { draft: { [FORM]: { proposal_title: '제목', agent_summary: '요약', team_agent_ids: ['a'] } } };
        assert.deepEqual(draftValues(task, FORM), { proposal_title: '제목' });
    });
    it('문자열 초안도 읽는다', () => {
        assert.deepEqual(draftValues({ draft: JSON.stringify({ [FORM]: { a: 1 } }) }, FORM), { a: 1 });
    });
    it('폼 id 없이 값만 있는 초안', () => {
        assert.deepEqual(draftValues({ draft: { a: 'x' } }, FORM), { a: 'x' });
    });
    it('읽을 수 없으면 빈 값', () => {
        assert.deepEqual(draftValues({ draft: '파일을 찾을 수 없습니다' }, FORM), {});
        assert.deepEqual(draftValues({}, FORM), {});
    });
});

describe('fillableDraft · hasUserInput', () => {
    const fields = [
        { key: 'title', supported: true },
        { key: 'comment', supported: true, readonly: true },
        { key: 'proposal', supported: false }
    ];
    it('읽기 전용 · 휴대폰에서 못 쓰는 칸은 채우지 않는다', () => {
        assert.deepEqual(fillableDraft(fields, { title: 'T', comment: 'C', proposal: 'P' }), { title: 'T' });
    });
    it('사람이 적은 것이 있는지', () => {
        assert.equal(hasUserInput({ a: '', b: [], c: false }), false);
        assert.equal(hasUserInput({ a: ' x ' }), true);
    });
});

describe('요약', () => {
    it('문단은 문장으로, 목록은 줄로', () => {
        assert.deepEqual(summaryLines('고객 요청을 반영했습니다. 파일명도 적었습니다.'), ['고객 요청을 반영했습니다.', '파일명도 적었습니다.']);
        assert.deepEqual(summaryLines('- 설치비를 넣었습니다\n- 일정: 12월 1일'), ['설치비를 넣었습니다', '일정: 12월 1일']);
        assert.deepEqual(summaryLines(''), []);
    });
    it('요약이 없으면 채운 값 앞 몇 칸', () => {
        const lines = fallbackLines([{ key: 't', label: '제목' }], { t: '───── 한빛물산 제안서' });
        assert.deepEqual(lines, ['제목: 한빛물산 제안서']);
    });
    it('팀 구성 결과 첫 줄', () => {
        const ev = [{ event_type: 'task_completed', data: { result: '함께 일할 에이전트: 문서 작성 에이전트\n이유', team_agent_ids: ['a'] } }];
        assert.deepEqual(teamNote(ev), { text: '함께 일할 에이전트: 문서 작성 에이전트', count: 1 });
        assert.equal(teamNote([]), null);
    });
});
