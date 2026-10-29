/* eslint-env node, es2020 */
/* eslint-disable @typescript-eslint/no-empty-function -- 저장 경로와 상관없는 협력자는 빈 함수로 둔다 */
/**
 * 작업 폴더 「저장」이 proc_def.definition 에 에이전트 슬러그가 아니라 저장한 에이전트의 users.id 를 쓰는지 지킨다.
 *
 * 실제 사고: 딥 에이전트가 만든 프로세스의 역할 endpoint 와 activity.agent 가 agents/stock_agent.json 의
 * 슬러그(stock_agent) 그대로 저장됐다. 에이전트는 slugToUuid(슬러그) 로 users 에 저장되므로
 * 실행 엔진(polling)이 담당자를 찾지 못해 에이전트 단계가 시작되지 않았다.
 *
 * SFC 를 번들 없이 테스트하기 위해 메서드 본문을 파일에서 직접 꺼내 쓴다(ChatRoomPage.serverContent.test.js 와 같은 방식).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { collectWorkspaceAgents, describeAgentFileProblems, readWorkspaceAgents, remapAgentRefs, slugToUuid } from '../../utils/agentId.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(HERE, 'ChatRoomPage.vue'), 'utf8');
const FLATTEN_URL = pathToFileURL(path.join(HERE, '../../utils/elementsToFlattened.js')).href;

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
    // 꺼낸 메서드는 번들러 밖에서 돌므로 '@/' 별칭 import 를 실제 파일 주소로 바꾼다.
    const body = source.slice(bodyStart, end + 1).replace("import('@/utils/elementsToFlattened.js')", `import('${FLATTEN_URL}')`);
    return `${name}: ${isAsync ? 'async ' : ''}function ${signature}${body}`;
}

const METHODS = ['handleSaveWorkspaceFiles', '_collectAgentSkillNames'];

function buildComponent() {
    const procDefs = [];
    const agents = [];
    const bpmnBuiltFrom = [];
    const toasts = [];
    // 꺼낸 메서드가 모듈 스코프에서 쓰는 이름들.
    globalThis.collectWorkspaceAgents = collectWorkspaceAgents;
    globalThis.readWorkspaceAgents = readWorkspaceAgents;
    globalThis.describeAgentFileProblems = describeAgentFileProblems;
    globalThis.remapAgentRefs = remapAgentRefs;
    globalThis.getTenantId = () => 'tutorial';
    globalThis.backend = {
        putObject: async (key, row) => {
            if (key === 'proc_def') procDefs.push(row);
        },
        putAgent: async (row) => {
            agents.push(row);
        },
        putRawDefinition: async () => {},
        promoteProcessScenarios: async () => {}
    };
    // eslint-disable-next-line no-eval
    const methods = (0, eval)(`({${METHODS.map(extractMethod).join(',\n')}})`);
    const vm = {
        ...methods,
        workspaceSaveStateByGroup: {},
        messages: [],
        currentChatRoom: null,
        roomId: '',
        _processGroupKey: () => 'process-a1b2c3d',
        _workspaceFileBaseName: (f) => (f.name || f.path.split('/').pop() || '').toLowerCase(),
        _buildBpmnXmlFromDefinition(def) {
            bpmnBuiltFrom.push(def);
            return `<bpmn>${JSON.stringify(def.roles || [])}</bpmn>`;
        },
        _uploadSkillsFromFiles: async () => [],
        _upsertProcMapEntry: async () => {},
        _markWorkspaceFilesSaved() {},
        createMessageObj: (content) => ({ content }),
        uuid: () => 'msg-1',
        $nextTick(fn) {
            fn();
        },
        $forceUpdate() {},
        // 화면 언어 문구(feat/i18n-tutorial-path 가 이 메서드의 안내문을 $t 로 바꾼다) — 키를 그대로 돌려준다.
        $t: (key) => key,
        $toast: {
            success: (m) => toasts.push({ kind: 'success', m }),
            warning: (m) => toasts.push({ kind: 'warning', m })
        }
    };
    return { vm, procDefs, agents, bpmnBuiltFrom, toasts };
}

const DIR = '/workspace/.bpmn/process-a1b2c3d';

function workspaceFiles() {
    const pd = {
        processDefinitionId: 'quote_process',
        processDefinitionName: '견적 요청 처리',
        roles: [
            { name: '재고 확인 에이전트', endpoint: 'stock_agent', origin: 'used' },
            { name: '영업 담당자', endpoint: '' }
        ],
        elements: [
            { elementType: 'Event', id: 'start', type: 'StartEvent', role: '영업 담당자' },
            {
                elementType: 'Activity',
                id: 'check_stock',
                name: '재고 확인',
                role: '재고 확인 에이전트',
                agent: 'stock_agent',
                agentMode: 'complete',
                orchestration: 'deepagents',
                skills: ['stock-lookup']
            },
            { elementType: 'Sequence', id: 's1', source: 'start', target: 'check_stock' }
        ]
    };
    const pdContent = JSON.stringify(pd);
    return [
        { path: `${DIR}/process-definition.json`, name: 'process-definition.json', ext: '.json', content: pdContent },
        // 화면이 process-definition.json 에서 파생해 붙이는 .bpmn(레인 endpoint 에 슬러그가 들어 있다).
        {
            path: `${DIR}/견적 요청 처리.bpmn`,
            name: '견적 요청 처리.bpmn',
            ext: '.bpmn',
            content: '<bpmn>stock_agent</bpmn>',
            derived: true
        },
        {
            path: `${DIR}/agents/stock_agent.json`,
            name: 'stock_agent.json',
            ext: '.json',
            content: JSON.stringify({ id: 'stock_agent', name: '재고 확인 에이전트', role: '재고를 확인한다' })
        }
    ];
}

test('저장한 proc_def 의 역할 endpoint·activity.agent 가 저장한 에이전트 id 와 같다', async () => {
    const { vm, procDefs, agents } = buildComponent();
    await vm.handleSaveWorkspaceFiles(workspaceFiles());

    assert.equal(procDefs.length, 1);
    assert.equal(agents.length, 1);
    const agentId = agents[0].id;
    assert.equal(agentId, slugToUuid('stock_agent'));
    assert.equal(agents[0].is_draft, false);

    const def = procDefs[0].definition;
    assert.equal(def.roles[0].endpoint, agentId);
    assert.equal(def.activities[0].agent, agentId);
    assert.ok(!JSON.stringify(def).includes('"stock_agent"'), '정의에 슬러그가 남지 않는다');
    assert.equal(vm.workspaceSaveStateByGroup['process-a1b2c3d'].saved, true);
});

test('정의를 바꿨으면 proc_def.bpmn 도 바꾼 정의로 다시 만든다', async () => {
    const { vm, procDefs, bpmnBuiltFrom } = buildComponent();
    await vm.handleSaveWorkspaceFiles(workspaceFiles());

    const agentId = slugToUuid('stock_agent');
    assert.equal(bpmnBuiltFrom.length, 1);
    assert.equal(bpmnBuiltFrom[0].roles[0].endpoint, agentId);
    assert.ok(procDefs[0].bpmn.includes(agentId));
    assert.ok(!procDefs[0].bpmn.includes('stock_agent'));
});

test('정의가 저장 id 로 바뀌어도 에이전트 스킬은 그대로 모인다', async () => {
    const { vm, agents } = buildComponent();
    await vm.handleSaveWorkspaceFiles(workspaceFiles());
    assert.deepEqual(agents[0].skills, ['stock-lookup']);
});

test('작업 폴더의 파일 내용(process-definition.json)은 바꾸지 않는다', async () => {
    const { vm } = buildComponent();
    const files = workspaceFiles();
    const before = files[0].content;
    await vm.handleSaveWorkspaceFiles(files);
    assert.equal(files[0].content, before);
});

// ---------------------------------------------------------------------------
// 읽지 못한 에이전트 파일 — 말없이 건너뛰지 않고 저장 결과에 알린다
//
// 실제 사고(VM 녹화 policy-to-process): 모델이 agents/quote_calc_agent.json 을 쓰면서 끝의 `}` 를 빠뜨려
// 고른 에이전트 둘 중 하나가 저장되지 않았는데, 저장 결과는 「생성된 에이전트 (1개)」만 보여 아무도 몰랐다.
// ---------------------------------------------------------------------------

/** 견적 산출 에이전트(quote_calc_agent)를 하나 더 둔 작업 폴더. quoteContent 로 그 파일 내용을 바꾼다. */
function workspaceFilesWithQuoteAgent(quoteContent) {
    const files = workspaceFiles();
    const pd = JSON.parse(files[0].content);
    pd.roles.push({ name: '견적 산출 에이전트', endpoint: 'quote_calc_agent' });
    pd.elements.push(
        { elementType: 'Activity', id: 'calc_quote', name: '견적 산출', role: '견적 산출 에이전트', agent: 'quote_calc_agent' },
        { elementType: 'Sequence', id: 's2', source: 'check_stock', target: 'calc_quote' }
    );
    files[0].content = JSON.stringify(pd);
    files.push({ path: `${DIR}/agents/quote_calc_agent.json`, name: 'quote_calc_agent.json', ext: '.json', content: quoteContent });
    return files;
}

