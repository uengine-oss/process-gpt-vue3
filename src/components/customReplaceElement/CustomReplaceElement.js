import ReplaceMenuProvider from 'bpmn-js/lib/features/popup-menu/ReplaceMenuProvider';
import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';
import { isEventSubProcess, isExpanded } from 'bpmn-js/lib/util/DiUtil';
import { isArray } from 'min-dash';
import * as bpmnReplaceOptions from 'bpmn-js/lib/features/replace/ReplaceOptions';
import {
    EXTRA_START_EVENT,
    EXTRA_START_EVENT_SUB_PROCESS,
    EXTRA_EVENT_SUB_PROCESS_START_EVENT,
    EXTRA_GATEWAY,
    EXTRA_INTERMEDIATE_EVENT
} from './extraReplaceOptions';
import { i18n } from '@/main';

/**
 * BPMN 포스터(bpmb.de 등) 트리거 행 순서: None → Message → Timer → Escalation → Conditional → Link → Error → Cancel → Compensation → Signal → Multiple → Parallel multiple → (Terminate는 종료만)
 * actionName 기준으로 정렬; 목록에 없는 항목은 뒤에 유지.
 */
function orderReplaceOptionsByKeys(replaceOptions, orderedActionNames) {
    const byAction = new Map(replaceOptions.map((o) => [o.actionName, o]));
    const used = new Set();
    const ordered = [];
    for (const actionName of orderedActionNames) {
        const opt = byAction.get(actionName);
        if (opt) {
            ordered.push(opt);
            used.add(actionName);
        }
    }
    for (const opt of replaceOptions) {
        if (!used.has(opt.actionName)) {
            ordered.push(opt);
        }
    }
    return ordered;
}

const START_EVENT_ACTION_ORDER = [
    'replace-with-none-start',
    'replace-with-none-intermediate-throwing',
    'replace-with-none-end',
    'replace-with-message-start',
    'replace-with-timer-start',
    'replace-with-conditional-start',
    'replace-with-signal-start',
    'replace-with-multiple-start',
    'replace-with-parallel-multiple-start'
];

const START_EVENT_SUB_PROCESS_ACTION_ORDER = [
    'replace-with-none-start',
    'replace-with-none-intermediate-throwing',
    'replace-with-none-end',
    'replace-with-message-start-embedded-sub',
    'replace-with-timer-start-embedded-sub',
    'replace-with-conditional-start-embedded-sub',
    'replace-with-signal-start-embedded-sub',
    'replace-with-multiple-start-sub',
    'replace-with-parallel-multiple-start-sub'
];

const EVENT_SUB_PROCESS_START_ACTION_ORDER = [
    'replace-with-message-start',
    'replace-with-timer-start',
    'replace-with-escalation-start',
    'replace-with-conditional-start',
    'replace-with-error-start',
    'replace-with-compensation-start',
    'replace-with-signal-start',
    'replace-with-multiple-start-esp',
    'replace-with-parallel-multiple-start-esp',
    'replace-with-non-interrupting-message-start',
    'replace-with-non-interrupting-timer-start',
    'replace-with-non-interrupting-escalation-start',
    'replace-with-non-interrupting-conditional-start',
    'replace-with-non-interrupting-signal-start',
    'replace-with-non-interrupting-multiple-start-esp',
    'replace-with-non-interrupting-parallel-multiple-start-esp'
];

const END_EVENT_ACTION_ORDER = [
    'replace-with-none-start',
    'replace-with-none-intermediate-throw',
    'replace-with-none-end',
    'replace-with-message-end',
    'replace-with-escalation-end',
    'replace-with-error-end',
    'replace-with-cancel-end',
    'replace-with-compensation-end',
    'replace-with-signal-end',
    'replace-with-terminate-end'
];

const INTERMEDIATE_EVENT_ACTION_ORDER = [
    'replace-with-none-start',
    'replace-with-none-intermediate-throw',
    'replace-with-none-end',
    'replace-with-message-intermediate-catch',
    'replace-with-message-intermediate-throw',
    'replace-with-timer-intermediate-catch',
    'replace-with-escalation-intermediate-throw',
    'replace-with-conditional-intermediate-catch',
    'replace-with-link-intermediate-catch',
    'replace-with-link-intermediate-throw',
    'replace-with-error-intermediate-catch',
    'replace-with-compensation-intermediate-throw',
    'replace-with-signal-intermediate-catch',
    'replace-with-signal-intermediate-throw',
    'replace-with-multiple-intermediate-catch',
    'replace-with-multiple-intermediate-throw',
    'replace-with-parallel-multiple-intermediate-catch',
    'replace-with-parallel-multiple-intermediate-throw'
];

