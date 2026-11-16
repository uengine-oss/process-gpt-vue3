/* eslint-env node, es2020 */
/**
 * 「실행」 창이 에이전트 역할을 실행한 사람으로 바꾸지 않는지, 창을 열 때 만드는 시작 업무(IN_PROGRESS)가
 * 맞는 담당으로 생기는지, 첫 단계를 건너뛰지 않는지 지킨다.
 *
 * 실제 사고(VM 녹화, 「한빛오피스 대량 주문 견적 승인」): 역할 지정 다섯 칸이 모두 실행한 사람이 됐다.
 * 시작 단계(정의 결함으로 「재고 확인」이 잡힘)의 역할 「재고 확인 에이전트」 endpoint 는 저장된 에이전트
 * (users.is_agent=true)였는데 init 이 현재 사용자로 덮어썼고, 창을 여는 순간 만든 todolist 행도 그 사람
 * 담당이라 에이전트 단계가 사람 업무가 됐다(activity.agent 가 비어 runsAsAgent 거짓).
 *
 * SFC 를 번들 없이 테스트하기 위해 메서드 본문을 파일에서 직접 꺼내 쓴다(ChatRoomPage.serverContent.test.js 와 같은 방식).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildStartWorkItem, runsAsAgent } from '../../../shared/processStart/index.js';
import { findStartActivity, hasDanglingStartEvent } from '../../../utils/processStart.ts';
import { isUuid } from '../../../utils/agentId.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(HERE, 'ProcessGPTExecute.vue'), 'utf8');

function extractMethod(name) {
    let start = source.indexOf(`\n        ${name}(`);
    let isAsync = false;
    if (start === -1) {
        start = source.indexOf(`\n        async ${name}(`);
        isAsync = true;
    }
    assert.notEqual(start, -1, `method not found in ProcessGPTExecute.vue: ${name}`);
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
    return `${name}: ${isAsync ? 'async ' : ''}function ${source.slice(paramStart, cursor + 1)}${source.slice(bodyStart, end + 1)}`;
}

const USER = '63826321-0000-4000-8000-000000000001';
const STOCK_AGENT = 'b786a40b-2cf1-43a4-98c4-cdf592f538ee';
const USERS = {
    [USER]: { id: USER, username: '장진영', is_agent: false },
    [STOCK_AGENT]: { id: STOCK_AGENT, username: '재고 확인 자동화 에이전트', is_agent: true }
};

const act = (id, role, extra = {}) => ({ id, name: id, role, type: 'userTask', agentMode: 'none', ...extra });
const seq = (source, target) => ({ id: `${source}->${target}`, source, target });

/** 저장된 정의의 역할 — 에이전트 하나는 저장돼 uuid, 하나는 저장되지 않아 슬러그, 사람 역할은 슬러그. */
function roles() {
    return [
        { name: '영업 담당', endpoint: 'sales_staff' },
        { name: '재고 확인 에이전트', endpoint: STOCK_AGENT },
        { name: '견적 산출 에이전트', endpoint: 'quote_calc_agent' },
        { name: '영업팀장', endpoint: 'sales_lead' }
    ];
}

function buildComponent(definition, { engineStart = null, bpmn = '' } = {}) {
    const calls = { workItems: [], engineAsked: 0, bindRole: [] };
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: { getItem: (k) => ({ uid: USER, userName: '장진영' }[k] ?? null) }
    });
    globalThis.findStartActivity = findStartActivity;
    globalThis.hasDanglingStartEvent = hasDanglingStartEvent;
    globalThis.buildStartWorkItem = buildStartWorkItem;
    globalThis.runsAsAgent = runsAsAgent;
    globalThis.isUuid = isUuid;
    globalThis.backend = {
        getStartActivity: async () => {
            calls.engineAsked += 1;
            return engineStart ? { activityId: engineStart } : null;
        },
        putWorkItem: async (id, row) => {
            calls.workItems.push(row);
        },
        getWorkItem: async (id) => ({ id, worklist: { role: calls.workItems.at(-1)?.activity_role || '' }, activity: {} }),
        getUserById: async (id) => {
            if (!USERS[id]) throw new Error('user not found');
            return USERS[id];
        },
        // 엔진의 역할 배정은 비어 있는 역할을 실행한 사람으로 채운다(VM 의 /role-binding 그대로).
        bindRole: async (rs) => {
            calls.bindRole.push(rs.map((r) => ({ name: r.name, endpoint: r.endpoint })));
            return rs.filter((r) => !r.endpoint).map((r) => ({ roleName: r.name, userId: USER }));
        }
    };
    // eslint-disable-next-line no-eval
    const methods = (0, eval)(`({${['init', 'findStartActivity', 'createNewWorkItem', 'findRoleAgent'].map(extractMethod).join(',\n')}})`);
    const vm = {
        ...methods,
        processDefinition: definition,
        effectiveBpmn: bpmn,
        bpmn: '',
        isSimulate: 'false',
        instId: 'def.inst-1',
        resolvedDefinitionId: definition.processDefinitionId,
        deployVersion: '',
        roleMappings: [],
        startAssignee: null,
        workItem: null,
        defaultSetting: { getAgentById: () => null },
        uuid: () => 'todo-1'
    };
    return { vm, calls };
}

