// 작업 폴더 「저장」이 프로세스 정의의 에이전트 슬러그를 저장된 에이전트 id(users.id)로 바꾸는 규칙.
// 실행 엔진은 담당자를 users.id/email 로만 찾는다 — 슬러그가 남으면 에이전트 단계가 시작되지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    agentRefResolver,
    agentStableId,
    collectWorkspaceAgents,
    describeAgentFileProblems,
    isUuid,
    readAgentJson,
    readWorkspaceAgents,
    remapAgentRefs,
    slugToUuid
} from './agentId.js';
import { elementsToFlattenedDefinition } from './elementsToFlattened.js';

const DIR = '/workspace/.bpmn/process-a1b2c3d';

function agentFile(slug, extra = {}) {
    return {
        path: `${DIR}/agents/${slug}.json`,
        name: `${slug}.json`,
        ext: '.json',
        content: JSON.stringify({ id: slug, name: `${slug} 이름`, role: '역할', ...extra })
    };
}

test('에이전트 파일마다 저장 id 를 agentStableId 와 같게 정한다', () => {
    const files = [
        agentFile('stock_agent'),
        agentFile('quote-writer'),
        { path: `${DIR}/process-definition.json`, name: 'process-definition.json', content: '{}' },
        { path: `${DIR}/agents/broken.json`, name: 'broken.json', content: '{not json' }
    ];
    const agents = collectWorkspaceAgents(files);
    assert.equal(agents.length, 2);
    assert.deepEqual(
        agents.map((a) => [a.sourceId, a.fileStem, a.id]),
        [
            ['stock_agent', 'stock_agent', slugToUuid('stock_agent')],
            ['quote-writer', 'quote-writer', slugToUuid('quote-writer')]
        ]
    );
    for (const a of agents) {
        assert.ok(isUuid(a.id));
        assert.equal(a.id, agentStableId(a.agent, a.path));
    }
});

test('레거시 agents.json 배열도 모은다', () => {
    const legacy = {
        path: `${DIR}/agents.json`,
        name: 'agents.json',
        content: JSON.stringify([
            { id: 'legacy-one', name: '하나' },
            { id: '0b6f2c64-2f4e-4c8e-9d1a-1f0a2b3c4d5e', name: '둘' }
        ])
    };
    const agents = collectWorkspaceAgents([legacy]);
    assert.deepEqual(
        agents.map((a) => a.id),
        [slugToUuid('legacy-one'), '0b6f2c64-2f4e-4c8e-9d1a-1f0a2b3c4d5e']
    );
});

test('elements[] 정의의 activity.agent·roles[].endpoint 슬러그를 저장 id 로 바꾼다', () => {
    const agents = collectWorkspaceAgents([agentFile('stock_agent')]);
    const id = slugToUuid('stock_agent');
    const pd = {
        processDefinitionId: 'quote_process',
        roles: [
            { name: '재고 담당', endpoint: 'stock_agent', default: 'stock_agent', origin: 'used' },
            { name: '영업팀장', endpoint: 'lead@example.com' },
            { name: '고객', endpoint: 'external_customer' }
        ],
        elements: [
            { elementType: 'Activity', id: 'check_stock', role: '재고 담당', agent: 'stock_agent', agentMode: 'complete' },
            { elementType: 'Activity', id: 'approve', role: '영업팀장', agent: '' },
            { elementType: 'Sequence', id: 's1', source: 'check_stock', target: 'approve' }
        ]
    };
    const before = JSON.stringify(pd);
    const { definition, replaced } = remapAgentRefs(pd, agents);

    assert.equal(JSON.stringify(pd), before, '원본 정의는 바꾸지 않는다');
    assert.equal(definition.roles[0].endpoint, id);
    assert.equal(definition.roles[0].default, id);
    assert.equal(definition.roles[1].endpoint, 'lead@example.com');
    assert.equal(definition.roles[2].endpoint, 'external_customer');
    assert.equal(definition.elements[0].agent, id);
    assert.equal(definition.elements[1].agent, '');
    assert.deepEqual(
        replaced.map((r) => r.path),
        ['roles[0].endpoint', 'roles[0].default', 'elements[0].agent']
    );
});

