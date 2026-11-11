/* eslint-env node, es2020 */
/* eslint-disable @typescript-eslint/no-empty-function -- 검증 흐름과 상관없는 협력자는 빈 함수로 둔다 */
/**
 * 채팅 임시저장(draft)·정리가 사용자가 저장한 정의를 덮어쓰거나 지우지 않는지 지킨다.
 *
 * 실제 사고(VM 녹화, 고치기 두 번): 저장한 정의 「한빛오피스 대량 주문 견적 승인」을 같은 방에서 고치자
 * 차례 끝마다 runDraftValidationForRoom 이 같은 id 로 draft 를 덮어써(PostgREST POST 200, is_draft=true —
 * 체계도에서 사라짐) 다음 차례 정리가 id 만으로 지웠다(DELETE 204). 「저장」을 다시 눌러야(POST 201) 생겼고,
 * 고치기가 실패해 저장하지 않은 회차에서는 정의가 그대로 사라졌다(폼 7개만 남음).
 *
 * SFC 를 번들 없이 테스트하기 위해 메서드 본문을 파일에서 직접 꺼내 쓴다(ChatRoomPage.serverContent.test.js 와 같은 방식).
 * 백엔드의 정리 메서드도 ProcessGPTBackend.ts 에서 꺼내 가짜 저장소로 돌린다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as agentIdModule from '../../utils/agentId.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(HERE, 'ChatRoomPage.vue'), 'utf8');
const backendSource = fs.readFileSync(path.join(HERE, '../../components/api/ProcessGPTBackend.ts'), 'utf8');
const FLATTEN_URL = pathToFileURL(path.join(HERE, '../../utils/elementsToFlattened.js')).href;

/** 들여쓰기 indent 로 시작하는 메서드를 { 본문 } 까지 꺼낸다. */
function sliceMethod(text, name, indent) {
    let start = text.indexOf(`\n${indent}${name}(`);
    let isAsync = false;
    if (start === -1) {
        start = text.indexOf(`\n${indent}async ${name}(`);
        isAsync = true;
    }
    assert.notEqual(start, -1, `method not found: ${name}`);
    const paramStart = text.indexOf('(', start);
    let parens = 0;
    let cursor = paramStart;
    for (; cursor < text.length; cursor++) {
        if (text[cursor] === '(') parens++;
        else if (text[cursor] === ')' && --parens === 0) break;
    }
    const bodyStart = text.indexOf('{', cursor);
    let depth = 0;
    let end = bodyStart;
    for (; end < text.length; end++) {
        if (text[end] === '{') depth++;
        else if (text[end] === '}' && --depth === 0) break;
    }
    return { isAsync, signature: text.slice(paramStart, cursor + 1), body: text.slice(bodyStart, end + 1) };
}

function extractMethod(name) {
    const { isAsync, signature, body } = sliceMethod(source, name, '        ');
    // 꺼낸 메서드는 번들러 밖에서 돌므로 '@/' 별칭 import 를 실제 파일 주소로 바꾼다.
    const fixed = body.replace("import('@/utils/elementsToFlattened.js')", `import('${FLATTEN_URL}')`);
    return `${name}: ${isAsync ? 'async ' : ''}function ${signature}${fixed}`;
}

/** ProcessGPTBackend.ts 의 메서드를 타입을 지운 JS 로 꺼낸다. */
function extractBackendMethod(name) {
    const { isAsync, signature, body } = sliceMethod(backendSource, name, '    ');
    let code = `({ ${isAsync ? 'async ' : ''}${name}${signature}${body} })`;
    const { stripTypeScriptTypes } = createRequire(import.meta.url)('node:module');
    if (typeof stripTypeScriptTypes === 'function') {
        code = stripTypeScriptTypes(code);
    } else {
        // 형 표기만 있는 짧은 메서드라 이 정도로 충분하다(Node 22.13 미만).
        code = code.replace(/:\s*(?:Promise<boolean>|string|any)(?=[\s,)=;{])/g, '');
    }
    return code;
}

const DIR = '/workspace/.bpmn/process-a1b2c3d';

function workspaceFiles(procId = 'quote_process') {
    const pd = {
        processDefinitionId: procId,
        processDefinitionName: '견적 요청 처리',
        roles: [{ name: '영업 담당자', endpoint: '' }],
        elements: [
            { elementType: 'Event', id: 'start', type: 'StartEvent', role: '영업 담당자' },
            {
                elementType: 'Activity',
                id: 'request_quote',
                name: '견적 요청 접수',
                role: '영업 담당자',
                tool: `formHandler:${procId}_request_quote_form`
            },
            { elementType: 'Sequence', id: 's1', source: 'start', target: 'request_quote' },
            { elementType: 'Event', id: 'end', type: 'EndEvent', role: '영업 담당자' },
            { elementType: 'Sequence', id: 's2', source: 'request_quote', target: 'end' }
        ]
    };
    return [
        { path: `${DIR}/process-definition.json`, name: 'process-definition.json', ext: '.json', content: JSON.stringify(pd) },
        {
            path: `${DIR}/forms/request_quote.form`,
            name: 'request_quote.form',
            ext: '.form',
            content: '<section><text-field name="company"></text-field></section>'
        }
    ];
}

