import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emptyQuestionIds, hasPending, hasRealQuestion, itemsFor, originRoomId, submitAnswer, toQuestions } from './hitlTask.js';

const OUTPUT = {
    hitl_paused: true,
    hitl_feedbacks: [],
    hitl_checkpoint: {
        wait_started_at: '2026-09-03T05:54:19.971Z',
        question_ids: { dmn: 'todo-1-dmn_apply', agents: {}, skills: {} }
    }
};

describe('toQuestions', () => {
    it('식별자를 사람이 읽을 물음으로 바꾼다', () => {
        const q = toQuestions(OUTPUT);
        assert.equal(q.length, 1);
        assert.match(q[0].title, /판단 규칙/);
        assert.equal(q[0].answered, false);
    });

    it('모르는 물음도 빠뜨리지 않는다 — 답 못 하면 작업이 멈춘 채로 남는다', () => {
        const out = { hitl_checkpoint: { question_ids: { x: 'todo-1-unknown_thing' } } };
        assert.equal(toQuestions(out).length, 1);
    });
});

describe('hasPending', () => {
    it('답할 것이 남았는지 알려 준다', () => {
        assert.equal(hasPending(OUTPUT), true);
        assert.equal(hasPending({}), false);
    });
});

describe('submitAnswer', () => {
    function fakeSupabase(row, sink) {
        return {
            from() {
                return {
                    select: () => ({ eq: () => ({ limit: async () => ({ data: [row] }) }) }),
                    update: (patch) => ({
                        eq: async () => {
                            sink.push(patch);
                            return {};
                        }
                    })
                };
            }
        };
    }

    it('답을 기록하고, 다 차면 워커를 깨운다', async () => {
        const sink = [];
        const result = await submitAnswer({
            supabase: fakeSupabase({ id: 't1', output: OUTPUT }, sink),
            taskId: 't1',
            questionId: 'todo-1-dmn_apply',
            answer: '예'
        });

        assert.deepEqual(result, { ok: true, resumed: true });
        assert.equal(sink.length, 2);
        assert.equal(sink[0].output.hitl_feedbacks[0].answer, '예');
        // 이 한 줄이 없으면 답을 해도 작업이 영원히 멈춰 있는다.
        assert.deepEqual(sink[1], { draft_status: 'FB_REQUESTED' });
    });

    it('아직 남은 물음이 있으면 깨우지 않는다', async () => {
        const two = {
            ...OUTPUT,
            hitl_checkpoint: {
                ...OUTPUT.hitl_checkpoint,
                question_ids: { dmn: 'todo-1-dmn_apply', skills: { a: 'todo-1-skills' } }
            }
        };
        const sink = [];
        const result = await submitAnswer({
            supabase: fakeSupabase({ id: 't1', output: two }, sink),
            taskId: 't1',
            questionId: 'todo-1-dmn_apply',
            answer: '예'
        });
        assert.deepEqual(result, { ok: true, resumed: false });
        assert.equal(sink.length, 1);
    });

    it('필요한 값이 없으면 아무것도 쓰지 않는다', async () => {
        assert.deepEqual(await submitAnswer({ supabase: null, taskId: 't', questionId: 'q', answer: '예' }), {
            ok: false,
            resumed: false
        });
    });
});

describe('무엇을 만드는지 보여 주기', () => {
    it('만들어질 것들의 이름을 함께 준다 — "만들까요?" 만으로는 답할 수 없다', () => {
        const out = {
            hitl_checkpoint: {
                question_ids: { dmn: 't-dmn_apply' },
                workflow_state: { dmn_decisions: [{ name: '휴가 승인 판단' }, '연차 잔여 확인'] }
            }
        };
        assert.deepEqual(toQuestions(out)[0].items, ['휴가 승인 판단', '연차 잔여 확인']);
    });

    it('대상이 없으면 빈 목록 — 화면이 그렇게 말할 수 있다', () => {
        const out = { hitl_checkpoint: { question_ids: { dmn: 't-dmn_apply' }, workflow_state: { dmn_decisions: [] } } };
        assert.deepEqual(toQuestions(out)[0].items, []);
    });

    it('스킬은 skill_docs 에서 뽑는다', () => {
        const out = {
            hitl_checkpoint: { question_ids: { s: 't-skills' }, workflow_state: { skill_docs: [{ title: '휴가일수 계산' }] } }
        };
        assert.deepEqual(toQuestions(out)[0].items, ['휴가일수 계산']);
    });
});

describe('originRoomId', () => {
    it('어느 대화에서 시작됐는지 찾아낸다 — "대화로" 가 엉뚱한 곳으로 가면 안 된다', () => {
        assert.equal(originRoomId({ description: 'x "room_id": "room-9", y' }), 'room-9');
        assert.equal(originRoomId({ description: '없음' }), '');
        assert.equal(originRoomId(null), '');
    });
});

describe('만들 대상이 없는 물음', () => {
    const empty = {
        hitl_checkpoint: { question_ids: { dmn: 't-dmn_apply' }, workflow_state: { dmn_decisions: [] } }
    };
    const real = {
        hitl_checkpoint: { question_ids: { dmn: 't-dmn_apply' }, workflow_state: { dmn_decisions: ['휴가 승인 판단'] } }
    };

    it('만들 것이 없으면 물을 이유가 없다 — 뜻 없는 선택을 강요하면 안 된다', () => {
        assert.deepEqual(emptyQuestionIds(empty), ['t-dmn_apply']);
        assert.equal(hasRealQuestion(empty), false);
    });

    it('만들 것이 있으면 사람에게 묻는다', () => {
        assert.deepEqual(emptyQuestionIds(real), []);
        assert.equal(hasRealQuestion(real), true);
    });

    it('이미 답한 것은 다시 묻지 않는다', () => {
        const answered = {
            ...empty,
            hitl_checkpoint: { ...empty.hitl_checkpoint, wait_started_at: '2026-01-01T00:00:00Z' },
            hitl_feedbacks: [{ question_id: 't-dmn_apply', answer: '아니오', submitted_at: '2026-01-02T00:00:00Z' }]
        };
        assert.deepEqual(emptyQuestionIds(answered), []);
    });
});
