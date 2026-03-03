/**
 * 용어 자동완성 컴포저블
 * BPMN 요소 이름 입력 시 표준 용어 제안
 */

import { ref, computed } from 'vue';

// 용어 카테고리 타입
export type TermCategory = 'task_name' | 'lane_name' | 'gateway_name' | 'event_name' | 'condition';

// 용어 아이템 인터페이스
export interface TerminologyItem {
    id: string;
    term: string;
    description?: string;
    usage_count: number;
}

// 캐시 (메모리)
const terminologyCache = new Map<string, TerminologyItem[]>();
const cacheExpiry = new Map<string, number>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

export function useTerminology() {
    const loading = ref(false);
    const error = ref<string | null>(null);

    /**
     * Supabase에서 용어 목록 로드
     */
    async function loadTerminology(category: TermCategory): Promise<TerminologyItem[]> {
        const tenantId = window.$tenantName || 'default';
        const cacheKey = `${tenantId}:${category}`;

        // 캐시 확인
        const cachedExpiry = cacheExpiry.get(cacheKey);
        if (cachedExpiry && cachedExpiry > Date.now()) {
            const cached = terminologyCache.get(cacheKey);
            if (cached) return cached;
        }

        loading.value = true;
        error.value = null;

        try {
            const supabase = window.$supabase;
            if (!supabase) {
                throw new Error('Supabase not initialized');
            }

            // 테넌트별 + default 용어 조회 (usage_count 내림차순)
            const { data, error: dbError } = await supabase
                .from('standard_terminology')
                .select('id, term, description, usage_count')
                .eq('category', category)
                .in('tenant_id', [tenantId, 'default'])
                .order('usage_count', { ascending: false })
                .limit(100);

            if (dbError) {
                console.warn('용어 로드 실패:', dbError);
                // 테이블이 없는 경우 빈 배열 반환
                return [];
            }

            const items: TerminologyItem[] = data || [];

            // 캐시 저장
            terminologyCache.set(cacheKey, items);
            cacheExpiry.set(cacheKey, Date.now() + CACHE_TTL);

            return items;
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Unknown error';
            console.warn('용어 로드 오류:', e);
            return [];
        } finally {
            loading.value = false;
        }
    }

    /**
     * 입력값으로 용어 필터링
     */
    function filterTerms(terms: TerminologyItem[], input: string): string[] {
        if (!input || input.trim() === '') {
            // 입력값이 없으면 상위 10개 반환
            return terms.slice(0, 10).map(t => t.term);
        }

        const loweredInput = input.toLowerCase();
        return terms
            .filter(t => t.term.toLowerCase().includes(loweredInput))
            .slice(0, 10)
            .map(t => t.term);
    }

    /**
     * 용어 사용 기록 (학습)
     */
    async function recordUsage(category: TermCategory, term: string): Promise<void> {
        const tenantId = window.$tenantName || 'default';

        try {
            const supabase = window.$supabase;
            if (!supabase) return;

            // RPC 호출로 사용 횟수 증가
            await supabase.rpc('increment_terminology_usage', {
                p_tenant_id: tenantId,
                p_category: category,
                p_term: term
            });

            // 캐시 무효화
            const cacheKey = `${tenantId}:${category}`;
            cacheExpiry.delete(cacheKey);
        } catch (e) {
            console.warn('용어 사용 기록 실패:', e);
        }
    }

    /**
     * 새 용어 추가
     */
    async function addTerm(category: TermCategory, term: string, description?: string): Promise<boolean> {
        const tenantId = window.$tenantName || 'default';

        try {
            const supabase = window.$supabase;
            if (!supabase) return false;

            const { error: dbError } = await supabase
                .from('standard_terminology')
                .upsert({
                    tenant_id: tenantId,
                    category,
                    term,
                    description,
                    usage_count: 1
                }, {
                    onConflict: 'tenant_id,category,term'
                });

            if (dbError) {
                console.warn('용어 추가 실패:', dbError);
                return false;
            }

            // 캐시 무효화
            const cacheKey = `${tenantId}:${category}`;
            cacheExpiry.delete(cacheKey);

            return true;
        } catch (e) {
            console.warn('용어 추가 오류:', e);
            return false;
        }
    }

    /**
     * 카테고리별 용어 목록 (computed)
     */
    function useTermsForCategory(category: TermCategory) {
        const terms = ref<TerminologyItem[]>([]);
        const suggestions = ref<string[]>([]);
        const searchInput = ref('');

        // 초기 로드
        loadTerminology(category).then(items => {
            terms.value = items;
        });

        // 검색어 기반 제안
        const updateSuggestions = () => {
            suggestions.value = filterTerms(terms.value, searchInput.value);
        };

        return {
            terms,
            suggestions,
            searchInput,
            updateSuggestions,
            recordUsage: (term: string) => recordUsage(category, term),
            addTerm: (term: string, desc?: string) => addTerm(category, term, desc),
            refresh: () => loadTerminology(category).then(items => { terms.value = items; })
        };
    }

    return {
        loading,
        error,
        loadTerminology,
        filterTerms,
        recordUsage,
        addTerm,
        useTermsForCategory
    };
}

// 기본 내보내기
export default useTerminology;