const endpointOf = (vm, name) => vm.roleMappings.find((r) => r.name === name)?.endpoint;

test('시작 단계 역할의 담당이 에이전트면 시작 업무도 역할 지정도 그 에이전트다', async () => {
    const definition = {
        processDefinitionId: 'stock_first',
        roles: roles(),
        events: [{ id: 'start', type: 'startEvent' }],
        activities: [act('check_stock', '재고 확인 에이전트'), act('calc_quote', '견적 산출 에이전트')],
        sequences: [seq('start', 'check_stock'), seq('check_stock', 'calc_quote')]
    };
    const { vm, calls } = buildComponent(definition, { engineStart: 'check_stock' });
    await vm.init();

    assert.equal(calls.workItems.length, 1, '창을 열면 시작 업무 한 줄을 만든다');
    const row = calls.workItems[0];
    assert.equal(row.activity_id, 'check_stock');
    assert.equal(row.status, 'IN_PROGRESS');
    assert.equal(row.user_id, STOCK_AGENT, '예전에는 실행한 사람(장진영) 담당으로 만들었다');
    assert.equal(row.username, '재고 확인 자동화 에이전트');
    assert.equal(endpointOf(vm, '재고 확인 에이전트'), STOCK_AGENT, '예전에는 실행한 사람으로 덮어썼다');
    // 사람 역할(슬러그)은 비워 두고 엔진 역할 배정이 채운다 — 예전과 같다.
    assert.equal(endpointOf(vm, '영업 담당'), USER);
});

test('첫 단계가 사람 단계면 예전처럼 실행한 사람이 맡고, 다른 에이전트 역할은 그대로 둔다', async () => {
    // VM 에 저장된 정의 — 시작 이벤트에서 나가는 선이 정의 JSON 에 없다(그림 XML 에는 있다).
    const definition = {
        processDefinitionId: '한빛오피스 대량 주문 견적 승인',
        roles: roles(),
        events: [{ id: 'start', type: 'startEvent' }],
        activities: [act('check_stock', '재고 확인 에이전트'), act('request_quote', '영업 담당'), act('calc_quote', '견적 산출 에이전트')],
        sequences: [seq('request_quote', 'check_stock'), seq('check_stock', 'calc_quote')]
    };
    const bpmn = '<bpmn:startEvent id="start"/><bpmn:sequenceFlow id="f" sourceRef="start" targetRef="request_quote"/>';
    // 엔진은 같은 규칙이라 check_stock 을 답한다 — 이 정의에서는 묻지 않아야 한다.
    const { vm, calls } = buildComponent(definition, { engineStart: 'check_stock', bpmn });
    await vm.init();

    assert.equal(calls.engineAsked, 0);
    const row = calls.workItems[0];
    assert.equal(row.activity_id, 'request_quote', '예전에는 「견적 요청 접수」를 건너뛰고 「재고 확인」으로 시작했다');
    assert.equal(row.user_id, USER);
    assert.equal(endpointOf(vm, '영업 담당'), USER);
    assert.equal(endpointOf(vm, '재고 확인 에이전트'), STOCK_AGENT);
});

test('역할 endpoint 가 에이전트가 아닌 uuid(사람)면 시작 역할은 실행한 사람이다', async () => {
    const OTHER = '11111111-2222-4333-8444-555555555555';
    USERS[OTHER] = { id: OTHER, username: '다른 사람', is_agent: false };
    const definition = {
        processDefinitionId: 'human_first',
        roles: [{ name: '영업 담당', endpoint: OTHER }],
        events: [{ id: 'start', type: 'startEvent' }],
        activities: [act('request_quote', '영업 담당')],
        sequences: [seq('start', 'request_quote')]
    };
    const { vm, calls } = buildComponent(definition, { engineStart: 'request_quote' });
    await vm.init();

    assert.equal(calls.workItems[0].user_id, USER);
    assert.equal(endpointOf(vm, '영업 담당'), USER);
});
