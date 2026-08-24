/**
 * BestBpmnGenerator — As-Is BPMN + 선택된 솔루션을 반영한 "최선의" To-Be BPMN 생성.
 *
 * qdrantChat 에 As-Is XML 과 솔루션 지시문을 보내 개선된 BPMN 2.0 XML 을 받아온다.
 * 자동화(RPA/API) 위임 단계는 Call Activity(bpmn:callActivity)로 표현하도록 유도한다.
 * (요구사항: 자동으로 최선의 BPMN 모델 작성·표출, Call Activity 포함, 재생성 가능)
 */
import { extractBpmnXml, readAnswerText } from './blueprintAiUtils';
import { solutionTypeMeta } from '@/composables/blueprint/blueprintModel';

function buildDirectiveLines(directives) {
    if (!Array.isArray(directives) || !directives.length) {
        return ['- (선택된 솔루션이 없습니다. As-Is 흐름을 정돈하고 명백한 비효율만 개선하세요.)'];
    }
    return directives.map((d, i) => {
        const typeLabel = solutionTypeMeta(d.solutionType).label;
        const parts = [`${i + 1}. [이슈] ${d.issueTitle || ''}`, `   [솔루션] (${typeLabel}) ${d.solutionTitle || ''}`];
        if (d.description) parts.push(`   [방향] ${String(d.description).slice(0, 300)}`);
        if (d.targetTask) parts.push(`   [대상 As-Is 태스크] ${d.targetTask}`);
        return parts.join('\n');
    });
}

function buildPrompt({ processName, directives }) {
    return [
        '당신은 BPMN 2.0 프로세스 설계 전문가입니다.',
        `아래 As-Is 프로세스("${processName || '프로세스'}")의 BPMN XML 을 기반으로,`,
        '주어진 개선 지시(확정 이슈 + 선택 솔루션)를 반영한 To-Be BPMN 2.0 모델을 설계하세요.',
        '',
        '설계 원칙:',
        '- RPA/API/시스템 자동화로 위임되는 단계는 bpmn:callActivity (Call Activity)로 표현하세요.',
        '- 사람이 수행하는 단계는 bpmn:userTask, 시스템 자동 단계는 bpmn:serviceTask 를 사용하세요.',
        '- 가능하면 기존 Lane/Pool(역할)과 전체 흐름의 일관성을 유지하세요.',
        '- 통합/제거되는 단계는 합치거나 삭제하고, 신설 단계는 추가하세요.',
        '- 반드시 유효한 BPMN 2.0 XML 이어야 하며, 렌더링을 위해 bpmndi:BPMNDiagram (DI/좌표) 를 포함하세요.',
        '- 모든 요소에 고유 id 를 부여하세요.',
        '',
        '개선 지시:',
        ...buildDirectiveLines(directives),
        '',
        '출력 형식: 먼저 한 줄짜리 한국어 변경 요약을 쓰고, 이어서 BPMN XML 전체를 ```xml 코드펜스로만 출력하세요.',
        '```xml 펜스 밖에는 XML 을 두지 마세요.'
    ].join('\n');
}

/**
 * @param {any} backend
 * @param {{ asIsXml: string, processName?: string, directives?: any[], sessionId?: string }} [params]
 * @returns {Promise<{ xml: string, summary: string }>}
 */
export async function generateToBeBpmn(backend, params = {}) {
    const { asIsXml, processName = '', directives = [], sessionId } = params;
    if (!backend || typeof backend.qdrantChat !== 'function') {
        throw new Error('backend.qdrantChat 를 사용할 수 없습니다.');
    }
    if (!asIsXml || !String(asIsXml).trim()) {
        throw new Error('As-Is BPMN XML 이 필요합니다.');
    }

    const message = buildPrompt({ processName, directives });
    const response = await backend.qdrantChat({
        message,
        xml: asIsXml,
        sessionId
    });

    const text = readAnswerText(response);
    const xml = extractBpmnXml(text);
    if (!xml) {
        throw new Error('AI가 유효한 BPMN XML 을 반환하지 않았습니다.');
    }

    // 요약 = XML 코드펜스를 제거한 앞부분 텍스트
    let summary = String(text)
        .replace(/```xml[\s\S]*?```/gi, '')
        .replace(/```[\s\S]*?```/g, '')
        .trim();
    summary = summary.split('\n').filter(Boolean).slice(0, 3).join(' ').slice(0, 400);

    return { xml, summary };
}
