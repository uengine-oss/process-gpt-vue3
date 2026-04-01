/**
 * 계층도(ProcessHierarchy)용: BPMN XML에서 프로세스 루트의 uengine:properties(json) 파싱.
 * uEngine은 proc_def JSON 없이 BPMN만 오는 경우가 많아 Properties 패널에 메타를 채우기 위해 사용.
 */
const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const UE_NS = 'http://uengine';

/** BPMN 메타에 문자열 대신 다국어 객체 등이 들어온 경우 텍스트 필드용 문자열로 변환 */
export function coerceProcessMetaText(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && !Array.isArray(value)) {
        if (value.text != null && String(value.text).trim() !== '') return String(value.text);
        const loc =
            typeof navigator !== 'undefined' && navigator.language ? navigator.language.split('-')[0] : 'ko';
        if (value[loc] != null && String(value[loc]).trim() !== '') return String(value[loc]);
        if (value.ko != null && String(value.ko).trim() !== '') return String(value.ko);
        if (value.en != null && String(value.en).trim() !== '') return String(value.en);
        const first = Object.values(value).find((x) => x != null && String(x).trim() !== '');
        if (first != null) return String(first);
        return '';
    }
    return String(value);
}

const RESERVED_ROOT_KEYS = new Set([
    'version',
    'definitionName',
    'shortDescription',
    'instanceNamePattern',
    'description',
    'manualLink',
    'systems',
    'fte',
    'customProperties'
]);

/**
 * @param {string} xml
 * @returns {Record<string, any>|null}
 */
export function parseUengineProcessRootMetaFromXml(xml) {
    if (!xml || typeof xml !== 'string') return null;
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const parseErr = doc.querySelector('parsererror');
        if (parseErr) return null;

        const processes = doc.getElementsByTagNameNS(BPMN_NS, 'process');
        if (!processes.length) return null;

        const proc = processes[0];
        const procNameAttr = proc.getAttribute('name') || '';

        let mergedJson = {};
        const extEls = proc.getElementsByTagNameNS(BPMN_NS, 'extensionElements');
        for (let e = 0; e < extEls.length; e++) {
            const ee = extEls[e];
            if (ee.parentElement !== proc) continue;
            const props = ee.getElementsByTagNameNS(UE_NS, 'properties');
            for (let i = 0; i < props.length; i++) {
                const pel = props[i];
                let raw = pel.getAttribute('json');
                if (!raw || !String(raw).trim()) {
                    const jsonEls = pel.getElementsByTagNameNS(UE_NS, 'json');
                    if (jsonEls.length) {
                        raw = (jsonEls[0].textContent || '').trim();
                    }
                }
                if (!raw) continue;
                try {
                    const o = JSON.parse(raw);
                    if (o && typeof o === 'object') mergedJson = { ...mergedJson, ...o };
                } catch {
                    /* ignore */
                }
            }
        }

        // 프로세스 탭 설명 = 루트 JSON의 shortDescription.text (또는 구형 문자열/다국어)
        const shortDescText = coerceProcessMetaText(mergedJson.shortDescription);
        const out = {
            name: coerceProcessMetaText(mergedJson.definitionName) || procNameAttr,
            description: shortDescText,
            /** XML에 다시 쓸 때 shortDescription 객체 병합용 */
            _shortDescriptionShape:
                mergedJson.shortDescription != null && typeof mergedJson.shortDescription === 'object' && !Array.isArray(mergedJson.shortDescription)
                    ? { ...mergedJson.shortDescription }
                    : { text: '' },
            systems: Array.isArray(mergedJson.systems) ? [...mergedJson.systems] : mergedJson.systems,
            fte: mergedJson.fte && typeof mergedJson.fte === 'object' ? { ...mergedJson.fte } : undefined
        };

        Object.keys(mergedJson).forEach((k) => {
            if (RESERVED_ROOT_KEYS.has(k)) return;
            if (out[k] !== undefined) return;
            out[k] = mergedJson[k];
        });

        out._uengineProcessRootJson = mergedJson;
        return out;
    } catch {
        return null;
    }
}
