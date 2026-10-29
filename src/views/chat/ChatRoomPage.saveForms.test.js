/* eslint-env node, es2020 */
/* eslint-disable @typescript-eslint/no-empty-function -- 저장 경로와 상관없는 협력자는 빈 함수로 둔다 */
/**
 * 작업 폴더 「저장」(handleSaveWorkspaceFiles)과 생성 직후 임시저장(runDraftValidationForRoom)이
 * 폼을 편집기 폼 저장과 같은 모양으로 남기는지 지킨다.
 *
 * 실제 사고(튜토리얼 조사 A): 딥 에이전트가 만든 휴가 신청 프로세스를 대화에서 저장하고 실행하자
 * 폼 값이 엔진에 가지 않고 승인 갈림길이 PENDING 으로 멈췄다. 정의의 activity.tool 은
 * `formHandler:apply_leave`(작성 단계 id)인데 form_def 는 `<프로세스>_apply_leave_form` 으로 저장돼
 * 실행 화면이 기본 폼을 띄웠고, 게이트웨이 conditionData `review_leave.decision` 은 엔진이 찾는
 * 폼 id 를 가리키지 않았다. 편집기에서 폼마다 다시 저장하면(activity.tool 을 저장한 폼 id 로 맞춘다) 풀렸다.
 *
 * 폼 HTML 은 실제 저장 정규화(formHtml.normalizeFormRowLayout)를 거친 결과로 확인한다.
 * SFC 를 번들 없이 테스트하려고 메서드 본문을 파일에서 꺼내 쓴다(ChatRoomPage.serverContent.test.js 와 같은 방식).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DOMParser as LinkedomParser } from 'linkedom';

import * as agentIdModule from '../../utils/agentId.js';
import { extractFields, normalizeFormRowLayout } from '../../utils/formHtml.js';

class DOMParser {
    parseFromString(html, type) {
        const full = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`;
        return new LinkedomParser().parseFromString(full, type);
    }
}
const P = { DOMParser };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(HERE, 'ChatRoomPage.vue'), 'utf8');

function extractMethod(name) {
    let start = source.indexOf(`\n        ${name}(`);
    let isAsync = false;
    if (start === -1) {
        start = source.indexOf(`\n        async ${name}(`);
        isAsync = true;
    }
    assert.notEqual(start, -1, `method not found in ChatRoomPage.vue: ${name}`);
    const paramStart = source.indexOf('(', start);
    let parens = 0;
    let cursor = paramStart;
    for (; cursor < source.length; cursor++) {
        if (source[cursor] === '(') parens++;
        else if (source[cursor] === ')' && --parens === 0) break;
    }
    const bodyStart = source.indexOf('{', cursor);
    let depth = 0;
    let end = bodyStart;
    for (; end < source.length; end++) {
        if (source[end] === '{') depth++;
        else if (source[end] === '}' && --depth === 0) break;
    }
    const signature = source.slice(paramStart, cursor + 1);
    // 꺼낸 메서드는 번들러 밖에서 돌므로 '@/utils/…' 동적 import 를 실제 파일 주소로 바꾼다.
    const body = source
        .slice(bodyStart, end + 1)
        .replace(/import\('@\/utils\/([^']+)'\)/g, (m, file) => `import('${pathToFileURL(path.join(HERE, '../../utils', file)).href}')`);
    return `${name}: ${isAsync ? 'async ' : ''}function ${signature}${body}`;
}

const METHODS = ['handleSaveWorkspaceFiles', 'runDraftValidationForRoom', '_collectAgentSkillNames'];

function buildComponent() {
    const procDefs = [];
    const forms = [];
    // 꺼낸 메서드가 모듈 스코프에서 쓰는 이름들(브랜치마다 쓰는 헬퍼가 달라 모듈 전체를 올린다).
    // 폼 연결 규칙(workspaceForms)은 전역에 두지 않는다 — 메서드가 '@/utils/elementsToFlattened.js' 동적 import 로 받는다.
    Object.assign(globalThis, agentIdModule, { isUuidStable: agentIdModule.isUuid });
    globalThis.getTenantId = () => 'tutorial';
    globalThis.backend = {
        putObject: async (key, row) => {
            if (key === 'proc_def') procDefs.push(row);
        },
        putAgent: async () => {},
        // ProcessGPTBackend.putRawDefinition(type: 'form') 과 같은 정규화·필드 추출
        putRawDefinition: async (body, id, options = {}) => {
            if (options.type === 'form') {
                const html = normalizeFormRowLayout(body, P);
                forms.push({
                    id,
                    proc_def_id: options.proc_def_id,
                    activity_id: options.activity_id,
                    html,
                    fields_json: extractFields(html, P)
                });
            } else {
                procDefs.push({ id, bpmn: body, definition: options.definition, is_draft: options.is_draft });
            }
        },
        validateAndImproveDraft: async () => null,
        deleteDraftProcDef: async () => {},
        promoteProcessScenarios: async () => {}
    };
    // eslint-disable-next-line no-eval
    const methods = (0, eval)(`({${METHODS.map(extractMethod).join(',\n')}})`);
    const vm = {
        ...methods,
        workspaceSaveStateByGroup: {},
        roomWorkspaceFilesByGroup: {},
        messages: [],
        currentChatRoom: null,
        roomId: '',
        userInfo: {},
        _processGroupKey: () => 'process-a1b2c3d',
        _workspaceFileBaseName: (f) => (f.name || f.path.split('/').pop() || '').toLowerCase(),
        _buildBpmnXmlFromDefinition: () => '<bpmn/>',
        _uploadSkillsFromFiles: async () => [],
        _upsertProcMapEntry: async () => {},
        _markWorkspaceFilesSaved() {},
        upsertWorkspaceFilesPanel() {},
        createMessageObj: (content) => ({ content }),
        uuid: () => 'msg-1',
        $t: (key) => key,
        $nextTick(fn) {
            fn();
        },
        $forceUpdate() {}
    };
    return { vm, procDefs, forms };
}

const DIR = '/workspace/.bpmn/room/process-a1b2c3d';

// 마무리 단계(_complete_one_process)를 거치지 않은 딥 에이전트 산출물 — 조사 A 의 휴가 신청 프로세스를 줄인 것.
function workspaceFiles() {
    const pd = {
        processDefinitionId: 'leave_request_process',
        processDefinitionName: '휴가 신청 프로세스',
        roles: [{ name: '직원' }, { name: '팀장' }],
        elements: [
            { elementType: 'Event', id: 'start_event', type: 'StartEvent', role: '직원' },
            { elementType: 'Sequence', id: 'seq_start', source: 'start_event', target: 'apply_leave' },
            {
                elementType: 'Activity',
                id: 'apply_leave',
                name: '휴가 신청',
                role: '직원',
                tool: 'formHandler:apply_leave',
                inputData: ['review_leave.reject_reason']
            },
            { elementType: 'Sequence', id: 'seq_apply', source: 'apply_leave', target: 'review_leave' },
            {
                elementType: 'Activity',
                id: 'review_leave',
                name: '휴가 신청 검토',
                role: '팀장',
                tool: 'formHandler:review_leave',
                inputData: ['apply_leave.leave_type']
            },
            { elementType: 'Sequence', id: 'seq_review', source: 'review_leave', target: 'approval_gateway' },
            { elementType: 'Gateway', id: 'approval_gateway', type: 'ExclusiveGateway', conditionData: ['review_leave.decision'] },
            { elementType: 'Sequence', id: 'seq_ok', source: 'approval_gateway', target: 'end_event', condition: '승인인 경우' },
            { elementType: 'Sequence', id: 'seq_no', source: 'approval_gateway', target: 'apply_leave', condition: '반려인 경우' },
            { elementType: 'Event', id: 'end_event', type: 'EndEvent', role: '팀장' }
        ]
    };
    const applyForm = `<section>
  <div class='row' name='apply_leave_info' alias='휴가 신청 정보' is_multidata_mode='false'>
    <div class='col-sm-12'>
      <select-field name='leave_type' alias='휴가 종류' is_dynamic_load='fixed' items='[{"annual":"연차"},{"sick":"병가"}]' disabled='false' readonly='false'></select-field>
    </div>
  </div>
</section>`;
    const reviewForm = `<section>
  <div class='row' name='review_leave_decision' alias='검토 결과' is_multidata_mode='false'>
    <div class='col-sm-12'>
      <select-field name='decision' alias='승인 여부' is_dynamic_load='fixed' items='[{"승인":"승인"},{"반려":"반려"}]' disabled='false' readonly='false'></select-field>
    </div>
  </div>
</section>`;
    return [
        { path: `${DIR}/process-definition.json`, name: 'process-definition.json', ext: '.json', content: JSON.stringify(pd) },
        { path: `${DIR}/forms/apply_leave.form`, name: 'apply_leave.form', ext: '.form', content: applyForm },
        { path: `${DIR}/forms/review_leave.form`, name: 'review_leave.form', ext: '.form', content: reviewForm }
    ];
}

/** 실행 화면(FormWorkItem)·엔진이 폼을 찾는 방식대로 정의와 form_def 가 이어져 있는지 */
function assertLinked(definition, forms) {
    for (const activity of definition.activities) {
        const formId = activity.tool.replace('formHandler:', '');
        const row = forms.find((f) => f.id === formId);
        assert.ok(row, `${activity.id}: activity.tool(${activity.tool}) 이 가리키는 form_def 가 있어야 한다`);
        assert.equal(row.activity_id, activity.id, 'form_def.activity_id 는 BPMN 요소 id 그대로');
        assert.equal(row.proc_def_id, 'leave_request_process');
    }
    for (const ref of definition.gateways[0].conditionData) {
        const [formId, field] = ref.split('.');
        const row = forms.find((f) => f.id === formId);
        assert.ok(row, `conditionData ${ref} 의 폼이 저장돼 있어야 한다`);
        assert.ok(
            row.fields_json.some((f) => f.key === field),
            `conditionData ${ref} 의 필드가 폼에 있어야 한다`
        );
    }
}