test('flattened 정의 — endpoint 배열·agents[]·rootAgent·하위 프로세스까지 바꾼다', () => {
    const agents = collectWorkspaceAgents([agentFile('stock_agent'), agentFile('quote-writer')]);
    const stock = slugToUuid('stock_agent');
    const writer = slugToUuid('quote-writer');
    const existing = '7d0c8a4e-1111-4222-8333-944445555666';
    const def = {
        roles: [{ name: '담당', endpoint: ['stock_agent', 'person@example.com', existing] }],
        activities: [
            {
                id: 'a1',
                agent: 'quote-writer',
                rootAgent: 'quote-writer',
                agents: ['stock_agent', { id: 'quote-writer', name: '견적' }, existing]
            }
        ],
        subProcesses: [
            {
                id: 'sp',
                children: {
                    roles: [{ name: '하위', endpoint: 'quote-writer' }],
                    activities: [{ id: 'c1', agent: 'stock_agent' }]
                }
            }
        ]
    };
    const { definition } = remapAgentRefs(def, agents);
    assert.deepEqual(definition.roles[0].endpoint, [stock, 'person@example.com', existing]);
    assert.equal(definition.activities[0].agent, writer);
    assert.equal(definition.activities[0].rootAgent, writer);
    assert.deepEqual(definition.activities[0].agents, [stock, { id: writer, name: '견적' }, existing]);
    assert.equal(definition.subProcesses[0].children.roles[0].endpoint, writer);
    assert.equal(definition.subProcesses[0].children.activities[0].agent, stock);
});

test('하이픈·밑줄 차이는 같은 에이전트로 보되, 애매하면 바꾸지 않는다', () => {
    const one = agentRefResolver(collectWorkspaceAgents([agentFile('stock-agent')]));
    assert.equal(one('stock_agent'), slugToUuid('stock-agent'));
    assert.equal(one('Stock Agent'), slugToUuid('stock-agent'));
    assert.equal(one('unknown_agent'), null);

    const two = agentRefResolver(collectWorkspaceAgents([agentFile('stock-agent'), agentFile('stock_agent')]));
    assert.equal(two('stock-agent'), slugToUuid('stock-agent'));
    assert.equal(two('stock_agent'), slugToUuid('stock_agent'));
    assert.equal(two('Stock Agent'), null);
});

test('파일 안 id 가 파일명과 달라도 둘 다 같은 저장 id 로 이어진다', () => {
    const file = {
        path: `${DIR}/agents/stock_agent.json`,
        name: 'stock_agent.json',
        content: JSON.stringify({ id: 'inventory-checker', name: '재고 확인 에이전트' })
    };
    const agents = collectWorkspaceAgents([file]);
    const id = slugToUuid('inventory-checker');
    assert.equal(agents[0].id, id);
    const { definition } = remapAgentRefs(
        { roles: [{ name: 'r', endpoint: 'stock_agent' }], activities: [{ id: 'a', agent: 'inventory-checker' }] },
        agents
    );
    assert.equal(definition.roles[0].endpoint, id);
    assert.equal(definition.activities[0].agent, id);
});

test('에이전트 파일이 없으면 정의를 그대로 둔다', () => {
    const def = { roles: [{ name: 'r', endpoint: 'stock_agent' }], activities: [{ id: 'a', agent: 'stock_agent' }] };
    const { definition, replaced } = remapAgentRefs(def, collectWorkspaceAgents([]));
    assert.deepEqual(definition, def);
    assert.equal(replaced.length, 0);
});

test('저장 경로와 같은 순서(치환 → flatten)로 만든 proc_def.definition 에 슬러그가 남지 않는다', () => {
    // ChatRoomPage.handleSaveWorkspaceFiles: collectWorkspaceAgents(list) → remapAgentRefs(pd) → elementsToFlattenedDefinition
    const files = [
        agentFile('stock_agent'),
        {
            path: `${DIR}/process-definition.json`,
            name: 'process-definition.json',
            content: JSON.stringify({
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
                        orchestration: 'deepagents'
                    },
                    { elementType: 'Sequence', id: 's1', source: 'start', target: 'check_stock' }
                ]
            })
        }
    ];
    const agents = collectWorkspaceAgents(files);
    const pd = JSON.parse(files[1].content);
    const definition = elementsToFlattenedDefinition(remapAgentRefs(pd, agents).definition);
    const id = agents[0].id;
    assert.equal(definition.roles[0].endpoint, id);
    assert.equal(definition.activities[0].agent, id);
    assert.ok(!JSON.stringify(definition).includes('"stock_agent"'));
});

