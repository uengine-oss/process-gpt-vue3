import test from 'node:test';
import assert from 'node:assert/strict';

import { applyCatalogItemToElement, normalizeCatalogTaskType, snapshotElementForCatalog } from './taskCatalogApply.js';

// ── 최소 모델러 스텁 — 호출 순서·전달 요소를 기록한다 ──
function makeStubModeler(rawElement) {
    const calls = [];
    const bpmnFactory = {
        create(type, attrs = {}) {
            return { $type: type, ...attrs, get: (key) => attrs[key] ?? [] };
        }
    };
    const modeling = {
        updateProperties(target, props) {
            calls.push({ op: 'updateProperties', target, props });
            if (props.name !== undefined) target.businessObject.name = props.name;
            if (props.extensionElements !== undefined) target.businessObject.extensionElements = props.extensionElements;
        }
    };
    const bpmnReplace = {
        replaceElement(target, { type }) {
            calls.push({ op: 'replaceElement', target, type });
            // bpmn-js 처럼 name/extensionElements 를 새 요소로 복사한다
            return {
                id: target.id,
                type,
                businessObject: {
                    id: target.businessObject.id,
                    $type: type,
                    name: target.businessObject.name,
                    extensionElements: target.businessObject.extensionElements
                }
            };
        }
    };
    const elementRegistry = { get: (id) => (id === rawElement.id ? rawElement : null) };
    const eventBus = {
        fire(name, event) {
            calls.push({ op: 'fire', name, element: event?.element });
        }
    };
    const services = { modeling, bpmnFactory, bpmnReplace, elementRegistry, eventBus };
    return { modeler: { get: (name) => services[name] }, calls };
}

function makeElement(type = 'bpmn:Task', props = {}) {
    const json = Object.keys(props).length ? JSON.stringify(props) : null;
    return {
        id: 'task_1',
        type,
        businessObject: {
            id: 'task_1',
            $type: type,
            name: '기존 이름',
            extensionElements: json ? { values: [{ $type: 'uengine:Properties', json }] } : null
        }
    };
}

const ITEM = {
    id: 'cat-1',
    name: '결재 요청',
    system_name: 'ERP',
    task_type: 'bpmn:UserTask',
    properties: { raci: { R: ['재무팀'] }, description: '결재' }
};

test('타입 전환 전에 이름·속성을 적용한다 — 전환 훅 예외에도 값이 유실되지 않게', () => {
    const element = makeElement('bpmn:Task');
    const { modeler, calls } = makeStubModeler(element);

    const applied = applyCatalogItemToElement(modeler, element, ITEM);

    assert.deepEqual(
        calls.map((c) => c.op),
        ['updateProperties', 'replaceElement', 'fire']
    );
    // 적용 완료 통지 — 패널이 이 이벤트로 폼을 즉시 갱신한다 (적용된 최종 요소를 실어야 함)
    const fired = calls.at(-1);
    assert.equal(fired.name, 'taskCatalog.applied');
    assert.equal(fired.element, applied);
    assert.equal(applied.type, 'bpmn:UserTask');
    assert.equal(applied.businessObject.name, '결재 요청');
    const json = JSON.parse(applied.businessObject.extensionElements.values.at(-1).json);
    assert.equal(json._catalogId, 'cat-1');
    assert.deepEqual(json.raci, { R: ['재무팀'] });
});

test('Vue 프록시로 감싼 요소도 레지스트리의 원본으로 재해석해 모델링에 넘긴다', () => {
    const raw = makeElement('bpmn:UserTask');
    const proxied = new Proxy(raw, {}); // 패널의 반응형 프록시 흉내
    const { modeler, calls } = makeStubModeler(raw);

    applyCatalogItemToElement(modeler, proxied, ITEM);

    // 같은 타입이라 replace 없이 updateProperties + 적용 통지만 — 원본(raw)이 전달돼야 한다
    assert.deepEqual(
        calls.map((c) => c.op),
        ['updateProperties', 'fire']
    );
    assert.equal(calls[0].target, raw);
    assert.equal(calls[1].element, raw);
});

test('기존 uengine 속성은 유지하고 겹치는 키만 카탈로그 값으로 덮는다', () => {
    const element = makeElement('bpmn:UserTask', { keepMe: 'yes', description: '옛 설명' });
    const { modeler } = makeStubModeler(element);

    const applied = applyCatalogItemToElement(modeler, element, ITEM);

    const json = JSON.parse(applied.businessObject.extensionElements.values.at(-1).json);
    assert.equal(json.keepMe, 'yes');
    assert.equal(json.description, '결재');
});

test('normalizeCatalogTaskType — bpmn: 접두사 보정과 기본값', () => {
    assert.equal(normalizeCatalogTaskType('UserTask'), 'bpmn:UserTask');
    assert.equal(normalizeCatalogTaskType('bpmn:SendTask'), 'bpmn:SendTask');
    assert.equal(normalizeCatalogTaskType(''), 'bpmn:UserTask');
});

test('snapshotElementForCatalog — 요소 고유 상태(comments, _catalogId)는 제외한다', () => {
    const element = makeElement('bpmn:UserTask', {
        description: '설명',
        raci: { R: ['A'] },
        comments: [{ id: 1 }],
        _catalogId: 'old'
    });

    const snapshot = snapshotElementForCatalog(element);

    assert.equal(snapshot.name, '기존 이름');
    assert.equal(snapshot.task_type, 'bpmn:UserTask');
    assert.equal(snapshot.description, '설명');
    assert.deepEqual(snapshot.properties.raci, { R: ['A'] });
    assert.equal('comments' in snapshot.properties, false);
    assert.equal('_catalogId' in snapshot.properties, false);
});
