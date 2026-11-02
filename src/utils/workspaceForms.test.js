/* eslint-env node, es2020 */
// 대화 저장의 폼 연결 규칙 — 편집기 폼 저장(GPTUserTaskPanel)과 같은 폼 id·activity id·참조 형식이 나와야 한다.
import test from 'node:test';
import assert from 'node:assert/strict';

import { collectWorkspaceForms, formIdFor, isWorkspaceFormFile, linkWorkspaceForms, toSnakeId } from './workspaceForms.js';

const DIR = '/workspace/.bpmn/room/leave-request';
const form = (
    name,
    content = "<section><div class='row'><div class='col-sm-12'><text-field name='a'></text-field></div></div></section>"
) => ({
    path: `${DIR}/forms/${name}`,
    name,
    ext: name.slice(name.lastIndexOf('.')),
    content
});

// 마무리 단계(_complete_one_process)를 거치지 않은 정의 — 작성 단계 id 가 그대로 남아 있다.
function authoringDefinition() {
    return {
        processDefinitionId: 'leave_request_process',
        activities: [
            { id: 'apply_leave', tool: 'formHandler:apply_leave', inputData: ['review_leave.reject_reason'] },
            { id: 'review_leave', tool: 'formHandler:review_leave', inputData: ['apply_leave.leave_type', 'leave_days'] }
        ],
        gateways: [{ id: 'approval_gateway', conditionData: ['review_leave.decision'] }],
        sequences: []
    };
}

test('폼 id 는 편집기와 같다: <프로세스>_<activity>_form, 소문자', () => {
    assert.equal(formIdFor('leave_request_process', 'apply_leave'), 'leave_request_process_apply_leave_form');
    assert.equal(formIdFor('Proc.A', 'reviewLeave'), 'proc_a_reviewleave_form');
    assert.equal(toSnakeId('reviewLeave'), 'review_leave');
});

test('forms/ 아래 .form·.html 만 폼 파일이다', () => {
    assert.equal(isWorkspaceFormFile(form('a.form')), true);
    assert.equal(isWorkspaceFormFile(form('a.html')), true);
    assert.equal(isWorkspaceFormFile({ path: `${DIR}/report.html`, name: 'report.html', ext: '.html', content: 'x' }), false);
    assert.equal(isWorkspaceFormFile({ path: `${DIR}/forms/a.json`, name: 'a.json', ext: '.json', content: '{}' }), false);
});

test('작성 단계 id 가 남은 정의 — activity.tool·참조정보·conditionData 가 저장할 폼 id 를 가리키게 된다', () => {
    const def = authoringDefinition();
    const forms = linkWorkspaceForms(
        def,
        collectWorkspaceForms([form('apply_leave.form'), form('review_leave.form')], 'leave_request_process', def)
    );

    assert.deepEqual(
        forms.map((f) => [f.formId, f.activityId]),
        [
            ['leave_request_process_apply_leave_form', 'apply_leave'],
            ['leave_request_process_review_leave_form', 'review_leave']
        ]
    );
    assert.equal(def.activities[0].tool, 'formHandler:leave_request_process_apply_leave_form');
    assert.equal(def.activities[1].tool, 'formHandler:leave_request_process_review_leave_form');
    assert.deepEqual(def.gateways[0].conditionData, ['leave_request_process_review_leave_form.decision']);
    assert.deepEqual(def.activities[0].inputData, ['leave_request_process_review_leave_form.reject_reason']);
    // 점이 없는 값(프로세스 변수 등)은 그대로
    assert.deepEqual(def.activities[1].inputData, ['leave_request_process_apply_leave_form.leave_type', 'leave_days']);
});

test('마무리 단계가 이미 저장용 id 로 바꿔 둔 정의는 그 id 를 그대로 쓴다', () => {
    const P = '3ca712d5-07a5-488c-9ae3-99a409d4c022';
    const def = {
        activities: [{ id: 'review_leave', tool: `formHandler:${P}_review_leave_form` }],
        gateways: [{ id: 'approval_gateway', conditionData: [`${P}_review_leave_form.approval_gateway_decision`] }]
    };
    const before = JSON.stringify(def);
    const forms = linkWorkspaceForms(def, collectWorkspaceForms([form('review_leave.form')], P, def));
    assert.equal(forms[0].formId, `${P}_review_leave_form`);
    assert.equal(forms[0].activityId, 'review_leave');
    assert.equal(JSON.stringify(def), before);
});

test('camelCase activity — form_def.activity_id 는 BPMN 요소 id 그대로(엔진이 proc_def_id+activity_id 로 찾는다)', () => {
    const def = {
        activities: [{ id: 'reviewLeave', tool: 'formHandler:reviewLeave' }],
        gateways: [{ id: 'gw', conditionData: ['reviewLeave.decision'] }]
    };
    // 파일명은 snake 로 왔다
    const forms = linkWorkspaceForms(def, collectWorkspaceForms([form('review_leave.form')], 'p1', def));
    assert.equal(forms[0].activityId, 'reviewLeave');
    assert.equal(forms[0].formId, 'p1_reviewleave_form');
    assert.equal(def.activities[0].tool, 'formHandler:p1_reviewleave_form');
    assert.deepEqual(def.gateways[0].conditionData, ['p1_reviewleave_form.decision']);
});

test('tool 이 기본 폼이거나 비어 있어도 파일명으로 activity 를 찾아 연결한다', () => {
    const def = { activities: [{ id: 'apply_leave', tool: 'formHandler:defaultform' }, { id: 'confirm_leave' }] };
    linkWorkspaceForms(def, collectWorkspaceForms([form('apply_leave.html'), form('confirm_leave.form')], 'p', def));
    assert.equal(def.activities[0].tool, 'formHandler:p_apply_leave_form');
    assert.equal(def.activities[1].tool, 'formHandler:p_confirm_leave_form');
});

test('정의에 없는 폼 파일은 예전처럼 파일명으로 저장하고 정의는 건드리지 않는다', () => {
    const def = { activities: [{ id: 'apply_leave', tool: 'formHandler:apply_leave' }] };
    const forms = linkWorkspaceForms(def, collectWorkspaceForms([form('extraForm.form')], 'p', def));
    assert.deepEqual(
        forms.map((f) => [f.formId, f.activityId]),
        [['p_extra_form_form', 'extra_form']]
    );
    assert.equal(def.activities[0].tool, 'formHandler:apply_leave');
});

test('서브프로세스 안의 activity·게이트웨이도 연결한다', () => {
    const def = {
        activities: [],
        subProcesses: [
            {
                id: 'sp',
                children: {
                    activities: [{ id: 'inner_task', tool: 'formHandler:inner_task' }],
                    gateways: [{ id: 'inner_gw', conditionData: ['inner_task.ok'] }]
                }
            }
        ]
    };
    linkWorkspaceForms(def, collectWorkspaceForms([form('inner_task.form')], 'p', def));
    assert.equal(def.subProcesses[0].children.activities[0].tool, 'formHandler:p_inner_task_form');
    assert.deepEqual(def.subProcesses[0].children.gateways[0].conditionData, ['p_inner_task_form.ok']);
});

test('내용이 빈 폼 파일·같은 폼의 중복 파일은 한 번만 저장한다', () => {
    const def = { activities: [{ id: 'a' }] };
    const forms = collectWorkspaceForms([form('a.form'), form('a.html'), form('b.form', '')], 'p', def);
    assert.deepEqual(
        forms.map((f) => f.formId),
        ['p_a_form']
    );
});
