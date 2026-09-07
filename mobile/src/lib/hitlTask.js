/**
 * 사람이 답해야 이어지는 작업에 답한다.
 *
 * 규칙은 @/shared/hitlFeedback 에 있다(포털과 같은 한 벌). 여기서는 그 규칙에
 * 데이터베이스 쓰기를 붙이기만 한다.
 *
 * 마지막에 `draft_status = 'FB_REQUESTED'` 를 반드시 남겨야 워커가 깨어난다.
 * 이것이 빠지면 답을 해도 작업은 멈춘 그대로다 — 실제로 그랬다.
 */

import {
    allAnswered,
    mergeFeedback,
    parseOutput,
    questionIds,
    unansweredIds
} from '../../../src/shared/hitlFeedback/index.js';

/**
 * 화면에 물어볼 것들.
 *
 * 물음 식별자는 `<todo>-dmn_apply` 처럼 무엇을 묻는지가 뒤에 붙는다.
 * 사용자에게는 그 부분을 사람 말로 바꿔 보여 준다.
 */
const LABELS = {
    dmn_apply: { title: '판단 규칙(DMN)을 함께 만들까요?', hint: '조건에 따라 갈라지는 흐름을 규칙표로 만듭니다.' },
    skills: { title: '필요한 스킬을 함께 만들까요?', hint: '각 단계가 쓸 기능을 만들어 붙입니다.' },
    agents: { title: '담당 에이전트를 함께 만들까요?', hint: '단계를 대신 처리할 에이전트를 만듭니다.' }
};

/**
 * 무엇을 만들 것인지 이름을 뽑는다.
 *
 * "만들까요?" 만 물으면 사용자는 **무엇을** 만드는지 모른 채 답해야 한다.
 * 만들어질 것들의 이름을 함께 보여 준다.
 */
export function itemsFor(output, key) {
    const state = parseOutput(output)?.hitl_checkpoint?.workflow_state || {};
    const source =
        key === 'dmn_apply' ? state.dmn_decisions || state.dmn_rules : key === 'skills' ? state.skill_docs : null;

    return (Array.isArray(source) ? source : [])
        .map((x) => (typeof x === 'string' ? x : x?.name || x?.title || x?.id || ''))
        .map((v) => String(v).trim())
        .filter(Boolean);
}

/** 이 작업이 어느 대화에서 시작됐는가. 돌아갈 곳을 알려 준다. */
export function originRoomId(task) {
    const text = `${task?.description || ''}`;
    const m = text.match(/"room_id"\s*:\s*"([^"]+)"/);
    return m ? m[1] : '';
}

export function toQuestions(output) {
    const pending = new Set(unansweredIds(output));

    return questionIds(output).map((id) => {
        const key = Object.keys(LABELS).find((k) => id.endsWith(k)) || '';
        const label = LABELS[key] || { title: '이 항목을 함께 만들까요?', hint: '' };
        const items = itemsFor(output, key);
        return {
            id,
            title: label.title,
            hint: label.hint,
            // 만들어질 것들. 비어 있으면 대상이 없다는 뜻이라 화면이 그렇게 말한다.
            items,
            answered: !pending.has(id)
        };
    });
}

/**
 * 만들 대상이 하나도 없는 물음들.
 *
 * "판단 규칙을 만들까요?" 라고 물으면서 만들 규칙이 하나도 없으면, 사용자는
 * 아무 뜻도 없는 선택을 강요받고 작업은 그동안 멈춰 있는다. 물을 이유가 없다.
 * 이런 물음은 화면이 대신 "아니오" 로 답해 작업을 이어 간다.
 */
export function emptyQuestionIds(output) {
    return toQuestions(output)
        .filter((q) => !q.answered && q.items.length === 0)
        .map((q) => q.id);
}

/** 물어볼 것이 하나라도 있는가. 없으면 사람을 붙잡지 않는다. */
export function hasRealQuestion(output) {
    return toQuestions(output).some((q) => !q.answered && q.items.length > 0);
}

/** 아직 답할 것이 남았는가. */
export function hasPending(output) {
    return unansweredIds(output).length > 0;
}

/**
 * 답 하나를 저장한다. 다 채워지면 워커를 깨운다.
 *
 * @returns {{ok: boolean, resumed: boolean}}
 */
export async function submitAnswer({ supabase, taskId, questionId, answer, reason = '' }) {
    if (!supabase || !taskId || !questionId) return { ok: false, resumed: false };

    try {
        const { data, error } = await supabase.from('todolist').select('id, output').eq('id', taskId).limit(1);
        if (error) throw error;

        const row = Array.isArray(data) && data.length ? data[0] : null;
        const next = mergeFeedback(parseOutput(row?.output), { question_id: questionId, answer, reason });

        const { error: writeError } = await supabase.from('todolist').update({ output: next }).eq('id', taskId);
        if (writeError) throw writeError;

        // 다 답했으면 여기서 워커가 다시 깨어난다.
        if (!allAnswered(next)) return { ok: true, resumed: false };

        const { error: resumeError } = await supabase
            .from('todolist')
            .update({ draft_status: 'FB_REQUESTED' })
            .eq('id', taskId);
        if (resumeError) throw resumeError;

        return { ok: true, resumed: true };
    } catch (e) {
        console.error('[hitl] 답변 저장 실패', e);
        return { ok: false, resumed: false };
    }
}
