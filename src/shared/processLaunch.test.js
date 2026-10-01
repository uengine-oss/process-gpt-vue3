import test from 'node:test';
import assert from 'node:assert/strict';
import { instanceRouteOf, isExecuteProcessTool, launchTitle, processLaunchOf, processLaunchesOf } from './processLaunch.js';

test('execute_process 는 MCP 서버 접두어가 붙어도 알아본다', () => {
    assert.equal(isExecuteProcessTool('execute_process'), true);
    assert.equal(isExecuteProcessTool('work-assistant__execute_process'), true);
    assert.equal(isExecuteProcessTool('mcp.execute_process'), true);
    assert.equal(isExecuteProcessTool('get_process_list'), false);
    assert.equal(isExecuteProcessTool('pre_execute_process'), false);
});

test('실행 중인 도구는 시작하는 중 카드다', () => {
    const launch = processLaunchOf({
        name: 'execute_process',
        status: 'running',
        input: { process_definition_id: 'vacation', activity_id: 'a1' }
    });
    assert.deepEqual(launch, { state: 'starting', instanceId: '', definitionId: 'vacation', error: '' });
});

test('끝난 도구의 결과에서 인스턴스를 꺼낸다 — 콘텐츠 블록 꼴이어도', () => {
    const plain = processLaunchOf({
        name: 'execute_process',
        status: 'done',
        input: '{"process_definition_id": "vacation"}',
        output: '{"process_instance_id": "vacation.1234", "message": "ok"}'
    });
    assert.equal(plain.state, 'started');
    assert.equal(plain.instanceId, 'vacation.1234');
    assert.equal(plain.definitionId, 'vacation');

    const blocks = processLaunchOf({
        name: 'execute_process',
        status: 'done',
        input: {},
        output: `content=[{'type': 'text', 'text': '{"process_instance_id": "vacation.5678"}'}]`
    });
    assert.equal(blocks.instanceId, 'vacation.5678');
});

test('오류 응답이나 인스턴스가 없는 결과는 실패 카드다', () => {
    const failed = processLaunchOf({ name: 'execute_process', status: 'done', output: '{"error": "인증 실패", "process_instance_id": "x.1"}' });
    assert.equal(failed.state, 'failed');
    assert.equal(failed.error, '인증 실패');

    const empty = processLaunchOf({ name: 'execute_process', status: 'done', output: '{}' });
    assert.equal(empty.state, 'failed');
});

test('메시지의 도구 기록 중 실행만 카드가 된다', () => {
    const list = processLaunchesOf({
        toolCalls: [
            { name: 'get_process_detail', status: 'done', output: '{}' },
            { name: 'execute_process', status: 'done', output: '{"process_instance_id": "a.1"}' }
        ]
    });
    assert.equal(list.length, 1);
    assert.equal(list[0].instanceId, 'a.1');
    assert.deepEqual(processLaunchesOf({}), []);
});

test('같은 인스턴스는 카드 하나, 성공이 있으면 거절된 시도는 뺀다', () => {
    const list = processLaunchesOf({
        toolCalls: [
            { name: 'execute_process', status: 'done', output: '{"process_instance_id": "a.1"}' },
            { name: 'execute_process', status: 'done', output: '{"error": "시작 단계가 아닌 액티비티로는 프로세스를 실행할 수 없습니다."}' },
            { name: 'execute_process', status: 'done', output: '{"process_instance_id": "a.1", "already_started": true}' }
        ]
    });
    assert.deepEqual(
        list.map((l) => [l.state, l.instanceId]),
        [['started', 'a.1']]
    );

    // 성공이 하나도 없으면 실패는 그대로 알린다.
    const failedOnly = processLaunchesOf({ toolCalls: [{ name: 'execute_process', status: 'done', output: '{"error": "x"}' }] });
    assert.equal(failedOnly[0].state, 'failed');
});

test('인스턴스 주소는 점을 _DOT_ 으로 바꾼다', () => {
    assert.equal(instanceRouteOf('vacation.1234'), '/instancelist/vacation_DOT_1234');
});

test('카드 제목 — 이름이 프로세스로 끝나면 겹쳐 붙이지 않는다', () => {
    assert.equal(launchTitle('국민신문고 프로세스', 'started'), '국민신문고 프로세스가 실행되었습니다');
    assert.equal(launchTitle('휴가 신청', 'started'), '휴가 신청 프로세스가 실행되었습니다');
    assert.equal(launchTitle('휴가 신청', 'starting'), '휴가 신청 프로세스를 시작하는 중…');
    assert.equal(launchTitle('', 'failed'), '프로세스를 시작하지 못했습니다');
});
