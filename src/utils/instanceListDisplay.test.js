import test from 'node:test';
import assert from 'node:assert/strict';
import { toEpochMs, isMissingDate, lastActivityMs, compareSidebarInstances, sortSidebarInstances, countMyOpenWorkByInstance } from './instanceListDisplay.js';

test('비어 있는 날짜(null·0·빈 문자열·읽을 수 없는 값)는 빈칸이다 — 1970년으로 보이지 않게', () => {
    for (const v of [null, undefined, '', '0', 0, 'not a date', '1970-01-01T09:00:00', '1970-01-01T00:00:00Z', new Date(NaN)]) {
        assert.equal(isMissingDate(v), true, `missing: ${String(v)}`);
    }
    for (const v of ['2026-10-30T17:46:07.894886', '2026-10-30 17:46:07', '2026-10-30T17:46:42.874287+09:00', new Date('2026-11-09T05:31:00Z')]) {
        assert.equal(isMissingDate(v), false, `present: ${String(v)}`);
    }
});

test('오프셋 없는 문자열은 KST 벽시계 시각으로 읽는다', () => {
    assert.equal(toEpochMs('2026-11-09T14:31:00'), Date.parse('2026-11-09T14:31:00+09:00'));
    assert.equal(toEpochMs('2026-11-09 14:31:00'), Date.parse('2026-11-09T14:31:00+09:00'));
    assert.equal(toEpochMs('2026-11-09T05:31:00Z'), Date.parse('2026-11-09T14:31:00+09:00'));
});

test('정렬 기준은 updated_at, 없으면 start_date', () => {
    assert.equal(lastActivityMs({ updatedAt: '2026-11-09T14:31:05+09:00', startDate: '2026-01-01T00:00:00' }), Date.parse('2026-11-09T14:31:05+09:00'));
    assert.equal(lastActivityMs({ updatedAt: null, startDate: '2026-11-08T10:00:00' }), Date.parse('2026-11-08T10:00:00+09:00'));
    assert.ok(Number.isNaN(lastActivityMs({ updatedAt: null, startDate: null })));
});

test('방금 시작한 인스턴스가 시작일이 빈 오래된 인스턴스보다 위에 온다(운영 재현)', () => {
    // 서버(start_date DESC = NULLS FIRST)가 준 순서 그대로
    const fromServer = [
        { title: '연구과제 정산 1', startDate: null, updatedAt: '2026-11-06T10:00:00+09:00' },
        { title: '연구과제 정산 2', startDate: null, updatedAt: '2026-11-07T09:00:00+09:00' },
        { title: '영업활동 프로세스', startDate: '2026-11-09T14:31:00', updatedAt: '2026-11-09T14:31:05+09:00' },
        { title: '견적 승인', startDate: '2026-11-08T10:00:00', updatedAt: '2026-11-08T16:00:00+09:00' }
    ];
    const sorted = sortSidebarInstances(fromServer).map((i) => i.title);
    assert.deepEqual(sorted, ['영업활동 프로세스', '견적 승인', '연구과제 정산 2', '연구과제 정산 1']);
    assert.equal(fromServer[0].title, '연구과제 정산 1', '원본 배열은 건드리지 않는다');
});

test('업무를 제출해 updated_at 이 바뀐 오래된 인스턴스는 맨 위로 올라간다', () => {
    const list = [
        { title: '새로 시작', startDate: '2026-11-09T14:31:00', updatedAt: '2026-11-09T14:31:05+09:00' },
        { title: '예전에 시작', startDate: '2026-11-01T09:00:00', updatedAt: '2026-11-09T15:00:00+09:00' }
    ];
    assert.deepEqual(sortSidebarInstances(list).map((i) => i.title), ['예전에 시작', '새로 시작']);
});

test('삭제된 인스턴스는 맨 아래, 그 안에서는 삭제일 내림차순', () => {
    const list = [
        { title: '삭제 A', isDeleted: true, deletedAt: '2026-11-01T00:00:00+09:00', updatedAt: '2026-11-09T23:00:00+09:00' },
        { title: '진행', isDeleted: false, updatedAt: '2026-11-02T00:00:00+09:00' },
        { title: '삭제 B', isDeleted: true, deletedAt: '2026-11-05T00:00:00+09:00' },
        { title: '날짜 모름', isDeleted: false, updatedAt: null, startDate: null }
    ];
    assert.deepEqual(sortSidebarInstances(list).map((i) => i.title), ['진행', '날짜 모름', '삭제 B', '삭제 A']);
});

test('시각이 같으면 받은 순서를 지킨다', () => {
    const t = '2026-11-09T10:00:00+09:00';
    const list = [{ title: 'a', updatedAt: t }, { title: 'b', updatedAt: t }, { title: 'c', updatedAt: t }];
    assert.deepEqual(sortSidebarInstances(list).map((i) => i.title), ['a', 'b', 'c']);
    assert.equal(compareSidebarInstances(list[0], list[1]), 0);
});

test('내 업무 칩: 진행 중 · 제출 · 보류/반송만 세고 예정 · 완료는 뺀다', () => {
    const rows = [
        { status: 'IN_PROGRESS', user_id: 'me', root_proc_inst_id: 'a' },
        { status: 'SUBMITTED', user_id: 'me', root_proc_inst_id: 'a' },
        { status: 'PENDING', user_id: 'me', root_proc_inst_id: 'b' },
        { status: 'TODO', user_id: 'me', root_proc_inst_id: 'a' },
        { status: 'DONE', user_id: 'me', root_proc_inst_id: 'a' }
    ];
    assert.deepEqual(countMyOpenWorkByInstance(rows, 'me'), { a: 2, b: 1 });
});

test('내 업무 칩: 쉼표로 묶인 담당자 중 정확히 나인 것만, 이름이 겹치는 남의 업무는 아니다', () => {
    const rows = [
        { status: 'IN_PROGRESS', user_id: 'other, me', root_proc_inst_id: 'a' },
        { status: 'IN_PROGRESS', user_id: 'me-not', root_proc_inst_id: 'a' },
        { status: 'IN_PROGRESS', user_id: 'mail@x.io', root_proc_inst_id: 'c' }
    ];
    assert.deepEqual(countMyOpenWorkByInstance(rows, ['me', 'mail@x.io']), { a: 1, c: 1 });
});

test('내 업무 칩: 최상위 인스턴스로 묶고(없으면 자기 인스턴스), 시작 이벤트 행은 업무가 아니다', () => {
    const rows = [
        { status: 'IN_PROGRESS', user_id: 'me', root_proc_inst_id: 'root', proc_inst_id: 'child' },
        { status: 'IN_PROGRESS', user_id: 'me', root_proc_inst_id: null, proc_inst_id: 'solo' },
        { status: 'IN_PROGRESS', user_id: 'me', proc_inst_id: 'solo', tool: '', description: 'start event' }
    ];
    assert.deepEqual(countMyOpenWorkByInstance(rows, 'me'), { root: 1, solo: 1 });
    assert.deepEqual(countMyOpenWorkByInstance(rows, ''), {});
});
