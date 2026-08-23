export interface BpmnXmlRepairResult {
    xml: string;
    changed: boolean;
    warnings: string[];
}

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';

const EVENT_ROOT_BY_REF_ATTR: Record<string, string> = {
    errorRef: 'error',
    escalationRef: 'escalation',
    messageRef: 'message',
    signalRef: 'signal'
};

const PRUNABLE_ATTR_REFS = ['default', 'attachedToRef', 'dataObjectRef', 'dataStoreRef', 'processRef', 'categoryValueRef', 'operationRef'];

const EDGE_LIKE_ELEMENTS = ['sequenceFlow', 'messageFlow', 'association'];

function parseXml(xml: string): Document | null {
    try {
        if (typeof DOMParser === 'undefined') return null;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) return null;
        return doc;
    } catch {
        return null;
    }
}

function serializeXml(doc: Document): string {
    const serialized = new XMLSerializer().serializeToString(doc.documentElement);
    return serialized.startsWith('<?xml') ? serialized : `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
}

function elementsByLocal(root: Element | Document, names: string[]): Element[] {
    const wanted = new Set(names);
    const out: Element[] = [];
    const all = root.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        const el = all[i] as Element;
        if (wanted.has(el.localName || '')) out.push(el);
    }
    return out;
}

function firstByLocal(root: Element | Document, name: string): Element | null {
    const all = root.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        const el = all[i] as Element;
        if (el.localName === name) return el;
    }
    return null;
}

function directChildByLocal(root: Element, name: string): Element | null {
    for (const child of Array.from(root.children)) {
        if (child.localName === name) return child;
    }
    return null;
}

function collectIds(doc: Document): Set<string> {
    const ids = new Set<string>();
    const all = doc.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        const id = (all[i] as Element).getAttribute('id');
        if (id) ids.add(id);
    }
    return ids;
}

function collectSequenceFlowIds(doc: Document): Set<string> {
    const ids = new Set<string>();
    for (const flow of elementsByLocal(doc, ['sequenceFlow'])) {
        const id = flow.getAttribute('id');
        if (id) ids.add(id);
    }
    return ids;
}

function removeElement(el: Element): boolean {
    if (!el.parentNode) return false;
    el.parentNode.removeChild(el);
    return true;
}

function createBpmnElement(doc: Document, localName: string): Element {
    const root = doc.documentElement;
    const prefix = root.lookupPrefix(BPMN_NS) || (root.namespaceURI === BPMN_NS && root.prefix) || 'bpmn';
    return doc.createElementNS(BPMN_NS, prefix ? `${prefix}:${localName}` : localName);
}

function insertRootElement(definitions: Element, element: Element) {
    const firstDiagram = directChildByLocal(definitions, 'BPMNDiagram');
    definitions.insertBefore(element, firstDiagram);
}

function humanizeId(id: string): string {
    return String(id || '')
        .replace(/^[A-Za-z]+_/, '')
        .replace(/[_-]+/g, ' ')
        .trim();
}

function ensureRootEventDefinitions(doc: Document, warnings: string[]): boolean {
    const definitions = doc.documentElement.localName === 'definitions' ? doc.documentElement : firstByLocal(doc, 'definitions');
    if (!definitions) return false;

    const ids = collectIds(doc);
    let changed = false;
    for (const [attr, rootLocalName] of Object.entries(EVENT_ROOT_BY_REF_ATTR)) {
        const refs = new Set<string>();
        for (const el of elementsByLocal(doc, [
            'errorEventDefinition',
            'escalationEventDefinition',
            'messageEventDefinition',
            'signalEventDefinition'
        ])) {
            const ref = el.getAttribute(attr);
            if (ref && !ids.has(ref)) refs.add(ref);
        }
        for (const ref of refs) {
            const rootDef = createBpmnElement(doc, rootLocalName);
            rootDef.setAttribute('id', ref);
            const name = humanizeId(ref);
            if (name) rootDef.setAttribute('name', name);
            insertRootElement(definitions, rootDef);
            ids.add(ref);
            changed = true;
            warnings.push(`added missing ${rootLocalName} definition ${ref}`);
        }
    }
    return changed;
}

function removeDiForBpmnElement(doc: Document, bpmnElementId: string) {
    for (const di of elementsByLocal(doc, ['BPMNShape', 'BPMNEdge'])) {
        if (di.getAttribute('bpmnElement') === bpmnElementId) removeElement(di);
    }
}

function pruneInvalidEdgeLikeElements(doc: Document, warnings: string[]): boolean {
    const ids = collectIds(doc);
    let changed = false;
    for (const el of elementsByLocal(doc, EDGE_LIKE_ELEMENTS)) {
        const id = el.getAttribute('id') || '';
        const source = el.getAttribute('sourceRef') || '';
        const target = el.getAttribute('targetRef') || '';
        const missingSource = !!source && !ids.has(source);
        const missingTarget = !!target && !ids.has(target);
        const sequenceMissingEndpoint = el.localName === 'sequenceFlow' && (!source || !target);
        if (missingSource || missingTarget || sequenceMissingEndpoint) {
            if (id) removeDiForBpmnElement(doc, id);
            if (removeElement(el)) {
                changed = true;
                warnings.push(`removed ${el.localName || 'edge'} ${id || '(no id)'} with unresolved endpoint`);
            }
        }
    }
    return changed;
}

function pruneTextRefs(doc: Document, warnings: string[]): boolean {
    const sequenceFlowIds = collectSequenceFlowIds(doc);
    const ids = collectIds(doc);
    let changed = false;

    for (const ref of elementsByLocal(doc, ['incoming', 'outgoing'])) {
        const targetId = (ref.textContent || '').trim();
        if (targetId && !sequenceFlowIds.has(targetId) && removeElement(ref)) {
            changed = true;
            warnings.push(`removed ${ref.localName} reference ${targetId}`);
        }
    }

    for (const ref of elementsByLocal(doc, ['flowNodeRef'])) {
        const targetId = (ref.textContent || '').trim();
        if (targetId && !ids.has(targetId) && removeElement(ref)) {
            changed = true;
            warnings.push(`removed lane reference ${targetId}`);
        }
    }

    for (const assoc of elementsByLocal(doc, ['dataInputAssociation', 'dataOutputAssociation'])) {
        const dangling = elementsByLocal(assoc, ['sourceRef', 'targetRef']).some((ref) => {
            const targetId = (ref.textContent || '').trim();
            return !!targetId && !ids.has(targetId);
        });
        if (dangling && removeElement(assoc)) {
            changed = true;
            warnings.push(`removed ${assoc.localName} with unresolved data reference`);
        }
    }

    return changed;
}

function pruneAttributeRefs(doc: Document, warnings: string[]): boolean {
    const ids = collectIds(doc);
    let changed = false;
    const all = doc.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        const el = all[i] as Element;
        for (const attr of PRUNABLE_ATTR_REFS) {
            const ref = el.getAttribute(attr);
            if (ref && !ids.has(ref)) {
                el.removeAttribute(attr);
                changed = true;
                warnings.push(`removed ${attr} reference ${ref}`);
            }
        }
    }
    return changed;
}

function pruneInvalidDi(doc: Document, warnings: string[]): boolean {
    const ids = collectIds(doc);
    let changed = false;
    for (const di of elementsByLocal(doc, ['BPMNShape', 'BPMNEdge'])) {
        const ref = di.getAttribute('bpmnElement');
        if (ref && !ids.has(ref) && removeElement(di)) {
            changed = true;
            warnings.push(`removed DI reference ${ref}`);
        }
    }

    const plane = firstByLocal(doc, 'BPMNPlane');
    if (plane) {
        const ref = plane.getAttribute('bpmnElement');
        if (ref && !ids.has(ref)) {
            const main = firstByLocal(doc, 'collaboration') || firstByLocal(doc, 'process');
            const mainId = main?.getAttribute('id') || '';
            if (mainId) {
                plane.setAttribute('bpmnElement', mainId);
                changed = true;
                warnings.push(`rewired BPMNPlane from ${ref} to ${mainId}`);
            }
        }
    }
    return changed;
}

/**
 * Repairs common LLM-generated BPMN reference mistakes before bpmn-js import.
 * It only adds safe root event definitions or removes references that cannot be
 * resolved from the generated XML.
 */
export function repairGeneratedBpmnXml(xml: string): BpmnXmlRepairResult {
    const source = String(xml || '');
    const doc = parseXml(source);
    if (!doc) return { xml: source, changed: false, warnings: ['BPMN XML could not be parsed for repair'] };

    const warnings: string[] = [];
    let changed = false;
    changed = ensureRootEventDefinitions(doc, warnings) || changed;
    changed = pruneInvalidEdgeLikeElements(doc, warnings) || changed;
    changed = pruneTextRefs(doc, warnings) || changed;
    changed = pruneAttributeRefs(doc, warnings) || changed;
    changed = pruneInvalidDi(doc, warnings) || changed;

    return {
        xml: changed ? serializeXml(doc) : source,
        changed,
        warnings
    };
}
