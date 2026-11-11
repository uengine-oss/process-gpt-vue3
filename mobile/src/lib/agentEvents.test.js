import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { feedState, isFinished, isWaitingForUser, latestText, loadEvents, toFeed, toFeedItem } from './agentEvents.js';

const ev = (seq, type, message) => ({ id: `e${seq}`, seq, event_type: type, data: { message } });

describe('toFeedItem', () => {
    it('대괄호 꼬리표는 단계 이름으로 떼어 낸다', () => {
        const item = toFeedItem(ev(4, 'tool_usage_started', '[FORM] 폼 생성 시작 (1/4): 휴가 신청 프로세스'));
        assert.equal(item.tag, 'FORM');
        assert.equal(item.text, '폼 생성 시작 (1/4): 휴가 신청 프로세스');
        assert.equal(item.done, false);
    });

    it('끝난 단계는 끝났다고 표시한다', () => {
        assert.equal(toFeedItem(ev(9, 'tool_usage_finished', '[FORM] 폼 저장 성공')).done, true);
    });

    it('실패도 구분한다 — 조용히 멈춘 것처럼 보이면 안 된다', () => {
        assert.equal(toFeedItem(ev(9, 'task_failed', '오류')).failed, true);
    });

    it('보여 줄 말이 없으면 줄을 만들지 않는다', () => {
        assert.equal(toFeedItem({ event_type: 'task_started', data: {} }), null);
        assert.equal(toFeedItem(null), null);
    });

    it('꼬리표가 없으면 본문 전체가 내용이다', () => {
        assert.equal(toFeedItem(ev(1, 'task_started', '작업을 시작합니다')).text, '작업을 시작합니다');
    });
});

describe('toFeed', () => {
    it('순서대로 세운다', () => {
        const feed = toFeed([ev(3, 'tool_usage_started', 'c'), ev(1, 'task_started', 'a')]);
        assert.deepEqual(feed.map((f) => f.text), ['a', 'c']);
    });

    it('같은 이벤트가 두 번 와도 한 번만 — 구독과 최초 조회가 겹친다', () => {
        const feed = toFeed([ev(1, 'task_started', 'a'), ev(1, 'task_started', 'a')]);
        assert.equal(feed.length, 1);
    });

    it('빈 목록', () => {
        assert.deepEqual(toFeed(null), []);
    });
});

describe('isFinished / latestText', () => {
    it('끝을 알아본다', () => {
        assert.equal(isFinished(ev(9, 'task_completed', 'x')), true);
        assert.equal(isFinished(ev(9, 'tool_usage_started', 'x')), false);
    });

    it('가장 최근 한 줄', () => {
        assert.equal(latestText(toFeed([ev(1, 'task_started', 'a'), ev(2, 'tool_usage_started', 'b')])), 'b');
        assert.equal(latestText([]), '');
    });
});

describe('사람을 기다리는 상태', () => {
    const wait = { id: 'w', seq: 9, event_type: 'waiting_for_user', data: { message: '[HITL] 사용자 확인 대기 중: 스킬/에이전트/DMN 생성 결정' } };

    it('멈춰서 사람을 기다리는 것을 알아본다 — "처리 중" 이라고 하면 영원히 안 끝난다', () => {
        assert.equal(isWaitingForUser(wait), true);
        assert.equal(toFeedItem(wait).waiting, true);
        assert.equal(toFeedItem(wait).tag, 'HITL');
    });

    it('마지막이 대기면 전체 상태도 대기다', () => {
        assert.equal(feedState([ev(1, 'task_started', 'a'), wait]), 'waiting');
    });

    it('대기 뒤에 완료 이벤트가 와도 사람이 답하기 전까지는 대기다', () => {
        assert.equal(feedState([wait, ev(10, 'task_completed', '끝')]), 'waiting');
    });

    it('평범한 진행과 완료', () => {
        assert.equal(feedState([ev(1, 'task_started', 'a')]), 'running');
        assert.equal(feedState([ev(1, 'task_started', 'a'), ev(2, 'task_completed', 'b')]), 'done');
        assert.equal(feedState([]), 'running');
    });
});

describe('지금 표(timestamp) · 딥 에이전트 이벤트', () => {
    const at = (s) => `2026-11-11T10:10:${String(s).padStart(2, '0')}+09:00`;
    const rows = [
        { id: 'b', event_type: 'task_completed', timestamp: at(24), data: { result: '함께 일할 에이전트: 제안서 문서 작성 에이전트\n이유…', team_agent_ids: ['x'] } },
        { id: 'a', event_type: 'task_started', timestamp: at(21), data: { goal: '제안서 작성 및 발송 작업을 시작합니다.' } },
        { id: 'c', event_type: 'tool_usage_started', timestamp: at(28), data: { tool_name: 'get_form_fields' } },
        { id: 'd', event_type: 'task_completed', timestamp: at(53), data: { result: '{"form": {}}', agent_summary: '요약' } }
    ];

    it('seq 가 없으면 시간 순서로 세운다', () => {
        assert.deepEqual(toFeed(rows).map((f) => f.id), ['a', 'b', 'c']);
    });

    it('goal · 도구 이름 · 팀 구성 첫 줄을 사람 말로 보여 주고, 폼 값 결과는 싣지 않는다', () => {
        const feed = toFeed(rows);
        assert.equal(feed[0].text, '제안서 작성 및 발송 작업을 시작합니다.');
        assert.equal(feed[1].text, '함께 일할 에이전트: 제안서 문서 작성 에이전트');
        assert.equal(feed[2].text, '폼 필드 조회 쓰는 중');
    });

    it('loadEvents 는 timestamp 로 읽고, 그 열이 없으면 seq 로 다시 읽는다', async () => {
        const calls = [];
        const fake = (failOn) => ({
            from: () => ({
                select: () => ({
                    eq: () => {
                        const q = {
                            order: async (col) => {
                                calls.push(col);
                                return col === failOn ? { data: null, error: { message: `column events.${col} does not exist` } } : { data: rows, error: null };
                            },
                            then: (res) => res({ data: rows, error: null })
                        };
                        return q;
                    }
                })
            })
        });
        const got = await loadEvents(fake('timestamp'), 't1');
        assert.deepEqual(calls, ['timestamp', 'seq']);
        assert.deepEqual(got.map((r) => r.id), ['a', 'b', 'c', 'd']);
        calls.length = 0;
        await loadEvents(fake('seq'), 't1');
        assert.deepEqual(calls, ['timestamp']);
    });
});
