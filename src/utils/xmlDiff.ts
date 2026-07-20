/**
 * XML 변경 감지 유틸리티
 * BPMN XML의 실질적인 변경 여부를 판단하기 위한 함수들
 */

/**
 * 간단한 해시 함수 (cyrb53)
 * 빠른 문자열 해싱을 위해 사용
 */
function cyrb53(str: string, seed = 0): string {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 16), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 16), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * XML을 정규화하여 비교 가능한 형태로 변환
 * - 공백 제거
 * - 위치 관련 속성(x, y, width, height, waypoint) 제거 (선택적)
 * - 속성 정렬
 */
export function normalizeXML(xml: string, ignorePositions = false): string {
    if (!xml) return '';

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');

        // 파싱 오류 확인
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            console.warn('XML 파싱 오류, 원본 반환');
            return xml;
        }

        // 위치 관련 속성 제거 (선택적)
        if (ignorePositions) {
            const positionAttrs = ['x', 'y', 'width', 'height'];
            const allElements = doc.querySelectorAll('*');
            allElements.forEach((el) => {
                positionAttrs.forEach((attr) => {
                    el.removeAttribute(attr);
                });
            });

            // waypoint 요소 제거
            const waypoints = doc.querySelectorAll('di\\:waypoint, waypoint');
            waypoints.forEach((wp) => wp.remove());

            // Bounds 요소의 위치 속성 제거
            const bounds = doc.querySelectorAll('dc\\:Bounds, Bounds');
            bounds.forEach((b) => {
                positionAttrs.forEach((attr) => {
                    b.removeAttribute(attr);
                });
            });
        }

        // XML 직렬화
        const serializer = new XMLSerializer();
        let normalized = serializer.serializeToString(doc);

        // 공백 정규화 (태그 사이의 들여쓰기/줄바꿈만 제거한다)
        // 주의: 전역 `\s+ -> ' '` 치환은 uengine:Properties json 속성값처럼
        // 여러 줄로 된 지침(instruction) 텍스트 내부 공백까지 뭉개어 실제 편집을
        // "변경 없음"으로 오판하게 만들므로 사용하지 않는다.
        normalized = normalized.replace(/>\s+</g, '><').trim();

        return normalized;
    } catch (error) {
        console.warn('XML 정규화 실패:', error);
        return xml;
    }
}

/**
 * XML 해시 생성
 */
export function hashXML(xml: string, ignorePositions = false): string {
    const normalized = normalizeXML(xml, ignorePositions);
    return cyrb53(normalized);
}

/**
 * 두 XML 간의 실질적인 변경 여부 확인
 * @param oldXml 이전 XML
 * @param newXml 새 XML
 * @param ignorePositions 위치 변경만 있는 경우 무시할지 여부
 */
export function hasSubstantialChanges(oldXml: string, newXml: string, ignorePositions = false): boolean {
    if (!oldXml && !newXml) return false;
    if (!oldXml || !newXml) return true;

    const oldHash = hashXML(oldXml, ignorePositions);
    const newHash = hashXML(newXml, ignorePositions);

    return oldHash !== newHash;
}

/**
 * 해싱에서 제외할 휘발성/구조성 키
 * - 위치/레이아웃 좌표: 실제 편집이 아니므로 무시
 * - 타임스탬프류: 저장할 때마다 바뀌므로 무시
 */
const VOLATILE_STATE_KEYS = new Set(['x', 'y', 'width', 'height', 'bounds', 'date', 'savedAt', 'updatedAt', 'createdAt']);

/**
 * 키 순서에 무관한 안정적 직렬화 (해시 입력을 결정적으로 만들기 위함)
 * - 객체 키를 정렬한다
 * - 휘발성 키, `_`/`$` 접두 내부 키는 제외한다
 * - 순환 참조는 안전하게 처리한다
 */
function stableStringify(value: any, seen: WeakSet<object> = new WeakSet()): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'function') return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);

    if (seen.has(value)) return '"[circular]"';
    seen.add(value);

    if (Array.isArray(value)) {
        return '[' + value.map((v) => stableStringify(v, seen)).join(',') + ']';
    }

    const keys = Object.keys(value)
        .filter((k) => !VOLATILE_STATE_KEYS.has(k) && !k.startsWith('_') && !k.startsWith('$'))
        .sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k], seen)).join(',') + '}';
}

/**
 * 임의의 상태 객체를 해시로 변환 (XML 밖에 존재하는 편집 상태 비교용)
 */
export function hashState(state: any): string {
    try {
        return cyrb53(stableStringify(state));
    } catch (e) {
        console.warn('상태 해시 실패:', e);
        return '';
    }
}

/**
 * 복합 변경 시그니처 생성
 * BPMN XML(구조/도형/uengine:Properties)뿐 아니라, XML 왕복 밖에 존재하는
 * 편집 상태(폼 초안, DMN 규칙, 프로세스 변수, 활동 메타데이터 등)까지 포함해
 * "편집 UI에서 바꿀 수 있는 모든 것"을 변경 감지 대상으로 삼는다.
 *
 * @param xml        모델러가 내보낸 BPMN XML
 * @param extraState XML 에 직렬화되지 않는 편집 상태 스냅샷
 */
export function buildChangeSignature(xml: string, extraState: any): string {
    return hashXML(xml) + '|' + hashState(extraState);
}

/**
 * BPMN 요소 수 비교 (빠른 변경 감지용)
 */
export function getElementCounts(xml: string): Record<string, number> {
    const counts: Record<string, number> = {};

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');

        const elements = doc.querySelectorAll('*');
        elements.forEach((el) => {
            const tagName = el.tagName;
            counts[tagName] = (counts[tagName] || 0) + 1;
        });
    } catch (error) {
        console.warn('요소 카운트 실패:', error);
    }

    return counts;
}

/**
 * 빠른 변경 감지 (요소 수 기반)
 * 정확한 비교 전 빠른 사전 검사용
 */
export function quickChangeCheck(oldXml: string, newXml: string): boolean {
    const oldCounts = getElementCounts(oldXml);
    const newCounts = getElementCounts(newXml);

    const allTags = new Set([...Object.keys(oldCounts), ...Object.keys(newCounts)]);

    for (const tag of allTags) {
        if ((oldCounts[tag] || 0) !== (newCounts[tag] || 0)) {
            return true;
        }
    }

    return false;
}
