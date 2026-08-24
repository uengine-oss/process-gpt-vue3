/**
 * TMF MCP(사내 TM Forum 지식베이스) 그라운딩 유틸.
 *
 * 백엔드 /tmf-kb/search 를 호출해 eTOM L3·TMF Open API·기타 표준 검색 결과(Context)를
 * LLM 프롬프트에 넣을 텍스트 블록으로 만든다. 판단(분류/매핑)은 LLM 자체 지식이 아니라
 * 이 공식 검색 결과를 최우선 근거로 하도록 프롬프트에서 지시한다.
 *
 * 백엔드에 TMF_MCP_TOKEN 이 없거나(503) 검색이 실패하면 빈 문자열을 반환해
 * 호출부가 기존(LLM 자체 판단) 동작을 그대로 유지하게 한다.
 */

export type TmfKbCategory = 'etom' | 'tmf_api' | 'standard';

export interface TmfKbSearchResult {
    tool?: string;
    category?: string;
    text?: string;
}

export interface TmfKbSearchResponse {
    query?: string;
    results?: TmfKbSearchResult[];
    tools_used?: string[];
    warnings?: string[];
}

export interface TmfKbBackend {
    tmfKbSearch?: (payload: { query: string; categories?: TmfKbCategory[]; topK?: number }) => Promise<TmfKbSearchResponse>;
}

const DEFAULT_MAX_CHARS = 4000;

/** 검색 결과 목록을 프롬프트용 텍스트 블록으로 변환한다(빈 결과는 ''). */
export function formatTmfKbResults(results: TmfKbSearchResult[] | undefined, maxChars = DEFAULT_MAX_CHARS): string {
    const blocks = (Array.isArray(results) ? results : [])
        .map((r) => {
            const text = String(r?.text || '').trim();
            if (!text) return '';
            return `[${String(r?.category || 'tmf')}] (${String(r?.tool || 'mcp')})\n${text}`;
        })
        .filter(Boolean);
    let joined = blocks.join('\n\n');
    if (joined.length > maxChars) {
        joined = joined.slice(0, maxChars - 3) + '...';
    }
    return joined;
}

/**
 * TMF MCP 검색 결과 컨텍스트를 가져온다. 미지원 백엔드·오류·빈 결과 모두 '' 반환(폴백 안전).
 */
export async function fetchTmfKbContext(
    backend: TmfKbBackend | null | undefined,
    query: string,
    opts: { categories?: TmfKbCategory[]; topK?: number; maxChars?: number } = {}
): Promise<string> {
    if (!backend || typeof backend.tmfKbSearch !== 'function') return '';
    const trimmed = String(query || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
    if (!trimmed) return '';
    try {
        const response = await backend.tmfKbSearch({
            query: trimmed,
            categories: opts.categories,
            topK: opts.topK
        });
        return formatTmfKbResults(response?.results, opts.maxChars ?? DEFAULT_MAX_CHARS);
    } catch {
        // 백엔드 미설정(503)·네트워크 오류 → 그라운딩 없이 진행
        return '';
    }
}