const QUOTE_AGENT = {
    id: 'quote_calc_agent',
    name: '견적 산출 자동화 에이전트',
    role: '견적 금액 산정 및 견적서 초안 자동 생성 담당자',
    description: '제품 가격표와 할인율, 설치비 기준에 따라 견적서를 작성한다.'
};

test('읽을 수 없는 에이전트 파일은 저장하지 않고, 어느 파일인지 저장 결과에 알린다', async () => {
    const { vm, procDefs, agents, toasts } = buildComponent();
    // 내용 중간에서 잘린 파일 — 고칠 수 없다(지어내지 않는다).
    const truncated = '{\n  "id": "quote_calc_agent",\n  "name": "견적 산출 자동화 에이전트",\n  "role": "견적 금액 산';
    await vm.handleSaveWorkspaceFiles(workspaceFilesWithQuoteAgent(truncated));

    assert.deepEqual(
        agents.map((a) => a.name),
        ['재고 확인 에이전트']
    );
    const def = procDefs[0].definition;
    const quoteRole = def.roles.find((r) => r.name === '견적 산출 에이전트');
    assert.equal(quoteRole.endpoint, 'quote_calc_agent', '저장하지 않은 에이전트의 슬러그는 바꾸지 않는다(가리킬 id 가 없다)');
    assert.equal(def.activities.find((a) => a.id === 'calc_quote').agent, 'quote_calc_agent');

    const result = vm.messages.at(-1).pdf2bpmnResult;
    assert.equal(result.savedAgents.length, 1);
    assert.match(result.__saveError, /agents\/quote_calc_agent\.json/);
    assert.match(result.__saveError, /저장하지 않았습니다/);
    const st = vm.workspaceSaveStateByGroup['process-a1b2c3d'];
    assert.equal(st.saved, true, '나머지는 저장됐다');
    assert.match(st.error, /agents\/quote_calc_agent\.json/);
    assert.ok(toasts.some((t) => t.kind === 'warning' && /quote_calc_agent/.test(t.m)));
});

