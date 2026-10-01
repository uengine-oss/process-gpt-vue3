import { defineStore } from 'pinia';
import BackendFactory from '@/components/api/BackendFactory';
import { writeActivityLog } from '@/services/activityAuditLog';
import { groupGlossaryTerms as groupTerms, pickReusableTerms } from '@/utils/glossary';

/**
 * 용어 정의 사전 (glossary_terms)
 * - 프로세스별 용어 정의(속성패널 Process 탭의 "용어 정의" 섹션)
 * - 테넌트 통합 용어 사전 페이지(용어별로 어떤 프로세스에서 어떻게 쓰이는지)
 * - 용어 재사용: 등록 시 기존 용어 자동완성·정의 프리필의 데이터 소스
 */
export interface GlossaryTerm {
    id: string;
    proc_def_id: string;
    proc_def_name?: string;
    term: string;
    definition?: string;
    display_order?: number;
    updated_at?: string;
}

/** 통합 사전 뷰 — 같은 용어(trim, 대소문자 무시)를 묶은 그룹 */
export interface GlossaryTermGroup {
    key: string;
    term: string;
    usages: GlossaryTerm[];
}

export function groupGlossaryTerms(terms: GlossaryTerm[]): GlossaryTermGroup[] {
    return groupTerms(terms) as GlossaryTermGroup[];
}

export const useGlossaryStore = defineStore({
    id: 'glossary',
    state: () => ({
        // 테넌트 전체 용어 (통합 사전·재사용 자동완성용)
        allTerms: [] as GlossaryTerm[],
        allTermsLoaded: false,
        loading: false,
        error: null as string | null
    }),

    actions: {
        async loadAllTerms(force = false) {
            if (this.allTermsLoaded && !force) return;
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                if (typeof backend.getGlossaryTerms !== 'function') {
                    this.allTerms = [];
                    this.allTermsLoaded = true;
                    return;
                }
                this.allTerms = (await backend.getGlossaryTerms()) || [];
                this.allTermsLoaded = true;
            } catch (error: any) {
                console.error('Failed to load glossary terms:', error);
                this.error = error.message;
            } finally {
                this.loading = false;
            }
        },

        async saveTerm(term: Partial<GlossaryTerm>) {
            const backend = BackendFactory.createBackend();
            // 저장 전 기존 여부 확인 — 활동 로그의 신규/수정 구분용 (upsert라 저장 결과로는 알 수 없다)
            const previous = term.id ? this.allTerms.find((t) => t.id === term.id) : undefined;
            const saved = await backend.saveGlossaryTerm!(term);
            const index = this.allTerms.findIndex((t) => t.id === saved.id);
            if (index !== -1) this.allTerms[index] = saved;
            else this.allTerms.push(saved);
            // 활동 로그 (PAL 전용, 실패 무시)
            writeActivityLog({
                action: previous ? 'glossary_term_update' : 'glossary_term_create',
                target_type: 'glossary_term',
                target_id: saved.id,
                target_name: saved.term,
                before_value: previous ? { ...previous } : undefined,
                after_value: { ...saved }
            });
            return saved;
        },

        async deleteTerm(id: string) {
            const backend = BackendFactory.createBackend();
            const previous = this.allTerms.find((t) => t.id === id);
            await backend.deleteGlossaryTerm!(id);
            this.allTerms = this.allTerms.filter((t) => t.id !== id);
            // 활동 로그 (PAL 전용, 실패 무시)
            writeActivityLog({
                action: 'glossary_term_delete',
                target_type: 'glossary_term',
                target_id: id,
                target_name: previous?.term,
                before_value: previous ? { ...previous } : undefined
            });
        },

        reset() {
            this.allTerms = [];
            this.allTermsLoaded = false;
            this.loading = false;
            this.error = null;
        }
    },

    getters: {
        // 특정 프로세스의 용어 목록 (등록 순서 유지)
        termsByProcess: (state) => (procDefId: string) => {
            return state.allTerms
                .filter((t) => t.proc_def_id === procDefId)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.term.localeCompare(b.term));
        },

        // 통합 사전 뷰 — 용어별 사용처 그룹
        groupedTerms: (state): GlossaryTermGroup[] => groupGlossaryTerms(state.allTerms),

        // 재사용 자동완성 후보: 용어별 대표 1건 (가장 최근 갱신 행의 정의를 프리필로 쓴다)
        reusableTerms: (state): GlossaryTerm[] => pickReusableTerms(state.allTerms) as GlossaryTerm[]
    }
});
