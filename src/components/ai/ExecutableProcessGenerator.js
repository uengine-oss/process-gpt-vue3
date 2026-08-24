/**
 * ExecutableProcessGenerator — 순서도(문서형) BPMN 을 실행 가능한 프로세스 정의
 * (process-gpt-completion definition JSON)로 AI 변환한다.
 *
 * qdrantChat 에 BPMN XML + 결정론 추출한 스켈레톤(노드·흐름·레인)을 보내
 * 엔진 계약(specs/008-bpm-mvp-execution)에 맞는 definition JSON 을 받아온 뒤,
 * normalizeExecutableDefinition / validateExecutableDefinition 으로 보정·검증한다.
 */
import { parseJsonLoose, readAnswerText } from './blueprintAiUtils';
import {
    extractBpmnSkeleton,
    normalizeExecutableDefinition,
    validateExecutableDefinition
} from '@/composables/blueprint/executableModel';

function compactSkeleton(skeleton) {
    const multiPool = (skeleton.pools || []).length >= 2;
    return {
        lanes: skeleton.lanes,
        ...(multiPool ? { pools: skeleton.pools.map((p) => ({ id: p.id, name: p.name })) } : {}),
        activities: skeleton.activities.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            lane: a.lane || '',
            ...(multiPool && a.pool ? { pool: a.pool } : {})
        })),
        gateways: skeleton.gateways.map((g) => ({ id: g.id, name: g.name, type: g.type, ...(multiPool && g.pool ? { pool: g.pool } : {}) })),
        events: skeleton.events.map((e) => ({ id: e.id, name: e.name, type: e.type, ...(multiPool && e.pool ? { pool: e.pool } : {}) })),
        flows: skeleton.flows.map((f) => ({ id: f.id, name: f.name || '', source: f.source, target: f.target })),
        messageFlows: skeleton.messageFlows.map((f) => ({ source: f.source, target: f.target }))
    };
}