test('작업 폴더 저장 — activity.tool·conditionData·참조정보가 저장한 form_def 를 가리킨다', async () => {
    const { vm, procDefs, forms } = buildComponent();
    await vm.handleSaveWorkspaceFiles(workspaceFiles());

    assert.equal(vm.workspaceSaveStateByGroup['process-a1b2c3d'].saved, true);
    const def = procDefs[0].definition;
    assert.deepEqual(
        forms.map((f) => f.id),
        ['leave_request_process_apply_leave_form', 'leave_request_process_review_leave_form']
    );
    assert.equal(def.activities.find((a) => a.id === 'apply_leave').tool, 'formHandler:leave_request_process_apply_leave_form');
    assert.deepEqual(def.gateways[0].conditionData, ['leave_request_process_review_leave_form.decision']);
    assert.deepEqual(def.activities.find((a) => a.id === 'review_leave').inputData, ['leave_request_process_apply_leave_form.leave_type']);
    assertLinked(def, forms);
});

test('작업 폴더 저장 — 폼 HTML 은 편집기 저장과 같은 실행 형식(row-layout + 필드마다 v-model)', async () => {
    const { vm, forms } = buildComponent();
    await vm.handleSaveWorkspaceFiles(workspaceFiles());

    const review = forms.find((f) => f.activity_id === 'review_leave');
    const rowLayout = review.html.match(/<row-layout [^>]*>/);
    assert.ok(rowLayout, 'div.row 는 row-layout 으로 감싼다');
    assert.match(rowLayout[0], /v-model="formValues"/);
    assert.match(rowLayout[0], /v-slot="slotProps"/);
    assert.match(review.html, /<select-field [^>]*v-model="slotProps\.modelValue\['decision'\]"/);
    assert.deepEqual(
        review.fields_json.map((f) => f.key),
        ['decision']
    );
    // 편집기에서 다시 저장해도(정규화를 한 번 더 거쳐도) 같은 HTML 이다.
    assert.equal(normalizeFormRowLayout(review.html, P), review.html);
});

