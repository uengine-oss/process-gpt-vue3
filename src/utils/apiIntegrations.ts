/**
 * 태스크 API 연동 속성(uengine:properties json) 공용 헬퍼.
 *
 * 저장 포맷: props.apiIntegrations = [{ name, method, url, params: [{key, value}] }, ...]
 * 레거시 포맷(단일: apiName/apiMethod/apiUrl/apiParams)은 읽기 시 1개 항목으로 승격하고,
 * 쓰기 시 첫 항목을 레거시 키에 미러링해 구버전 판독기와의 호환을 유지한다.
 */

export interface ApiIntegrationParam {
    key: string;
    value: string;
}

export interface ApiIntegration {
    name: string;
    method: string;
    url: string;
    params: ApiIntegrationParam[];
}

const toText = (v: unknown): string => (v == null ? '' : String(v));

/** 원시 객체(신형 항목 또는 레거시 필드 묶음)를 ApiIntegration 으로 정규화. 내용이 전혀 없으면 null. */
export function normalizeApiIntegration(raw: unknown): ApiIntegration | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const name = toText(r.name ?? r.apiName).trim();
    const method = toText(r.method ?? r.apiMethod).trim();
    const url = toText(r.url ?? r.apiUrl).trim();
    const rawParams = r.params ?? r.apiParams;
    const params = (Array.isArray(rawParams) ? rawParams : [])
        .map((p) => ({ key: toText((p as any)?.key).trim(), value: toText((p as any)?.value).trim() }))
        .filter((p) => p.key);
    if (!name && !method && !url && params.length === 0) return null;
    return { name, method, url, params };
}

/** uengine props 에서 API 연동 목록을 읽는다 — apiIntegrations 배열 우선, 없으면 레거시 단일 필드 폴백. */
export function readApiIntegrations(props: unknown): ApiIntegration[] {
    if (!props || typeof props !== 'object') return [];
    const p = props as Record<string, unknown>;
    if (Array.isArray(p.apiIntegrations)) {
        return p.apiIntegrations.map(normalizeApiIntegration).filter(Boolean) as ApiIntegration[];
    }
    const legacy = normalizeApiIntegration({
        name: p.apiName,
        method: p.apiMethod,
        url: p.apiUrl,
        params: p.apiParams
    });
    return legacy ? [legacy] : [];
}

/**
 * API 연동 목록을 uengine props 에 기록한다(제자리 수정 후 동일 객체 반환).
 * 레거시 단일 필드는 첫 항목을 미러링하고, 목록이 비면 신·구 키 모두 제거한다.
 */
export function applyApiIntegrations(props: Record<string, unknown>, list: ApiIntegration[]): Record<string, unknown> {
    const clean = (Array.isArray(list) ? list : []).map(normalizeApiIntegration).filter(Boolean) as ApiIntegration[];
    if (clean.length) {
        props.apiIntegrations = clean.map((a) => ({
            name: a.name,
            method: a.method,
            url: a.url,
            params: a.params.map((p) => ({ ...p }))
        }));
        const first = clean[0];
        props.apiName = first.name;
        props.apiMethod = first.method;
        props.apiUrl = first.url;
        props.apiParams = first.params.map((p) => ({ ...p }));
    } else {
        delete props.apiIntegrations;
        delete props.apiName;
        delete props.apiMethod;
        delete props.apiUrl;
        delete props.apiParams;
    }
    return props;
}

/**
 * TMF Open API 코드들을 API 연동 항목으로 병합한다(이름 기준 idempotent — 이미 있으면 건너뜀).
 * 추가된 항목 수를 반환한다.
 */
export function mergeTmfApiIntegrations(props: Record<string, unknown>, codes: string[]): number {
    const list = readApiIntegrations(props);
    const seen = new Set(list.map((a) => a.name.trim().toLowerCase()).filter(Boolean));
    let added = 0;
    for (const raw of Array.isArray(codes) ? codes : []) {
        const code = toText(raw).trim();
        if (!code) continue;
        const key = code.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ name: code, method: '', url: '', params: [] });
        added++;
    }
    if (added) applyApiIntegrations(props, list);
    return added;
}
