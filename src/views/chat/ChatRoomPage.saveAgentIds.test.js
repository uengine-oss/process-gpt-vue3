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

import { collectWorkspaceAgents, remapAgentRefs, slugToUuid } from '../../utils/agentId.js';

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
    // 꺼낸 메서드가 모듈 스코프에서 쓰는 이름들.
    globalThis.collectWorkspaceAgents = collectWorkspaceAgents;
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
        $forceUpdate() {}
    };
    return { vm, procDefs, agents, bpmnBuiltFrom };
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