const BOUNDARY_REPLACE_ACTION_ORDER = [
    'replace-with-message-boundary',
    'replace-with-timer-boundary',
    'replace-with-escalation-boundary',
    'replace-with-conditional-boundary',
    'replace-with-error-boundary',
    'replace-with-cancel-boundary',
    'replace-with-compensation-boundary',
    'replace-with-signal-boundary',
    'replace-with-non-interrupting-message-boundary',
    'replace-with-non-interrupting-timer-boundary',
    'replace-with-non-interrupting-escalation-boundary',
    'replace-with-non-interrupting-conditional-boundary',
    'replace-with-non-interrupting-signal-boundary'
];

/**
 * bpmn-js 기본 ReplaceMenuProvider는 동일 타입 숨김·컨텍스트 필터 등으로 항목을 줄인다.
 * 커스텀: ReplaceOptions에 정의된 항목은 컨텍스트와 관계없이 교체 메뉴에 모두 표시한다.
 */
export default class CustomReplaceMenuProvider extends ReplaceMenuProvider {
    constructor(bpmnFactory, popupMenu, modeling, moddle, bpmnReplace, rules, translate, moddleCopy) {
        super(bpmnFactory, popupMenu, modeling, moddle, bpmnReplace, rules, translate, moddleCopy);
        this.bpmnFactory = bpmnFactory;
        this.popupMenu = popupMenu;
        this.modeling = modeling;
        this.moddle = moddle;
        this.bpmnReplace = bpmnReplace;
        this.rules = rules;
        this.translate = translate;
        this.moddleCopy = moddleCopy;
    }

    _applyI18nToEntries(entries) {
        Object.keys(entries).forEach((key) => {
            if (entries[key].label) {
                const translationKey = `CustomReplaceElement.${key}`;
                entries[key].label = i18n.global.t(translationKey);
            }
        });
        return entries;
    }

    _createEntries(target, replaceOptionList) {
        const entries = ReplaceMenuProvider.prototype._createEntries.call(this, target, replaceOptionList);
        return this._applyI18nToEntries(entries);
    }

    /**
     * customPopupMenu가 기본 replace 프로바이더와 병합할 때 객체 키 삽입 순서가 꼬임 → updater로 최종 entries만 사용.
     * @param {string[] | null} orderedActionNames null이면 replaceOptionList 배열 순서 유지
     */
    _replacerEntries(target, replaceOptionList, orderedActionNames = null) {
        const list = orderedActionNames
            ? orderReplaceOptionsByKeys(replaceOptionList, orderedActionNames)
            : replaceOptionList;
        return () => this._createEntries(target, list);
    }

    /**
     * 시퀀스 플로우: bpmn-js는 소스/게이트 상태에 따라 일부만 노출한다. 항상 3종 전부 표시.
     */
    _createFullSequenceFlowEntries(target) {
        const businessObject = getBusinessObject(target);
        const modeling = this._modeling;
        const moddle = this._moddle;
        const self = this;

        const seq = bpmnReplaceOptions.SEQUENCE_FLOW.find((o) => o.actionName === 'replace-with-sequence-flow');
        const def = bpmnReplaceOptions.SEQUENCE_FLOW.find((o) => o.actionName === 'replace-with-default-flow');
        const cond = bpmnReplaceOptions.SEQUENCE_FLOW.find((o) => o.actionName === 'replace-with-conditional-flow');

        const entries = {};

        entries[def.actionName] = self._createEntry(def, target, function () {
            modeling.updateProperties(target.source, { default: businessObject });
        });

        entries[cond.actionName] = self._createEntry(cond, target, function () {
            const conditionExpression = moddle.create('bpmn:FormalExpression', { body: '' });
            modeling.updateProperties(target, { conditionExpression: conditionExpression });
        });

        entries[seq.actionName] = self._createEntry(seq, target, function () {
            if (businessObject.conditionExpression) {
                modeling.updateProperties(target, { conditionExpression: undefined });
            }
            const sr = businessObject.sourceRef;
            if (sr && sr.default === businessObject) {
                modeling.updateProperties(target.source, { default: undefined });
            }
        });

        return entries;
    }