function buildComponent({ savedIds = [] } = {}) {
    const calls = { put: [], validate: [], deleted: [], panel: [] };
    globalThis.getTenantId = () => 'tutorial';
    // 꺼낸 메서드가 모듈 스코프에서 쓰는 이름들(브랜치마다 쓰는 것이 조금씩 다르다).
    globalThis.slugToUuid = agentIdModule.slugToUuid;
    globalThis.agentStableId = agentIdModule.agentStableId;
    globalThis.isUuidStable = agentIdModule.isUuid;
    globalThis.collectWorkspaceAgents = agentIdModule.collectWorkspaceAgents || (() => []);
    globalThis.backend = {
        isSavedProcDef: async (id) => savedIds.includes(id),
        putRawDefinition: async (xml, id, options) => {
            calls.put.push({ id, options });
        },
        putAgent: async () => {},
        validateAndImproveDraft: async (id) => {
            calls.validate.push(id);
            // completion 은 받은 draft 의 정의를 고쳐 돌려준다(여기서는 그대로).
            const pd = JSON.parse(workspaceFiles()[0].content);
            return { passed: true, iterations: 1, final_definition: { ...pd, processDefinitionId: id } };
        },
        deleteDraftProcDef: async (id) => {
            calls.deleted.push(id);
        }
    };
    // eslint-disable-next-line no-eval
    const methods = (0, eval)(`({${['runDraftValidationForRoom', '_collectAgentSkillNames'].map(extractMethod).join(',\n')}})`);
    const vm = {
        ...methods,
        roomWorkspaceFilesByGroup: {},
        workspaceSaveStateByGroup: {},
        currentChatRoom: { id: 'room-1', context: {} },
        roomId: 'room-1',
        userInfo: { email: 'user@example.com', uid: 'user-1' },
        _workspaceFileBaseName: (f) => (f.name || f.path.split('/').pop() || '').toLowerCase(),
        _buildBpmnXmlFromDefinition: () => '<bpmn/>',
        _uploadSkillsFromFiles: async () => [],
        upsertWorkspaceFilesPanel(entry) {
            calls.panel.push(entry);
        },
        // 화면 언어 문구(feat/i18n-tutorial-path 가 이 메서드의 안내문을 $t 로 바꾼다) — 키를 그대로 돌려준다.
        $t: (key) => key,
        $forceUpdate() {}
    };
    return { vm, calls };
}

test('저장한 정의를 같은 방에서 고칠 때 draft 는 따로 둔 id 로만 쓰고, 검증이 끝나면 그 draft 만 지운다', async () => {
    const { vm, calls } = buildComponent({ savedIds: ['quote_process'] });
    vm.roomWorkspaceFilesByGroup = { 'process-a1b2c3d': workspaceFiles() };

    await vm.runDraftValidationForRoom();

    const procDefWrites = calls.put.filter((c) => c.options && c.options.type === 'bpmn');
    assert.deepEqual(
        procDefWrites.map((c) => c.id),
        ['quote_process__draft'],
        '저장된 정의(quote_process) 위에 draft 를 쓰면 is_draft=true 가 되어 체계도에서 사라진다'
    );
    assert.equal(procDefWrites[0].options.is_draft, true);
    assert.equal(
        calls.put.filter((c) => c.options && c.options.type === 'form').length,
        0,
        '저장된 정의의 폼(quote_process_*_form)을 고치기 후보로 덮어쓰지 않는다'
    );
    assert.deepEqual(calls.validate, ['quote_process__draft']);
    assert.deepEqual(calls.deleted, ['quote_process__draft'], '지우는 것은 검증용 draft 뿐');
    // 검증 결과는 패널에 원래 id 로 돌아간다(저장 버튼이 같은 정의를 덮어쓰게).
    assert.equal(calls.panel.length, 1);
    assert.equal(JSON.parse(calls.panel[0].content).processDefinitionId, 'quote_process');
    assert.deepEqual(vm._roomDraftIds || [], [], '저장된 정의는 정리 대상(draft id 목록)에 넣지 않는다');
});

test('처음 만든 프로세스는 예전처럼 그 id 로 draft 를 쓰고 폼도 쓴다', async () => {
    const { vm, calls } = buildComponent();
    vm.roomWorkspaceFilesByGroup = { 'process-a1b2c3d': workspaceFiles() };

    await vm.runDraftValidationForRoom();

    assert.deepEqual(
        calls.put.filter((c) => c.options && c.options.type === 'bpmn').map((c) => c.id),
        ['quote_process']
    );
    assert.equal(calls.put.filter((c) => c.options && c.options.type === 'form').length, 1);
    assert.deepEqual(calls.validate, ['quote_process']);
    assert.deepEqual(calls.deleted, []);
    assert.deepEqual(vm._roomDraftIds, ['quote_process']);
});

