/**
 * bpmn-js ReplaceOptions.js 에서 비활성(주석) 처리되었거나 목록에 없는 BPMN 2.0 교체 항목.
 * node_modules 수정 없이 교체 메뉴에만 병합한다.
 *
 * 스펙에 없어 넣지 않는 예: 종료 이벤트의 타이머/조건/링크, 일반 풀의 에스컬레이션·오류 시작,
 * 경계의 링크/다중, 중간 잡기의 에스컬레이션·취소 등 (BPMN 2.0 트리거×컨텍스트 매트릭스 기준).
 */

export const EXTRA_START_EVENT = [
    {
        label: 'Multiple start event',
        actionName: 'replace-with-multiple-start',
        className: 'bpmn-icon-start-event-multiple',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:MultipleEventDefinition'
        }
    },
    {
        label: 'Parallel multiple start event',
        actionName: 'replace-with-parallel-multiple-start',
        className: 'bpmn-icon-start-event-parallel-multiple',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:ParallelMultipleEventDefinition'
        }
    }
];

/**
 * bpmn-js START_EVENT_SUB_PROCESS 는 형태 전환만 있음.
 * BPMN: 일반(비-이벤트) 확장 서브프로세스 안 시작도 메시지/타이머/조건/신호 등 허용.
 */
const EMBEDDED_SUBPROCESS_START_TRIGGERS = [
    {
        label: 'Message start event',
        actionName: 'replace-with-message-start-embedded-sub',
        className: 'bpmn-icon-start-event-message',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:MessageEventDefinition'
        }
    },
    {
        label: 'Timer start event',
        actionName: 'replace-with-timer-start-embedded-sub',
        className: 'bpmn-icon-start-event-timer',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:TimerEventDefinition'
        }
    },
    {
        label: 'Conditional start event',
        actionName: 'replace-with-conditional-start-embedded-sub',
        className: 'bpmn-icon-start-event-condition',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:ConditionalEventDefinition'
        }
    },
    {
        label: 'Signal start event',
        actionName: 'replace-with-signal-start-embedded-sub',
        className: 'bpmn-icon-start-event-signal',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:SignalEventDefinition'
        }
    }
];

export const EXTRA_START_EVENT_SUB_PROCESS = [
    ...EMBEDDED_SUBPROCESS_START_TRIGGERS,
    {
        label: 'Multiple start event',
        actionName: 'replace-with-multiple-start-sub',
        className: 'bpmn-icon-start-event-multiple',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:MultipleEventDefinition'
        }
    },
    {
        label: 'Parallel multiple start event',
        actionName: 'replace-with-parallel-multiple-start-sub',
        className: 'bpmn-icon-start-event-parallel-multiple',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:ParallelMultipleEventDefinition'
        }
    }
];

export const EXTRA_EVENT_SUB_PROCESS_START_EVENT = [
    {
        label: 'Multiple start event',
        actionName: 'replace-with-multiple-start-esp',
        className: 'bpmn-icon-start-event-multiple',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:MultipleEventDefinition',
            isInterrupting: true
        }
    },
    {
        label: 'Parallel multiple start event',
        actionName: 'replace-with-parallel-multiple-start-esp',
        className: 'bpmn-icon-start-event-parallel-multiple',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:ParallelMultipleEventDefinition',
            isInterrupting: true
        }
    },
    {
        label: 'Multiple start event (non-interrupting)',
        actionName: 'replace-with-non-interrupting-multiple-start-esp',
        className: 'bpmn-icon-start-event-non-interrupting-multiple',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:MultipleEventDefinition',
            isInterrupting: false
        }
    },
    {
        label: 'Parallel multiple start event (non-interrupting)',
        actionName: 'replace-with-non-interrupting-parallel-multiple-start-esp',
        className: 'bpmn-icon-start-event-non-interrupting-parallel-multiple',
        target: {
            type: 'bpmn:StartEvent',
            eventDefinitionType: 'bpmn:ParallelMultipleEventDefinition',
            isInterrupting: false
        }
    }
];

/**
 * bpmn-js #194 로 주석 처리된 이벤트 기반 인스턴스형 게이트웨이.
 * instantiate / eventGatewayType 은 BpmnReplace CUSTOM_PROPERTIES 로 새 BO에 반영됨.
 */
export const EXTRA_GATEWAY = [
    {
        label: 'Event-based instantiating gateway (exclusive)',
        actionName: 'replace-with-exclusive-event-based-gateway',
        className: 'bpmn-icon-gateway-eventbased',
        target: {
            type: 'bpmn:EventBasedGateway',
            instantiate: true,
            eventGatewayType: 'Exclusive'
        }
    },
    {
        label: 'Event-based instantiating gateway (parallel)',
        actionName: 'replace-with-parallel-event-based-instantiate-gateway',
        className: 'bpmn-icon-gateway-eventbased',
        target: {
            type: 'bpmn:EventBasedGateway',
            instantiate: true,
            eventGatewayType: 'Parallel'
        }
    }
];

/** bpmn-js INTERMEDIATE_EVENT 에 없는 항목 (포스터: 오류 잡기 / 다중·병렬 다중 잡기) */
export const EXTRA_INTERMEDIATE_EVENT = [
    {
        label: 'Error intermediate catch event',
        actionName: 'replace-with-error-intermediate-catch',
        className: 'bpmn-icon-intermediate-event-catch-error',
        target: {
            type: 'bpmn:IntermediateCatchEvent',
            eventDefinitionType: 'bpmn:ErrorEventDefinition'
        }
    },
    {
        label: 'Multiple intermediate catch event',
        actionName: 'replace-with-multiple-intermediate-catch',
        className: 'bpmn-icon-intermediate-event-catch-multiple',
        target: {
            type: 'bpmn:IntermediateCatchEvent',
            eventDefinitionType: 'bpmn:MultipleEventDefinition'
        }
    },
    {
        label: 'Parallel multiple intermediate catch event',
        actionName: 'replace-with-parallel-multiple-intermediate-catch',
        className: 'bpmn-icon-intermediate-event-catch-parallel-multiple',
        target: {
            type: 'bpmn:IntermediateCatchEvent',
            eventDefinitionType: 'bpmn:ParallelMultipleEventDefinition'
        }
    },
    {
        label: 'Multiple intermediate throw event',
        actionName: 'replace-with-multiple-intermediate-throw',
        className: 'bpmn-icon-intermediate-event-throw-multiple',
        target: {
            type: 'bpmn:IntermediateThrowEvent',
            eventDefinitionType: 'bpmn:MultipleEventDefinition'
        }
    },
    {
        label: 'Parallel multiple intermediate throw event',
        actionName: 'replace-with-parallel-multiple-intermediate-throw',
        className: 'bpmn-icon-intermediate-event-throw-multiple',
        target: {
            type: 'bpmn:IntermediateThrowEvent',
            eventDefinitionType: 'bpmn:ParallelMultipleEventDefinition'
        }
    }
];
