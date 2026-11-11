/**
 * 알림 목록 — 갈래 · 날짜 묶음 · 같은 곳 알림 하나로 · 누르면 그 업무로.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dayLabel, dedupe, groupByDay, kindOf, matchesKind, recipientIds, routeOf, subtitleOf, titleOf, unreadCount } from './notifications.js';

const NOW = new Date('2026-11-11T12:00:00+09:00').getTime();
const n = (id, over = {}) => ({ id, type: 'workitem_bpm', title: '제안서 작성', description: '영업 제안서 승인', url: `/todolist/t-${id}`, is_checked: false, time_stamp: '2026-11-11T09:23:00+09:00', ...over });

describe('갈래 · 문구', () => {
    it('새 할 일 · 에이전트 · 대화 · 결과', () => {
        assert.equal(kindOf(n(1)), 'turn');
        assert.equal(kindOf(n(2, { type: 'agent_draft' })), 'agent');
        assert.equal(kindOf(n(3, { title: '에이전트가 초안을 만들었습니다', type: 'notice' })), 'agent');
        assert.equal(kindOf(n(4, { type: 'chat' })), 'chat');
        assert.equal(kindOf(n(5, { type: 'process_completed' })), 'result');
        assert.equal(matchesKind(n(1), 'all'), true);
        assert.equal(matchesKind(n(1), 'agent'), false);
    });
    it('새 할 일은 「새 할 일: 」로 시작하고, 제목과 같은 설명은 비운다', () => {
        assert.equal(titleOf(n(1)), '새 할 일: 제안서 작성');
        assert.equal(subtitleOf(n(1)), '영업 제안서 승인');
        assert.equal(subtitleOf(n(1, { description: '제안서 작성' })), '');
    });
    it('누르면 그 업무로', () => {
        assert.equal(routeOf(n(7)), '/tasks/t-7');
        assert.equal(routeOf(n(8, { url: '/instancelist/i-1' })), '/instances/i-1');
        assert.equal(routeOf(n(9, { url: '' })), null);
    });
});

describe('묶음', () => {
    it('오늘 · 어제 · 날짜', () => {
        assert.equal(dayLabel('2026-11-11T08:00:00+09:00', NOW), '오늘');
        assert.equal(dayLabel('2026-11-10T23:01:00+09:00', NOW), '어제');
        assert.equal(dayLabel('2026-11-03T10:00:00+09:00', NOW), '11월 3일');
    });
    it('같은 곳을 가리키는 알림은 최근 것 하나로, 하나라도 안 읽었으면 안 읽음', () => {
        const list = dedupe([
            n(1, { url: '/todolist/a', time_stamp: '2026-11-11T09:00:00+09:00', is_checked: true }),
            n(2, { url: '/todolist/a', time_stamp: '2026-11-11T10:00:00+09:00', is_checked: false }),
            n(3, { url: '/todolist/b', time_stamp: '2026-11-10T23:00:00+09:00', is_checked: true })
        ]);
        assert.equal(list.length, 2);
        assert.equal(list[0].id, 2);
        assert.deepEqual(list[0].ids.sort(), [1, 2]);
        assert.equal(list[0].is_checked, false);
        assert.equal(unreadCount(list), 1);
        const groups = groupByDay(list, NOW);
        assert.deepEqual(groups.map((g) => g.label), ['오늘', '어제']);
    });
    it('받는 사람은 이메일과 사용자 id 둘 다', () => {
        assert.deepEqual(recipientIds({ email: 'a@b', uid: 'u1' }), ['a@b', 'u1']);
        assert.deepEqual(recipientIds({ uid: 'u1' }), ['u1']);
    });
});