test('파일이 안 바뀐 다음 차례는 아직 화면에 있는 draft 를 지우지 않는다', async () => {
    const { vm, calls } = buildComponent();
    vm.roomWorkspaceFilesByGroup = { 'process-a1b2c3d': workspaceFiles() };
    await vm.runDraftValidationForRoom();
    // 같은 방의 다음 차례(질문·「네, 진행해 주세요」 등) — 그룹은 이미 검증됐다.
    await vm.runDraftValidationForRoom();

    assert.deepEqual(calls.deleted, [], '예전에는 이번 차례에 새로 만든 draft 가 없다고 화면의 draft 를 지웠다');
    assert.equal(calls.put.filter((c) => c.options && c.options.type === 'bpmn').length, 1, '다시 검증하지 않는다');
});

test('저장한 뒤 바뀌지 않은 그룹은(방을 다시 열어도) draft 를 쓰지도 검증하지도 않는다', async () => {
    const { vm, calls } = buildComponent({ savedIds: ['quote_process'] });
    vm.roomWorkspaceFilesByGroup = { 'process-a1b2c3d': workspaceFiles() };
    // 방을 다시 열면 상태가 비고, 저장 표식(savedHash)에서 st.saved 가 다시 도출된다.
    vm.workspaceSaveStateByGroup = { 'process-a1b2c3d': { saving: false, saved: true, error: '', passingCases: [] } };

    await vm.runDraftValidationForRoom();

    assert.deepEqual(calls.put, []);
    assert.deepEqual(calls.validate, []);
    assert.deepEqual(calls.deleted, []);
});

test('다른 id 로 다시 만든 차례는 옛 draft id 를 정리에 넘긴다(지울지는 백엔드가 is_draft 로 가린다)', async () => {
    const { vm, calls } = buildComponent();
    vm.roomWorkspaceFilesByGroup = { 'process-a1b2c3d': workspaceFiles('quote_process') };
    await vm.runDraftValidationForRoom();
    // 새 그룹으로 다른 id 의 프로세스를 만들었고 옛 그룹은 패널에서 빠졌다.
    vm.roomWorkspaceFilesByGroup = { 'process-e5f6a7b': workspaceFiles('quote_process_v2') };
    await vm.runDraftValidationForRoom();

    assert.deepEqual(calls.deleted, ['quote_process']);
    assert.deepEqual(vm._roomDraftIds, ['quote_process_v2']);
});

// ---------------------------------------------------------------------------
// ProcessGPTBackend — 정리는 is_draft=true 인 행만, 저장 여부는 is_draft 로 판단
// ---------------------------------------------------------------------------

function buildBackend(rows) {
    const deletes = [];
    globalThis.window = { ...(globalThis.window || {}), $tenantName: 'tutorial' };
    globalThis.withTenantMatch = (options) => ({ ...options, match: { tenant_id: 'tutorial', ...(options.match || {}) } });
    globalThis.storage = {
        delete: async (table, options) => {
            deletes.push({ table, match: options.match });
        },
        getObject: async (table, options) => {
            const m = options.match;
            return rows.find((r) => r.id === m.id && r.tenant_id === m.tenant_id);
        }
    };
    // eslint-disable-next-line no-eval
    const methods = {
        ...(0, eval)(extractBackendMethod('deleteDraftProcDef')),
        ...(0, eval)(extractBackendMethod('isSavedProcDef'))
    };
    return { methods, deletes };
}

test('deleteDraftProcDef 는 is_draft=true 조건으로만 지운다', async () => {
    const { methods, deletes } = buildBackend([]);
    await methods.deleteDraftProcDef('Quote_Process.bpmn');

    assert.ok(deletes.length > 0);
    for (const d of deletes) {
        assert.equal(d.table, 'proc_def');
        assert.equal(d.match.is_draft, true, '조건 없이 id 로만 지우면 같은 id 의 저장된 정의까지 지운다');
        assert.equal(d.match.tenant_id, 'tutorial');
    }
    // 저장은 받은 id 그대로(putRawDefinition), 예전 정리는 소문자 — 두 모양 모두 정리한다.
    assert.deepEqual(deletes.map((d) => d.match.id).sort(), ['Quote_Process', 'quote_process']);
});

test('isSavedProcDef 는 is_draft 가 true 가 아닌 행만 저장된 정의로 본다', async () => {
    const { methods } = buildBackend([
        { id: 'saved', tenant_id: 'tutorial', is_draft: false },
        { id: 'legacy', tenant_id: 'tutorial', is_draft: null },
        { id: 'draft', tenant_id: 'tutorial', is_draft: true }
    ]);
    assert.equal(await methods.isSavedProcDef('saved'), true);
    assert.equal(await methods.isSavedProcDef('legacy'), true);
    assert.equal(await methods.isSavedProcDef('draft'), false);
    assert.equal(await methods.isSavedProcDef('missing'), false);
});