    getPopupMenuEntries(target) {
        const businessObject = target.businessObject;
        const rules = this._rules;

        if (isArray(target) || !rules.allowed('shape.replace', { element: target })) {
            return {};
        }

        if (is(businessObject, 'bpmn:DataObjectReference')) {
            return this._replacerEntries(target, bpmnReplaceOptions.DATA_OBJECT_REFERENCE);
        }

        if (is(businessObject, 'bpmn:DataStoreReference') && !is(target.parent, 'bpmn:Collaboration')) {
            return this._replacerEntries(target, bpmnReplaceOptions.DATA_STORE_REFERENCE);
        }

        if (is(businessObject, 'bpmn:StartEvent') && !is(businessObject.$parent, 'bpmn:SubProcess')) {
            return this._replacerEntries(
                target,
                [...bpmnReplaceOptions.START_EVENT, ...EXTRA_START_EVENT],
                START_EVENT_ACTION_ORDER
            );
        }

        if (is(businessObject, 'bpmn:Participant')) {
            return this._replacerEntries(target, bpmnReplaceOptions.PARTICIPANT);
        }

        if (is(businessObject, 'bpmn:StartEvent') && isEventSubProcess(businessObject.$parent)) {
            return this._replacerEntries(
                target,
                [...bpmnReplaceOptions.EVENT_SUB_PROCESS_START_EVENT, ...EXTRA_EVENT_SUB_PROCESS_START_EVENT],
                EVENT_SUB_PROCESS_START_ACTION_ORDER
            );
        }

        if (
            is(businessObject, 'bpmn:StartEvent') &&
            !isEventSubProcess(businessObject.$parent) &&
            is(businessObject.$parent, 'bpmn:SubProcess')
        ) {
            return this._replacerEntries(
                target,
                [...bpmnReplaceOptions.START_EVENT_SUB_PROCESS, ...EXTRA_START_EVENT_SUB_PROCESS],
                START_EVENT_SUB_PROCESS_ACTION_ORDER
            );
        }

        if (is(businessObject, 'bpmn:EndEvent')) {
            return this._replacerEntries(target, bpmnReplaceOptions.END_EVENT, END_EVENT_ACTION_ORDER);
        }

        if (is(businessObject, 'bpmn:BoundaryEvent')) {
            return this._replacerEntries(
                target,
                bpmnReplaceOptions.BOUNDARY_EVENT,
                BOUNDARY_REPLACE_ACTION_ORDER
            );
        }

        if (is(businessObject, 'bpmn:IntermediateCatchEvent') || is(businessObject, 'bpmn:IntermediateThrowEvent')) {
            return this._replacerEntries(
                target,
                [...bpmnReplaceOptions.INTERMEDIATE_EVENT, ...EXTRA_INTERMEDIATE_EVENT],
                INTERMEDIATE_EVENT_ACTION_ORDER
            );
        }

        if (is(businessObject, 'bpmn:Gateway')) {
            return this._replacerEntries(target, [...bpmnReplaceOptions.GATEWAY, ...EXTRA_GATEWAY]);
        }

        if (is(businessObject, 'bpmn:Transaction')) {
            return this._replacerEntries(target, bpmnReplaceOptions.TRANSACTION);
        }

        if (isEventSubProcess(businessObject) && isExpanded(target)) {
            return this._replacerEntries(target, bpmnReplaceOptions.EVENT_SUB_PROCESS);
        }

        if (is(businessObject, 'bpmn:SubProcess') && isExpanded(target)) {
            return this._replacerEntries(target, bpmnReplaceOptions.SUBPROCESS_EXPANDED);
        }

        if (is(businessObject, 'bpmn:AdHocSubProcess') && !isExpanded(target)) {
            return this._replacerEntries(target, bpmnReplaceOptions.TASK);
        }

        if (is(businessObject, 'bpmn:SequenceFlow')) {
            return () => this._applyI18nToEntries(this._createFullSequenceFlowEntries(target));
        }

        if (is(businessObject, 'bpmn:FlowNode')) {
            return this._replacerEntries(target, bpmnReplaceOptions.TASK);
        }

        return {};
    }

    getPopupMenuHeaderEntries(target) {
        const headerEntries = ReplaceMenuProvider.prototype.getPopupMenuHeaderEntries.call(this, target);
        Object.keys(headerEntries).forEach((key) => {
            if (headerEntries[key].title) {
                const translationKey = `CustomReplaceElement.${key}`;
                headerEntries[key].title = i18n.global.t(translationKey);
            }
        });
        return headerEntries;
    }
}

CustomReplaceMenuProvider.$inject = [
    'bpmnFactory',
    'popupMenu',
    'modeling',
    'moddle',
    'bpmnReplace',
    'rules',
    'translate',
    'moddleCopy'
];
