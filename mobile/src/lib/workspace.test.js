/**
 * 할 일 · 진행 화면의 내용 — 실제 VM 의 「영업 제안서 승인」 건 모양을 줄여 썼다.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { homeModel, instanceCard, isActionable, progressOf, stepOf, subjectOf, timelineModel, fileOutputs } from './workspace.js';

const ME = 'u-minji';
const BOSS = 'u-jang';
const INST = 'def.i1';
const NOW = new Date('2026-11-11T12:00:00+09:00').getTime();

const row = (id, activity_id, activity_name, status, user_id, extra = {}) => ({
    id, activity_id, activity_name, status, user_id, username: user_id === ME ? '김민지' : '장진영',
    proc_inst_id: INST, proc_def_id: 'def', tool: `formHandler:def_${activity_id}_form`, output: {}, ...extra
});

const instRows = [
    row('r1', 'task1', '요청사항 입력', 'DONE', ME, { actual_start_date: '2026-11-10T22:50:00+09:00', end_date: '2026-11-10T22:59:00+09:00', output: { f: { request: '책상 30' } } }),
    row('r2', 'task2', '제안서 작성', 'DONE', ME, { end_date: '2026-11-10T23:01:00+09:00', output: { f: { proposal: 'v1' } } }),
    row('r3', 'task3', '제안서 검토', 'DONE', BOSS, { end_date: '2026-11-11T09:32:00+09:00', output: { f: { review_result: 'reject', review_comment: '제안서 본문이 비어 있습니다.' } } }),
    row('r4', 'task4_reject', '제안서 재작성', 'IN_PROGRESS', ME, { actual_start_date: '2026-11-11T09:32:00+09:00', due_date: '2026-11-30T10:00:00+09:00' }),
    row('r5', 'task4_approve', '제안서 고객 발송', 'TODO', ME)
];
const instances = { [INST]: { proc_inst_id: INST, proc_inst_name: '영업 제안서 승인 한빛물산 대전 사무실 가구', proc_def_id: 'def', status: 'RUNNING', start_date: '2026-11-10T22:50:00+09:00' } };
const defNames = { def: '영업 제안서 승인' };

describe('내 차례', () => {
    it('미리 만들어 둔 TODO 는 내 차례가 아니다', () => {
        assert.equal(isActionable(instRows[4]), false);
        assert.equal(isActionable(instRows[3]), true);
    });

    it('반려된 업무는 카드에서 반려 사유를 바로 보여 준다', () => {
        const home = homeModel({ rows: instRows, instRows, instances, defNames, uid: ME, now: NOW });
        assert.equal(home.turn.length, 1);
        const card = home.turn[0];
        assert.equal(card.title, '제안서 재작성');
        assert.equal(card.process, '영업 제안서 승인');
        assert.equal(card.subject, '한빛물산 대전 사무실 가구');
        assert.equal(card.badge, 'rejected');
        assert.equal(card.rejection.who, '장진영');
        assert.equal(card.rejection.comment, '제안서 본문이 비어 있습니다.');
        assert.deepEqual(card.step, { no: 4, total: 5 });
    });

    it('에이전트에 맡긴 일은 따로 모은다 — 초안이 다 됐으면 「초안 준비됨」', () => {
        const delegatedRow = row('r9', 'w', '제안서 작성 및 발송', 'IN_PROGRESS', ME, { proc_inst_id: 'other', agent_orch: 'deepagents', agent_mode: 'DRAFT', draft_status: 'COMPLETED' });
        const home = homeModel({ rows: [...instRows, delegatedRow], instRows, instances, defNames, uid: ME, now: NOW });
        assert.equal(home.turn.length, 1);
        assert.equal(home.delegated.length, 1);
        assert.equal(home.delegated[0].state, 'draft-ready');
        assert.match(home.delegated[0].text, /초안 준비됨/);
    });

    it('승인 폼이면 승인 요청으로 센다', () => {
        const review = row('a1', 'task3', '제안서 검토', 'IN_PROGRESS', BOSS, { proc_inst_id: 'i2' });
        const home = homeModel({ rows: [review], instRows: [review], instances: {}, defNames, decisionFormIds: new Set(['def_task3_form']), uid: BOSS, now: NOW });
        assert.equal(home.approvals.length, 1);
        assert.equal(home.turn[0].badge, 'approval');
    });

    it('오늘 배정되고 아직 손대지 않은 업무는 「새 업무」', () => {
        const fresh = row('n1', 'x', '제안서 작성 및 발송', 'IN_PROGRESS', ME, { proc_inst_id: 'i3', actual_start_date: '2026-11-11T09:23:00+09:00' });
        const home = homeModel({ rows: [fresh], instRows: [fresh], instances: {}, defNames, uid: ME, now: NOW });
        assert.equal(home.turn[0].badge, 'new');
    });
});

describe('내가 올린 요청', () => {
    it('내가 시작했고 지금 남의 차례인 건', () => {
        const waitingBoss = instRows.map((r) => (r.id === 'r4' ? { ...r, status: 'DONE', end_date: '2026-11-11T10:00:00+09:00' } : r))
            .concat([row('r6', 'task3', '제안서 검토', 'IN_PROGRESS', BOSS, { actual_start_date: '2026-11-11T10:05:00+09:00' })]);
        const home = homeModel({ rows: waitingBoss, instRows: waitingBoss, instances, defNames, uid: ME, now: NOW });
        assert.equal(home.requests.length, 1);
        assert.equal(home.requests[0].progress.current.name, '제안서 검토');
        assert.equal(home.requests[0].progress.current.who, '장진영');
    });
});

describe('진행', () => {
    it('단계 · 막대 · 반려 수', () => {
        const p = progressOf(instRows);
        assert.equal(p.done, 3);
        assert.equal(p.no, 4);
        assert.equal(p.total, 5);
        assert.equal(p.rejections, 1);
        assert.equal(p.current.name, '제안서 재작성');
        assert.equal(stepOf(instRows[3], instRows).no, 4);
    });

    it('카드: 지금 내 차례인지', () => {
        const card = instanceCard(instances[INST], instRows, defNames, ME);
        assert.equal(card.statusLabel, '진행 중');
        assert.equal(card.mine, true);
        assert.equal(card.myTaskId, 'r4');
    });

    it('타임라인은 반복된 단계의 지난 결과(반려 사유)를 지우지 않고, 대기 단계를 한 줄로 묶는다', () => {
        const again = [...instRows, row('r7', 'task3', '제안서 검토', 'DONE', BOSS, { end_date: '2026-11-10T23:05:00+09:00', output: { f: { review_result: 'reject', review_comment: '설치비와 설치 일정이 빠졌습니다.' } } })];
        const t = timelineModel(again, ME);
        const rejected = t.filter((s) => s.state === 'rejected');
        assert.equal(rejected.length, 2);
        assert.deepEqual(rejected.map((s) => s.comment), ['설치비와 설치 일정이 빠졌습니다.', '제안서 본문이 비어 있습니다.']);
        const current = t.find((s) => s.state === 'current');
        assert.equal(current.mine, true);
        assert.equal(t[t.length - 1].state, 'waiting');
        assert.equal(t[t.length - 1].name, '제안서 고객 발송');
    });

    it('산출물: 끝난 단계의 파일', () => {
        const files = fileOutputs([{ status: 'DONE', username: '김민지', output: { f: { file: { name: '제안서.pdf', url: 'https://x/storage/a.pdf' } } } }]);
        assert.deepEqual(files.map((f) => f.name), ['제안서.pdf']);
    });

    it('건 이름에서 프로세스 이름을 뗀다', () => {
        assert.equal(subjectOf('영업 제안서 승인 한빛물산 대전 사무실 가구', '영업 제안서 승인'), '한빛물산 대전 사무실 가구');
        assert.equal(subjectOf('영업 제안서 작성 · 대전 지사 회의실 가구', '영업 제안서 작성'), '대전 지사 회의실 가구');
        assert.equal(subjectOf('요청사항 입력', '영업 제안서 승인'), '요청사항 입력');
    });
});

describe('다시 열린 검토 단계', () => {
    it('지난번 반려를 타임라인에 남기고(재작성 앞), 반려 수에 센다', () => {
        const rows2 = [
            row('a', 'task1', '요청사항 입력', 'DONE', ME, { end_date: '2026-11-10T22:59:00+09:00' }),
            row('b', 'task4_reject', '제안서 재작성', 'DONE', ME, { end_date: '2026-11-11T10:16:00+09:00' }),
            row('c', 'task2', '제안서 작성', 'DONE', ME, { end_date: '2026-11-11T10:17:00+09:00' }),
            row('d', 'task3', '제안서 검토', 'IN_PROGRESS', BOSS, {
                output: { f: { review_result: 'reject', review_comment: '제안서 본문이 비어 있습니다.' } },
                gateway_decisions: { gateway1: { selected: ['s1'], sequences: { s1: { target: 'task4_reject' } } } }
            })
        ];
        const t = timelineModel(rows2, ME);
        assert.deepEqual(t.map((s) => s.state), ['done', 'rejected', 'done', 'done', 'current']);
        assert.equal(t[1].comment, '제안서 본문이 비어 있습니다.');
        assert.equal(progressOf(rows2).rejections, 1);
    });
});