test('생성 직후 임시저장(검증)도 최종 저장과 같은 폼 id·연결로 남긴다', async () => {
    const { vm, procDefs, forms } = buildComponent();
    vm.roomWorkspaceFilesByGroup = { 'process-a1b2c3d': workspaceFiles() };
    await vm.runDraftValidationForRoom();

    const draft = procDefs.find((p) => p.is_draft === true);
    assert.ok(draft, 'draft proc_def 를 저장한다');
    assert.equal(vm.workspaceSaveStateByGroup['process-a1b2c3d'].error || '', '');
    assertLinked(draft.definition, forms);

    // 이어서 최종 저장 — 같은 form_def 행(id·activity_id)을 갱신한다.
    const draftIds = forms.map((f) => `${f.id}|${f.activity_id}`);
    vm.workspaceSaveStateByGroup = {};
    await vm.handleSaveWorkspaceFiles(workspaceFiles());
    const finalIds = forms.slice(draftIds.length).map((f) => `${f.id}|${f.activity_id}`);
    assert.deepEqual(finalIds, draftIds);
});

test('작업 폴더의 파일 내용(process-definition.json)은 바꾸지 않는다', async () => {
    const { vm } = buildComponent();
    const files = workspaceFiles();
    const before = files[0].content;
    await vm.handleSaveWorkspaceFiles(files);
    assert.equal(files[0].content, before);
});
