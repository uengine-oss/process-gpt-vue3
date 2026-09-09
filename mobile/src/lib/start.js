/**
 * 프로세스를 새로 시작한다.
 *
 * 순서
 *   1) 정의에서 시작 액티비티를 찾는다 (엔진에게 묻는다)
 *   2) 인스턴스 하나를 만든다
 *   3) 그 인스턴스의 첫 업무를 만든다
 *
 * 2번을 빠뜨리면 어떻게 되는가
 *   업무는 만들어지고 목록에도 보인다. 그런데 그 업무가 속한 건이 없어서
 *   진행 현황에는 아무것도 뜨지 않고, 다음 단계로도 넘어가지 못한다.
 *   화면에는 오류가 없으므로 원인을 찾기 어렵다. 데이터베이스에 그것을 만들어
 *   주는 장치는 없다 — 확인해 봤다.
 *
 * 업무 한 줄의 내용은 @/shared/processStart 가 정한다. 포털의 실행 화면도 같은
 * 것을 쓴다.
 */

// 별칭(@/) 대신 상대 경로를 쓴다. 이 파일은 테스트에서 Node 가 직접 불러오는데,
// Node 는 번들러 별칭을 모른다.
import { buildStartWorkItem, runsAsAgent } from '../../../src/shared/processStart/index.js';

/**
 * 인스턴스 식별자.
 *
 * 포털과 같은 규칙(`정의ID.무작위`)을 쓴다. 다른 규칙을 쓰면 식별자만 보고
 * 어느 정의의 건인지 알던 도구들이 못 알아본다.
 */
export function newInstanceId(defId, random) {
    return `${defId}.${random}`;
}

/** 이 건에 붙일 이름. 없으면 정의 이름을 쓴다. */
export function instanceName(definition, at = new Date()) {
    const base = (definition?.name || definition?.id || '새 프로세스').toString();
    const stamp = `${at.getMonth() + 1}/${at.getDate()}`;
    return `${base} ${stamp}`;
}

/**
 * 시작한다.
 *
 * @param {object} deps
 *   backend    포털과 같은 데이터 계층
 *   definition 시작할 정의 { id, name }
 *   user       { id, name } 시작하는 사람
 *   uuid       식별자 생성기 (테스트에서 고정하기 위해 받는다)
 *   now        시작 시각
 */
export async function startProcess({
    backend,
    definition,
    user,
    uuid,
    roleBindings = [],
    initialValues = null,
    now = new Date()
}) {
    const defId = definition?.id;
    if (!defId) return { ok: false, reason: 'no-definition' };

    const resolved = await backend.getStartActivity({ process_definition_id: defId });
    const activity = resolved?.activity;
    if (!activity) {
        // 시작점을 못 찾으면 시작할 수 없다. 억지로 만들면 아무도 처리할 수 없는
        // 업무가 목록에 쌓인다.
        return { ok: false, reason: 'no-start-activity' };
    }

    const instId = newInstanceId(defId, uuid());

    // 사람이 하는 업무면 시작한 사람이 맡는다. 에이전트가 하는 업무면 담당자를
    // 비워 두고, 뒤의 엔진이 정의에 적힌 에이전트를 붙인다.
    const assignee = runsAsAgent(activity) ? { id: null, name: null } : { id: user?.id, name: user?.name };

    const workItem = buildStartWorkItem(activity, {
        id: uuid(),
        instId,
        defId,
        assignee,
        startedAt: now.toISOString()
    });

    // 인스턴스를 먼저 만든다. 업무가 먼저 들어가면, 그 사이에 엔진이 업무를 집었을 때
    // 속한 건을 찾지 못한다.
    await backend.putInstance(instId, {
        procDefId: defId,
        name: instanceName(definition, now),
        currentActivityIds: [activity.id],
        status: 'RUNNING',
        startDate: now.toISOString(),
        // 누가 어느 역할을 맡는지. 없으면 다음 단계가 아무에게도 가지 않는다.
        roleBindings: Array.isArray(roleBindings) ? roleBindings : []
    });

    // 시작하면서 적은 첫 입력이 있으면 함께 넣는다. 없으면 빈 업무로 둔다.
    const values = initialValues && typeof initialValues === 'object' ? initialValues : null;
    const hasValues = values && Object.keys(values).length > 0;

    await backend.putWorkItem(workItem.id, hasValues ? { ...workItem, output: values } : workItem);

    return { ok: true, instId, instanceId: instId, taskId: workItem.id };
}
