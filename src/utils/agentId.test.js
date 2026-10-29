// 작업 폴더 「저장」이 프로세스 정의의 에이전트 슬러그를 저장된 에이전트 id(users.id)로 바꾸는 규칙.
// 실행 엔진은 담당자를 users.id/email 로만 찾는다 — 슬러그가 남으면 에이전트 단계가 시작되지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { agentRefResolver, agentStableId, collectWorkspaceAgents, isUuid, remapAgentRefs, slugToUuid } from './agentId.js';
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