function buildPrompt({ defId, processName, skeleton, roleEndpoints, feedback, execPools = [] }) {
    // 실행형 Pool 이 여러 개면 각 풀의 startEvent 를 유지하는 다중 시작 정의로 변환한다 (specs/010).
    const multiStart = execPools.length >= 2;
    const lines = [
        '당신은 BPM 실행 엔진(process-gpt-completion)용 프로세스 정의 변환 전문가입니다.',
        `아래 순서도("${processName || defId}")는 문서화용 BPMN 이라 그대로는 실행할 수 없습니다.`,
        '이 순서도를 실행 엔진이 수행 가능한 definition JSON 으로 변환하세요.',
        '',
        '## 출력 스키마 (JSON)',
        '{',
        `  "processDefinitionId": "${String(defId || '').toLowerCase()}",`,
        `  "processDefinitionName": "${processName || ''}",`,
        '  "description": "<프로세스 한 줄 설명>",',
        '  "roles": [{"name": "<레인/역할명>", "default": "<email>", "endpoint": "<email>"}],',
        '  "activities": [{"id","name","type","description","instruction","role","inputData":[],"outputData":[],"checkpoints":[],"tool":"","properties":"{}","duration":<분>,"agent"?,"pythonCode"?}],',
        '  "gateways": [{"id","name","role","type":"exclusiveGateway|parallelGateway","condition":{},"conditionData":["<결정필드명>"],"properties":"{}","description":""}],',
        '  "events": [{"id","name","role","type":"startEvent|endEvent","properties":"{}","description":""}],',
        '  "sequences": [{"id","name","source","target","condition":"","properties":"{\\"conditionFunction\\": \\"<결정필드> == \'<값>\'\\"}"}],',
        '  "data": [{"name":"<프로세스 변수명>","type":"Text","description":""}]',
        '}',
        '',
        '## 엔진 계약 (반드시 지킬 것)',
        '1. 원본 BPMN 요소 id 를 그대로 유지하세요 (Activity_xxx / Gateway_xxx / Flow_xxx / Event_xxx — 진행 상태 색상 매칭에 필요).',
        multiStart
            ? '2. startEvent 는 실행형 풀마다 1개씩 유지하세요(다중 시작 — 실행 시 시작점을 선택합니다). 그 외 연결 안 된 고립 섬·별개 프로세스 참조(링크 서브프로세스)는 제거하거나 시퀀스로 이어 붙이세요.'
            : '2. startEvent 는 정확히 1개. 여러 시작점·연결 안 된 고립 섬·별개 프로세스 참조(링크 서브프로세스)는 제거하거나 시퀀스로 이어 붙이세요.',
        '3. startEvent 직후에는 반드시 액티비티가 와야 합니다(게이트웨이 직결 금지). 첫 액티비티가 userTask 면 실행 시작 시 사용자가 폼을 입력해 시작하므로 분기 결정 필드를 공급해도 됩니다. 원본 순서도에 없는 태스크("자동 접수" 등)를 임의로 추가하지 마세요.',
        "4. 액티비티 type 은 userTask / serviceTask / scriptTask 만 사용. manualTask·sendTask·receiveTask 는 userTask 로, callActivity 는 userTask(스텁)로 변환하세요.",
        '5. 시스템 연동 태스크(조회·추출·전송·RPA 등 사람 판단이 필요 없는 것)는 serviceTask 로 바꾸고 role 을 "자동화에이전트"(endpoint: process-agent@uengine.org)로 배정하세요. 단, serviceTask 의 출력은 폼 분기 필드를 만들 수 없으므로 exclusive 게이트웨이 직전 태스크는 반드시 userTask 로 두세요.',
        "6. exclusive 게이트웨이의 모든 분기 시퀀스에는 properties 의 conditionFunction(예: \"시설물존재 == '예'\")을 넣고, 게이트웨이 conditionData 에 결정 필드명을 넣으세요. 결정 필드명은 전체 프로세스에서 유일해야 하며, 그 결정 필드는 게이트웨이 직전 userTask 의 outputData 에 포함시키세요. 비교 값 어휘: 분기 시퀀스에 라벨(flows 의 name — 예: '있음'/'없음')이 있으면 그 라벨 문자열을 그대로 비교 값으로 쓰고(sequences 의 name 에도 라벨 유지), 라벨이 없을 때만 '예'/'아니오' 를 쓰세요. 각 분기의 conditionFunction 값은 반드시 그 분기 자신의 라벨·도착지 의미와 일치해야 하며, 형제 분기의 값과 절대 뒤바꾸지 마세요('있음' 라벨 분기에 == '없음'/'아니오' 배정 금지).",
        '7. 메시지플로우(풀 경계 점선)는 시퀀스로 이어 붙여 단일 정의로 만드세요.',
        '8. parallel 게이트웨이 분기/합류 쌍은 유지하세요.',
        '9. 각 역할(roles)은 레인 이름 기준으로 만들고, endpoint 는 아래 계정 매핑을 사용하세요.',
        '10. 모든 userTask 에는 instruction(수행 지침 1-2문장)을 채우세요.',
        ''
    ];
    if ((skeleton.pools || []).length >= 2) {
        if (execPools.length) {
            const poolDesc = execPools.map((p) => `"${p.name}"(id: ${p.id})`).join(', ');
            lines.push(
                '## 실행형 Pool (반드시 지킬 것)',
                `이 순서도에는 풀(Pool)이 ${skeleton.pools.length}개 있습니다. 실행형 풀은 ${poolDesc} — 총 ${execPools.length}개 입니다.`,
                multiStart
                    ? '- startEvent 는 실행형 풀들의 것만 사용하고, 실행형 풀마다 1개씩 유지하세요(다중 시작). 실행형이 아닌 풀의 startEvent 는 startEvent 로 만들지 말고 제거하거나 일반 흐름으로 통합하세요.'
                    : '- startEvent 는 실행형 풀의 것 1개만 사용하세요. 다른 풀의 startEvent 는 startEvent 로 만들지 말고 제거하거나 일반 흐름으로 통합하세요.',
                '- 실행 흐름은 실행형 풀(들)을 기준으로 구성하고, 다른 풀의 태스크는 메시지플로우를 시퀀스로 이어붙여 필요한 것만 통합하세요.',
                ''
            );
        } else {
            lines.push(
                '## 실행형 Pool',
                `이 순서도에는 풀(Pool)이 ${skeleton.pools.length}개 있습니다. 실행형 풀이 별도 지정되지 않았으므로 액티비티가 가장 많은 풀을 실행형으로 간주하고, startEvent 는 그 풀의 것 1개만 사용하세요.`,
                ''
            );
        }
    }
    if (roleEndpoints && Object.keys(roleEndpoints).length) {
        lines.push('## 역할 → 계정 매핑 (없는 역할은 user@example.com 사용)');
        for (const [role, email] of Object.entries(roleEndpoints)) lines.push(`- ${role}: ${email}`);
        lines.push('');
    } else {
        lines.push('## 역할 → 계정: 알려진 매핑이 없으므로 모든 역할의 endpoint 는 user@example.com 로, 자동화에이전트만 process-agent@uengine.org 로 하세요.', '');
    }
    lines.push(
        '## 순서도 구조 (XML 에서 결정론 추출 — id 근거로 사용)',
        '```json',
        JSON.stringify(compactSkeleton(skeleton)),
        '```',
        ''
    );
    if (feedback) {
        lines.push('## 이전 변환의 검증 실패 항목 (이번에 반드시 해결)', feedback, '');
    }
    lines.push(
        '## 출력 형식',
        '먼저 한 줄짜리 한국어 변환 요약을 쓰고, 이어서 definition JSON 전체를 ```json 코드펜스로만 출력하세요.',
        '```json 펜스 밖에는 JSON 을 두지 마세요. 주석 없는 유효한 JSON 이어야 합니다.'
    );
    return lines.join('\n');
}