// ---------------------------------------------------------------------------
// 깨진 에이전트 파일 — VM 녹화에서 모델이 agents/quote_calc_agent.json·estimate_agent.json 끝의 `}` 를 빠뜨렸다.
// ---------------------------------------------------------------------------

test('끝의 닫는 괄호만 빠진 에이전트 JSON 은 채워 읽는다', () => {
    const text = '{\n  "id": "quote_calc_agent",\n  "name": "견적 산출 자동화 에이전트",\n  "description": "견적서를 작성한다."\n';
    const r = readAgentJson(text);
    assert.equal(r.repaired, true);
    assert.equal(r.value.name, '견적 산출 자동화 에이전트');
    // 마지막 값 뒤 쉼표가 남은 채 끊긴 것도
    const trailingComma = readAgentJson('{"id": "a", "name": "에이전트 A", "tools": ["x", "y"],\n');
    assert.equal(trailingComma.repaired, true);
    assert.deepEqual(trailingComma.value.tools, ['x', 'y']);
    // 멀쩡한 파일은 손대지 않는다
    assert.deepEqual(readAgentJson('{"id": "a", "name": "A"}'), { value: { id: 'a', name: 'A' }, repaired: false, error: '' });
});

test('고칠 수 없거나, 고쳐도 이름 있는 객체가 아니면 읽지 못한 것으로 둔다', () => {
    for (const text of [
        '{"id": "a", "name": "견적 산', // 문자열 안에서 잘림
        '{"id": "a", "name": ', // 값이 없음
        '{"id": "a", "description": "이름이 없다"', // 채우면 읽히지만 name 이 없다
        '{"id": "a", "name": "A"]', // 괄호 짝이 틀림
        '{not json',
        ''
    ]) {
        const r = readAgentJson(text);
        assert.equal(r.value, null, text);
        assert.equal(r.repaired, false);
        assert.ok(r.error);
    }
});

test('readWorkspaceAgents 는 읽지 못한 에이전트 파일을 따로 돌려주고, 그 슬러그는 바꿀 짝이 없다', () => {
    const files = [
        agentFile('stock_agent'),
        { path: `${DIR}/agents/quote_calc_agent.json`, name: 'quote_calc_agent.json', content: '{"id": "quote_calc_agent", "name": "견적' },
        {
            path: `${DIR}/agents/estimate_agent.json`,
            name: 'estimate_agent.json',
            content: '{"id": "estimate_agent", "name": "견적 에이전트"\n'
        }
    ];
    const { agents, unreadable } = readWorkspaceAgents(files);
    assert.deepEqual(
        agents.map((a) => [a.sourceId, a.repaired]),
        [
            ['stock_agent', false],
            ['estimate_agent', true]
        ]
    );
    assert.deepEqual(
        unreadable.map((u) => [u.fileStem, u.path]),
        [['quote_calc_agent', `${DIR}/agents/quote_calc_agent.json`]]
    );
    // collectWorkspaceAgents 는 예전처럼 읽은 것만
    assert.equal(collectWorkspaceAgents(files).length, 2);

    const { definition } = remapAgentRefs({ roles: [{ name: '견적 산출', endpoint: 'quote_calc_agent' }] }, agents);
    assert.equal(definition.roles[0].endpoint, 'quote_calc_agent');

    const note = describeAgentFileProblems({ agents, unreadable });
    assert.match(note.notSaved, /agents\/quote_calc_agent\.json 을 읽을 수 없어/);
    assert.match(note.notSaved, /「quote_calc_agent」 값은 그대로/);
    assert.match(note.repaired, /agents\/estimate_agent\.json 끝의 닫는 괄호/);
    assert.deepEqual(describeAgentFileProblems({ agents: agents.slice(0, 1), unreadable: [] }), { notSaved: '', repaired: '' });
});

test('레거시 agents.json 이 깨졌으면 그것도 읽지 못한 파일로 알린다', () => {
    const { agents, unreadable } = readWorkspaceAgents([
        { path: `${DIR}/agents.json`, name: 'agents.json', content: '[{"id": "x", "name": "X"}' }
    ]);
    assert.equal(agents.length, 0);
    assert.deepEqual(
        unreadable.map((u) => u.path),
        [`${DIR}/agents.json`]
    );
});
