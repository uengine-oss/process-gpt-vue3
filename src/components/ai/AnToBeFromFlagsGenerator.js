/**
 * AnToBeFromFlagsGenerator — "반영" 태그된 PI Flag 들을 근거로 To-Be BPMN 도면을 생성.
 *
 * 순서도 코파일럿의 /tobe 명령 전용. As-Is BPMN 과 반영 PI Flag(개선방향)를 LLM 에 전달하여
 * 개선 사항이 반영된 To-Be BPMN 2.0 XML 을 직접 생성하고, bpmn-js 로 검증한 뒤 반환한다.
 */
import { extractBpmnXml, readAnswerText } from './blueprintAiUtils';
import { validateBpmn } from '@/composables/anStudio/callActivityModularizer';
import { repairGeneratedBpmnXml } from '@/utils/bpmnXmlRepair';

function buildPrompt({ processName, reflectedFlags }) {
    const flagLines = (reflectedFlags || [])
        .filter((f) => f && (f.improvement || f.problem || f.title))
        .map((f, i) => {
            const target = f.elementName ? ` (대상: ${f.elementName})` : '';
            const cat = f.category ? `[${f.category}] ` : '';
            const problem = f.problem ? ` 문제점: ${f.problem}` : '';
            const improvement = f.improvement ? ` 개선방향: ${f.improvement}` : '';
            return `${i + 1}. ${cat}${f.title || ''}${target}.${problem}${improvement}`.trim();
        });
    return [
        '당신은 통신사 프로세스 혁신(PI) BPMN 설계 전문가입니다.',
        `첨부된 As-Is BPMN 도면(프로세스: ${processName || '미지정'})에 아래 "반영 확정된 개선사항"을 모두 적용하여`,
        'To-Be BPMN 2.0 도면을 설계하세요.',
        '',
        '반영 확정된 개선사항(PI Flag):',
        ...(flagLines.length ? flagLines : ['(없음)']),
        '',
        '설계 규칙:',
        '- As-Is 의 전체 흐름과 의미를 유지하되, 위 개선사항을 반영해 단계 추가/제거/자동화/재배치하세요.',
        '- 자동화로 대체되는 수기 단계는 serviceTask 로, 사람이 수행하는 단계는 userTask 로 표현하세요.',
        '- 반드시 유효한 BPMN 2.0 XML 한 개만 출력합니다. bpmn:definitions 루트와 bpmndi 다이어그램(BPMNShape/BPMNEdge 좌표 포함)을 모두 포함해야 합니다.',
        '- 모든 sequenceFlow 의 sourceRef/targetRef 는 실제 존재하는 요소 id 를 가리켜야 하고, 시작(startEvent)과 종료(endEvent)가 있어야 합니다.',
        '- 모든 incoming/outgoing 텍스트 값은 실제 존재하는 sequenceFlow id 와 정확히 일치해야 합니다.',
        '- errorRef/messageRef/signalRef/escalationRef 를 쓰는 경우 bpmn:definitions 직계 하위에 같은 id 의 bpmn:error/message/signal/escalation 정의를 반드시 포함하세요.',
        '- 한국어 업무 용어로 name 을 작성하고, id 는 영문/숫자로만 작성하세요.',
        '',
        '다른 설명 없이 아래처럼 ```xml 코드펜스 안에 BPMN XML 만 출력하세요.',
        '```xml',
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<bpmn:definitions ...> ... </bpmn:definitions>',
        '```'
    ].join('\n');
}

/**
 * 반영 PI Flag 기반 To-Be BPMN 생성.
 * @param {any} backend
 * @param {{ asIsXml: string, processName?: string, reflectedFlags: any[], sessionId?: string }} params
 * @returns {Promise<{ xml: string, flagCount: number, repaired: boolean, repairWarnings: string[] }>}
 */
export async function generateToBeFromFlags(backend, params = {}) {
    const { asIsXml = '', processName = '', reflectedFlags = [], sessionId } = params;
    if (!backend || typeof backend.qdrantChat !== 'function') {
        throw new Error('backend.qdrantChat 를 사용할 수 없습니다.');
    }
    if (!asIsXml) {
        throw new Error('As-Is 도면이 없어 To-Be 를 생성할 수 없습니다.');
    }
    if (!reflectedFlags.length) {
        throw new Error('반영(To-Be 반영) 태그된 PI Flag 이 없습니다. PI Flag 에서 반영할 항목을 먼저 표시하세요.');
    }

    const message = buildPrompt({ processName, reflectedFlags });
    const response = await backend.qdrantChat({ message, xml: asIsXml, sessionId });
    const text = readAnswerText(response);
    const xml = extractBpmnXml(text);
    if (!xml) {
        throw new Error('AI 응답에서 To-Be BPMN 도면을 추출하지 못했습니다.');
    }
    const repaired = repairGeneratedBpmnXml(xml);
    const finalXml = repaired.xml || xml;
    const valid = await validateBpmn(finalXml);
    if (!valid.ok) {
        throw new Error(`생성된 To-Be 도면이 유효하지 않습니다: ${valid.error || 'invalid bpmn'}`);
    }
    return { xml: finalXml, flagCount: reflectedFlags.length, repaired: repaired.changed, repairWarnings: repaired.warnings };
}