function extractSummary(text) {
    let summary = String(text || '')
        .replace(/```json[\s\S]*?```/gi, '')
        .replace(/```[\s\S]*?```/g, '')
        .trim();
    summary = summary.split('\n').filter(Boolean).slice(0, 3).join(' ').slice(0, 400);
    return summary;
}

/**
 * @param {any} backend
 * @param {{ bpmnXml: string, defId: string, processName?: string, roleEndpoints?: Record<string,string>, feedback?: string, sessionId?: string, execPoolIds?: string[], execPoolId?: string, onDelta?: (text:string)=>void }} params
 * @returns {Promise<{ definition: any, summary: string, validation: { errors: string[], warnings: string[], checked_at: string } }>}
 */
export async function generateExecutableDefinition(backend, params = {}) {
    const { bpmnXml, defId, processName = '', roleEndpoints = null, feedback = '', sessionId, execPoolIds = null, execPoolId = '', onDelta } = params;
    if (!backend || typeof backend.qdrantChat !== 'function') {
        throw new Error('backend.qdrantChat 를 사용할 수 없습니다.');
    }
    if (!bpmnXml || !String(bpmnXml).trim()) {
        throw new Error('변환할 BPMN XML 이 필요합니다.');
    }
    if (!defId) {
        throw new Error('프로세스 정의 id(defId)가 필요합니다.');
    }

    const skeleton = extractBpmnSkeleton(bpmnXml);
    if (!skeleton.activities.length) {
        throw new Error('BPMN 에서 액티비티를 찾지 못했습니다. 순서도가 비어있는지 확인하세요.');
    }

    // 다중 지정(execPoolIds) 우선, 구버전 단일(execPoolId)도 흡수
    const poolIds = [
        ...new Set(
            [...(Array.isArray(execPoolIds) ? execPoolIds : []), ...(execPoolId ? [execPoolId] : [])]
                .map((id) => String(id || '').trim())
                .filter(Boolean)
        )
    ];
    const execPools = poolIds.map((id) => (skeleton.pools || []).find((p) => p.id === id) || { id, name: id });
    const message = buildPrompt({ defId, processName, skeleton, roleEndpoints, feedback, execPools });
    const response = await backend.qdrantChat({ message, xml: bpmnXml, sessionId }, onDelta ? { onDelta } : {});

    const text = readAnswerText(response);
    const parsed = parseJsonLoose(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('AI가 유효한 definition JSON 을 반환하지 않았습니다. 다시 시도해 주세요.');
    }

    const definition = normalizeExecutableDefinition(parsed, { defId, processName });
    if (!definition || !definition.activities.length) {
        throw new Error('변환된 definition 에 액티비티가 없습니다. 다시 시도해 주세요.');
    }
    const validation = validateExecutableDefinition(definition);
    // 실행형 Pool 지정 시 결정론 post-check: startEvent 가 실행형 풀 밖이면 오류 (재변환 피드백으로 순환)
    if (execPools.length && skeleton.poolByNode && Object.keys(skeleton.poolByNode).length) {
        const allowed = new Set(execPools.map((p) => p.id));
        const poolNames = execPools.map((p) => `"${p.name}"`).join(', ');
        for (const ev of definition.events || []) {
            if (ev.type !== 'startEvent') continue;
            const pool = skeleton.poolByNode[ev.id];
            if (pool && !allowed.has(pool)) {
                validation.errors.push(
                    `startEvent "${ev.name || ev.id}" 가 실행형 Pool(${poolNames}) 밖에 있습니다 — 실행형 Pool 의 startEvent 만 시작으로 사용하세요.`
                );
            }
        }
    }
    return { definition, summary: extractSummary(text), validation };
}

/** 검증 실패 항목을 재변환 피드백 문자열로 변환. */
export function validationFeedback(validation) {
    if (!validation) return '';
    const items = [...(validation.errors || []), ...(validation.warnings || [])]
        // 폐기된 "첫 태스크 빈 폼 자동 제출" 계약의 옛 경고가 저장돼 있어도 AI에 전달하지 않는다
        // (전달하면 원본에 없는 "자동 접수" 태스크를 다시 만들어낸다).
        .filter((m) => !String(m).includes('자동 제출'));
    if (!items.length) return '';
    return items.map((m, i) => `${i + 1}. ${m}`).join('\n');
}