test('끝의 닫는 괄호만 빠진 에이전트 파일은 채워 읽어 저장하고 그렇게 했다고 알린다', async () => {
    const { vm, procDefs, agents } = buildComponent();
    // VM 의 파일 그대로 — 마지막 줄 `}` 가 없다.
    const missingBrace = JSON.stringify(QUOTE_AGENT, null, 2).replace(/\}\s*$/, '');
    await vm.handleSaveWorkspaceFiles(workspaceFilesWithQuoteAgent(missingBrace));

    assert.deepEqual(agents.map((a) => a.name).sort(), ['견적 산출 자동화 에이전트', '재고 확인 에이전트']);
    const quoteId = slugToUuid('quote_calc_agent');
    assert.ok(agents.some((a) => a.id === quoteId));
    assert.equal(procDefs[0].definition.roles.find((r) => r.name === '견적 산출 에이전트').endpoint, quoteId);

    const result = vm.messages.at(-1).pdf2bpmnResult;
    assert.equal(result.__saveError, undefined, '저장은 됐으니 「저장 실패」 줄은 없다');
    assert.match(vm.workspaceSaveStateByGroup['process-a1b2c3d'].error, /채워서 읽고 저장했습니다/);
});

test('에이전트 파일이 모두 멀쩡하면 아무 안내도 붙지 않는다', async () => {
    const { vm, toasts } = buildComponent();
    await vm.handleSaveWorkspaceFiles(workspaceFilesWithQuoteAgent(JSON.stringify(QUOTE_AGENT)));
    assert.equal(vm.messages.at(-1).pdf2bpmnResult.__saveError, undefined);
    assert.equal(vm.workspaceSaveStateByGroup['process-a1b2c3d'].error, '');
    assert.equal(
        toasts.some((t) => t.kind === 'warning'),
        false
    );
});
