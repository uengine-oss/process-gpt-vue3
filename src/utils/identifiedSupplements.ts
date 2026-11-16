/**
 * 한 업무의 정식 정의에 새 식별 결과를 올릴 때(제안), 흐름은 식별 결과로 바꾸고 보강은 이어받는다 (2026-11-16).
 *
 * 실행 전환은 도출 흐름 위에 폼·입출력·설명·지침·스킬을 붙여 저장한다. 그 뒤에 낸 제안이 도출 정의만 담으면
 * 병합할 때 붙여 둔 폼이 빠져, 정식 프로세스가 폼 없이 실행된다. 흐름(단계·담당·연결·분기 조건)은 식별 결과가
 * 정본이고, 보강은 같은 단계(같은 id·같은 이름)에 있던 것을 그대로 가져온다 — deepagents keep_identified_structure 의 반대 방향.
 */
const ACTIVITY_SUPPLEMENT = [
    'tool',
    'skills',
    'inputData',
    'outputData',
    'description',
    'instruction',
    'checkpoints',
    'attachments',
    'customProperties',
    'duration',
    'agent',
    'agentMode',
    'orchestration'
];
// 게이트웨이의 분기 판단 필드(폼의 '분기' 칸). 조건 문장은 식별 결과가 정한다
const GATEWAY_SUPPLEMENT = ['conditionData'];

export function withSupplements(mined: any, current: any): any {
    if (!mined || !current) return mined;
    const out = JSON.parse(JSON.stringify(mined));
    const byId = (list: any[]) => Object.fromEntries((list || []).map((x: any) => [x.id, x]));
    const acts = byId(current.activities);
    for (const a of out.activities || []) {
        const c = acts[a.id];
        if (!c || c.name !== a.name) continue;
        for (const k of ACTIVITY_SUPPLEMENT) if (c[k] !== undefined && c[k] !== '' && !(Array.isArray(c[k]) && !c[k].length)) a[k] = c[k];
    }
    const gws = byId(current.gateways);
    for (const g of out.gateways || []) {
        const c = gws[g.id];
        if (!c) continue;
        for (const k of GATEWAY_SUPPLEMENT) if (Array.isArray(c[k]) && c[k].length) g[k] = c[k];
    }
    for (const k of ['data', 'skills', 'participants'])
        if (Array.isArray(current[k]) && current[k].length && !(out[k] || []).length) out[k] = current[k];
    return out;
}
