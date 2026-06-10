/**
 * uengine 모드 전용: <uengine:json> 요소 형식 ↔ json="" 속성 형식 상호 변환.
 * 기존 모델(json 속성)은 그대로 두고, 로드 시 요소 형식 XML을 속성 형식으로 바꿔서 파싱하고,
 * 저장 시 속성 형식을 다시 요소 형식으로 바꿔서 내보냅니다.
 */

const UENGINE_NS = 'http://uengine';

function escapeXmlAttr(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#13;');
}

function unescapeXmlAttr(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

/**
 * 요소 형식 → 속성 형식 (로드 전에 호출).
 * <uengine:properties><uengine:json>...</uengine:json></uengine:properties>
 * → <uengine:properties json="...">
 */
export function uengineJsonElementToAttr(xmlString) {
    if (typeof xmlString !== 'string' || !xmlString.includes('uengine:json')) {
        return xmlString;
    }
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');
        if (doc.querySelector('parsererror')) return xmlString;

        const jsonElements = doc.getElementsByTagNameNS(UENGINE_NS, 'json');
        const toRemove = [];
        for (let i = 0; i < jsonElements.length; i++) {
            const el = jsonElements[i];
            const text = (el.textContent || '').trim();
            const parent = el.parentNode;
            if (parent && parent.namespaceURI === UENGINE_NS) {
                parent.setAttribute('json', text);
                toRemove.push(el);
            }
        }
        toRemove.forEach((el) => el.parentNode?.removeChild(el));

        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc);
    } catch (e) {
        console.warn('[uengineXmlTransform] elementToAttr failed:', e);
        return xmlString;
    }
}

/**
 * 속성 형식 → 요소 형식 (저장 후에 호출).
 * <uengine:properties json="..."> → <uengine:properties><uengine:json>...</uengine:json></uengine:properties>
 */
export function uengineJsonAttrToElement(xmlString) {
    if (typeof xmlString !== 'string' || !xmlString.includes('uengine')) {
        return xmlString;
    }
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');
        if (doc.querySelector('parsererror')) return xmlString;

        const all = doc.getElementsByTagNameNS(UENGINE_NS, 'properties');
        const list = [];
        for (let i = 0; i < all.length; i++) list.push(all[i]);
        const variables = doc.getElementsByTagNameNS(UENGINE_NS, 'variable');
        for (let i = 0; i < variables.length; i++) list.push(variables[i]);

        list.forEach((el) => {
            const jsonAttr = el.getAttribute('json');
            if (jsonAttr == null) return;
            const text = unescapeXmlAttr(jsonAttr);
            const child = doc.createElementNS(UENGINE_NS, 'json');
            child.textContent = text;
            el.removeAttribute('json');
            el.appendChild(child);
        });

        const serializer = new XMLSerializer();
        let out = serializer.serializeToString(doc);
        // 직렬화 시 uengine 접두어 복원 (일부 환경에서 <json xmlns="http://uengine"> 로 나옴)
        out = out.replace(/<json\s+xmlns="http:\/\/uengine">/gi, '<uengine:json>');
        out = out.replace(/(<uengine:json>)([\s\S]*?)<\/json>/gi, '$1$2</uengine:json>');
        return out;
    } catch (e) {
        console.warn('[uengineXmlTransform] attrToElement failed:', e);
        return xmlString;
    }
}

export function isUengineMode() {
    return typeof window !== 'undefined' && window.$mode === 'uEngine';
}

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';

function isValidJson(text) {
    if (text == null || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (trimmed === '') return false;
    try {
        JSON.parse(trimmed);
        return true;
    } catch {
        return false;
    }
}

export function normalizeUengineBpmnXmlForBackend(xmlString, definitionName) {
    if (!xmlString || typeof xmlString !== 'string') {
        return xmlString;
    }

    const name = definitionName != null && String(definitionName).trim() !== '' ? String(definitionName).trim() : null;

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');
        if (doc.querySelector('parsererror')) {
            return xmlString;
        }

        const processes = doc.getElementsByTagNameNS(BPMN_NS, 'process');
        if (!processes.length) {
            return xmlString;
        }

        const proc = processes[0];
        proc.setAttribute('isExecutable', 'true');
        if (name) {
            proc.setAttribute('name', name);
        }

        let ext = proc.getElementsByTagNameNS(BPMN_NS, 'extensionElements')[0];
        if (!ext) {
            ext = doc.createElementNS(BPMN_NS, 'bpmn:extensionElements');
            proc.insertBefore(ext, proc.firstChild);
        }

        let uprops = ext.getElementsByTagNameNS(UENGINE_NS, 'properties')[0];
        if (!uprops) {
            uprops = doc.createElementNS(UENGINE_NS, 'uengine:properties');
            ext.appendChild(uprops);
        }

        let jsonEl = uprops.getElementsByTagNameNS(UENGINE_NS, 'json')[0];
        const jsonAttr = uprops.getAttribute('json');
        let jsonObj = {};

        if (jsonEl && (jsonEl.textContent || '').trim()) {
            try {
                jsonObj = JSON.parse(jsonEl.textContent.trim());
            } catch {
                jsonObj = {};
            }
        } else if (jsonAttr != null && String(jsonAttr).trim() !== '') {
            try {
                jsonObj = JSON.parse(unescapeXmlAttr(jsonAttr));
            } catch {
                jsonObj = {};
            }
            uprops.removeAttribute('json');
            if (!jsonEl) {
                jsonEl = doc.createElementNS(UENGINE_NS, 'uengine:json');
                uprops.appendChild(jsonEl);
            }
        }

        if (name) {
            jsonObj.definitionName = name;
        }

        if (jsonEl || Object.keys(jsonObj).length > 0) {
            if (!jsonEl) {
                jsonEl = doc.createElementNS(UENGINE_NS, 'uengine:json');
                uprops.appendChild(jsonEl);
            }
            jsonEl.textContent = JSON.stringify(jsonObj);
        }

        const jsonAttrs = doc.querySelectorAll('[json]');
        jsonAttrs.forEach((el) => {
            const attr = el.getAttribute('json');
            if (attr == null) return;
            const text = unescapeXmlAttr(attr);
            if (!isValidJson(text)) return;

            const child = doc.createElementNS(UENGINE_NS, 'uengine:json');
            child.textContent = text;
            el.removeAttribute('json');
            el.appendChild(child);
        });

        return new XMLSerializer().serializeToString(doc);
    } catch (e) {
        console.warn('[uengineXmlTransform] normalizeUengineBpmnXmlForBackend failed:', e);
        return xmlString;
    }
}
