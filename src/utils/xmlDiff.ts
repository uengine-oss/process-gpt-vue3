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
            allElements.forEach(el => {
                positionAttrs.forEach(attr => {
                    el.removeAttribute(attr);
                });
            });

            // waypoint 요소 제거
            const waypoints = doc.querySelectorAll('di\\:waypoint, waypoint');
            waypoints.forEach(wp => wp.remove());

            // Bounds 요소의 위치 속성 제거
            const bounds = doc.querySelectorAll('dc\\:Bounds, Bounds');
            bounds.forEach(b => {
                positionAttrs.forEach(attr => {
                    b.removeAttribute(attr);
                });
            });
        }

        // XML 직렬화
        const serializer = new XMLSerializer();
        let normalized = serializer.serializeToString(doc);

        // 공백 정규화
        normalized = normalized
            .replace(/>\s+</g, '><')
            .replace(/\s+/g, ' ')
            .trim();

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
export function hasSubstantialChanges(
    oldXml: string,
    newXml: string,
    ignorePositions = false
): boolean {
    if (!oldXml && !newXml) return false;
    if (!oldXml || !newXml) return true;

    const oldHash = hashXML(oldXml, ignorePositions);
    const newHash = hashXML(newXml, ignorePositions);

    return oldHash !== newHash;
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
        elements.forEach(el => {
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
