/**
 * 프로세스 단계(0~4단계) 공통 정의 + 매핑 유틸.
 *
 * 체계도(useProcessArchitecture.loadProcessStatuses) 의 status 도출 로직을 기준으로
 * 대시보드 / 리뷰보드 / 체계도 세 곳에서 동일하게 사용한다.
 */

import { reactive } from 'vue';
import { DEFAULT_STAGE_TERMS, hexToRgbTriplet } from '@/utils/tenantCustomizationCore';

export type Stage = 'draft' | 'in_review' | 'public_feedback' | 'final_edit' | 'published';
export type ProcessStatus = Stage | 'none' | 'wip' | 'sunset';

export interface StageDef {
    stage: Stage;
    /** 0~4 */
    order: number;
    /** 단계 표기 라벨 (대시보드 카운터·도트용) */
    label: string;
    /** 짧은 한글 라벨 (칩·툴팁용) */
    shortLabel: string;
    /** css hex */
    color: string;
    /** vuetify color name — v-chip / v-btn color prop 용 */
    vuetifyColor: string;
    /** mdi icon name */
    icon: string;
    /** 대시보드 stage-box CSS class */
    cls: string;
}

export const STAGE_DEFS: readonly StageDef[] = [
    reactive({
        stage: 'draft',
        order: 0,
        label: '0단계',
        shortLabel: '초안',
        color: '#94a3b8',
        vuetifyColor: 'grey',
        icon: 'mdi-pencil-outline',
        cls: 'stage-slate'
    }),
    reactive({
        stage: 'in_review',
        order: 1,
        label: '1단계',
        shortLabel: '검토',
        color: '#3B82F6',
        vuetifyColor: 'blue',
        icon: 'mdi-eye-outline',
        cls: 'stage-blue'
    }),
    reactive({
        stage: 'public_feedback',
        order: 2,
        label: '2단계',
        shortLabel: '공람',
        color: '#8B5CF6',
        vuetifyColor: 'purple',
        icon: 'mdi-bullhorn-outline',
        cls: 'stage-violet'
    }),
    reactive({
        stage: 'final_edit',
        order: 3,
        label: '3단계',
        shortLabel: '최종수정',
        color: '#F59E0B',
        vuetifyColor: 'amber',
        icon: 'mdi-file-edit-outline',
        cls: 'stage-amber'
    }),
    reactive({
        stage: 'published',
        order: 4,
        label: '4단계',
        shortLabel: '배포완료',
        color: '#10B981',
        vuetifyColor: 'success',
        icon: 'mdi-check-circle',
        cls: 'stage-emerald'
    })
];

/** 기본 라벨·색 — 테넌트 오버라이드 해제 시 되돌릴 원본 (tenantCustomizationCore 와 같은 값) */
const STAGE_BASE: Record<Stage, { label: string; shortLabel: string; color: string; vuetifyColor: string }> = {
    draft: { label: '0단계', shortLabel: '초안', color: '#94a3b8', vuetifyColor: 'grey' },
    in_review: { label: '1단계', shortLabel: '검토', color: '#3B82F6', vuetifyColor: 'blue' },
    public_feedback: { label: '2단계', shortLabel: '공람', color: '#8B5CF6', vuetifyColor: 'purple' },
    final_edit: { label: '3단계', shortLabel: '최종수정', color: '#F59E0B', vuetifyColor: 'amber' },
    published: { label: '4단계', shortLabel: '배포완료', color: '#10B981', vuetifyColor: 'success' }
};

export type ExtraStatus = 'wip' | 'sunset';

export interface ExtraStatusDef {
    status: ExtraStatus;
    label: string;
    color: string;
    icon: string;
}

/**
 * 5단계 밖의 두 상태(차세대 기획 중 / 폐기 예정).
 * 예전에는 ProgressBadge 와 체계도 CSS 에 각각 hex 가 박혀 있었다 — 여기 한 곳으로 모은다.
 */
export const EXTRA_STATUS_DEFS: Record<ExtraStatus, ExtraStatusDef> = {
    wip: reactive({ status: 'wip', label: DEFAULT_STAGE_TERMS.wip.label, color: DEFAULT_STAGE_TERMS.wip.color, icon: 'mdi-pencil-ruler' }),
    sunset: reactive({ status: 'sunset', label: DEFAULT_STAGE_TERMS.sunset.label, color: DEFAULT_STAGE_TERMS.sunset.color, icon: 'mdi-archive-arrow-down-outline' })
};

export function getExtraStatusDef(status: ExtraStatus): ExtraStatusDef {
    return EXTRA_STATUS_DEFS[status];
}

export interface StageTermOverride {
    label?: string;
    shortLabel?: string;
    color?: string;
}

/**
 * 테넌트 용어 설정을 공유 단계 정의에 반영한다(reactive 라 템플릿은 즉시 갱신).
 * 색을 바꾸면 vuetifyColor 도 hex 로 바꿔 v-chip/v-btn 이 같은 색을 쓰게 한다.
 * 값이 기본과 같으면 원본으로 되돌린다(설정 초기화 대응).
 */
export function applyStageTermOverrides(terms: Partial<Record<Stage | ExtraStatus, StageTermOverride>>) {
    for (const def of STAGE_DEFS) {
        const base = STAGE_BASE[def.stage];
        const next = terms?.[def.stage] || {};
        def.label = next.label || base.label;
        def.shortLabel = next.shortLabel || base.shortLabel;
        const color = next.color || base.color;
        def.color = color;
        def.vuetifyColor = color.toLowerCase() === base.color.toLowerCase() ? base.vuetifyColor : color;
    }
    for (const status of ['wip', 'sunset'] as ExtraStatus[]) {
        const def = EXTRA_STATUS_DEFS[status];
        const next = terms?.[status] || {};
        def.label = next.label || DEFAULT_STAGE_TERMS[status].label;
        def.color = next.color || DEFAULT_STAGE_TERMS[status].color;
    }
    applyStageCssVariables();
}

/**
 * 단계 색을 :root CSS 변수로 내보낸다.
 * ExecutiveSummary(.stage-*)와 체계도(.sub-node--*)의 CSS 가 이 변수를 읽으므로
 * TS hex / CSS 두 곳에 색을 따로 정의하지 않는다.
 *   --pal-stage-<stage>      : hex
 *   --pal-stage-<stage>-rgb  : "r, g, b" (rgba() 용)
 */
export function applyStageCssVariables() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement.style;
    const set = (name: string, color: string) => {
        root.setProperty(`--pal-stage-${name}`, color);
        root.setProperty(`--pal-stage-${name}-rgb`, hexToRgbTriplet(color));
    };
    for (const def of STAGE_DEFS) set(def.stage.replace(/_/g, '-'), def.color);
    set('wip', EXTRA_STATUS_DEFS.wip.color);
    set('sunset', EXTRA_STATUS_DEFS.sunset.color);
}

export function getStageDef(stage: Stage): StageDef {
    return STAGE_DEFS.find((s) => s.stage === stage)!;
}

/**
 * DB state 문자열 → 5단계 매핑.
 * 5단계 외 상태 (rejected, archived, cancelled, reopen_requested 등) 는 'none' 으로 반환.
 */
export function mapStateToStage(state: string | null | undefined): Stage | 'none' {
    const s = String(state || '').toLowerCase();
    if (s === 'draft') return 'draft';
    if (s === 'in_review' || s === 'review') return 'in_review';
    if (s === 'public_feedback' || s === 'public_review') return 'public_feedback';
    if (s === 'final_edit') return 'final_edit';
    if (s === 'published' || s === 'confirmed') return 'published';
    return 'none';
}

/**
 * 체계도(useProcessArchitecture.loadProcessStatuses) 와 동일한 상태 도출 로직.
 * proc_def + proc_def_approval_state + proc_def_version 정보를 받아서
 * 5단계 또는 'wip'/'sunset'/'none' 으로 반환한다.
 */
export interface DeriveStatusInput {
    /** proc_def_approval_state.state — 최신 row */
    approvalStateName?: string | null;
    /** proc_def.approval_state 또는 proc_def.status — 'wip', 'sunset' 등 직접 설정 상태 */
    directStatus?: string | null;
    /** proc_def_version.version_tag — 'major' 일 경우 published 로 간주 */
    versionTag?: string | null;
    /** proc_def_version 에 row 가 존재하는지 */
    hasVersion: boolean;
}

export function deriveStatus(input: DeriveStatusInput): ProcessStatus {
    const approvalStateName = String(input.approvalStateName || '').toLowerCase();
    const directStatus = String(input.directStatus || '').toLowerCase();
    const versionTag = String(input.versionTag || '').toLowerCase();
    const lifecycleState = approvalStateName || directStatus;

    if (directStatus === 'wip') return 'wip';
    if (directStatus === 'sunset') return 'sunset';

    if (lifecycleState === 'public_feedback' || lifecycleState === 'public_review') return 'public_feedback';
    if (lifecycleState === 'in_review' || lifecycleState === 'review') return 'in_review';
    if (lifecycleState === 'final_edit') return 'final_edit';
    if (lifecycleState === 'published' || lifecycleState === 'confirmed') return 'published';
    if (versionTag === 'major' || versionTag === 'published') return 'published';

    return input.hasVersion ? 'draft' : 'none';
}

/**
 * 빈 단계 카운터 객체 생성. count++ 용도.
 */
export function emptyStageCounts(): Record<Stage, number> {
    return { draft: 0, in_review: 0, public_feedback: 0, final_edit: 0, published: 0 };
}

/**
 * 체계도 procMap(getProcessDefinitionMap 결과) 의 sub_proc_list 안에 등록된
 * 모든 proc_def id 집합을 수집한다. "전체 프로세스" 모집단 정의로 사용.
 *
 * 대시보드 / 리뷰보드 / 체계도 모두 이 함수를 통해 동일한 모집단을 본다.
 */
export function collectHierarchyProcIds(procMap: any): Set<string> {
    const ids = new Set<string>();
    if (procMap?.mega_proc_list) {
        for (const mega of procMap.mega_proc_list) {
            for (const major of mega.major_proc_list || []) {
                for (const sub of major.sub_proc_list || []) {
                    if (sub?.id) ids.add(sub.id);
                }
            }
        }
    }
    return ids;
}

/**
 * proc_def 가 "프로세스 모듈"(BPMN Call Activity 서브프로세스) 인지 판별.
 *
 * 모듈은 생성 시 definition.type === 'call-activity-sub' 로 마킹되며, 원칙적으로
 * 체계도(sub_proc_list)에 등록하지 않는다(ProcessHierarchy / NewProcessDialog 모두
 * proc_map 등록을 스킵). 다만 일반 프로세스로 등록된 뒤 모듈로 전환되는 등의 경우
 * sub_proc_list 에 남아있을 수 있어, 카운트 모집단에서 타입 기준으로 제외하기 위해 사용.
 */
export function isCallActivitySubModule(def: any): boolean {
    if (!def) return false;
    const topLevelType = String(def.type ?? '').trim();
    if (topLevelType === 'call-activity-sub') return true;

    const raw = def.definition;
    let type = '';
    if (raw && typeof raw === 'object') {
        type = String(raw.type ?? '');
    } else if (typeof raw === 'string') {
        try {
            type = String(JSON.parse(raw)?.type ?? '');
        } catch {
            // JSONB 가 비정상 문자열인 경우 마커 포함 여부로 폴백
            return raw.includes('call-activity-sub');
        }
    }
    return type === 'call-activity-sub';
}

/**
 * proc_def 가 "프로세스 템플릿" 인지 판별.
 *
 * 템플릿은 definition.type === 'template' 로 마킹된다(모듈 마커와 동일 규약 —
 * type 컬럼은 duplicateLocalProcess 등이 'bpmn' 으로 덮어쓸 수 있어 definition 이 정본).
 * 모듈(call-activity-sub)은 type 슬롯을 모듈 마커가 이미 쓰고 있으므로
 * definition.isTemplate === true 불리언 플래그로 마킹한다 (두 마커 공존 가능).
 * 프로세스 목록의 템플릿 지정/필터와 새 프로세스 등록의 '템플릿' 생성 방식이 이 마커를 사용한다.
 */
export function isTemplateDefinition(def: any): boolean {
    if (!def) return false;
    if (String(def.type ?? '').trim() === 'template') return true;
    if (def.isTemplate === true) return true;

    const raw = def.definition;
    let type = '';
    let flag = false;
    if (raw && typeof raw === 'object') {
        type = String(raw.type ?? '');
        flag = raw.isTemplate === true;
    } else if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            type = String(parsed?.type ?? '');
            flag = parsed?.isTemplate === true;
        } catch {
            return false;
        }
    }
    return type === 'template' || flag;
}

/**
 * proc_def 목록에서 "프로세스 모듈"(call-activity-sub) id 집합을 수집한다.
 * 체계도 모집단(collectHierarchyProcIds)에서 차감해 리뷰보드/대시보드/체계도
 * 카운트에서 모듈을 제외하는 용도. (모듈이 모집단에 없으면 차감은 no-op)
 */
export function collectModuleProcIds(defs: any[]): Set<string> {
    const ids = new Set<string>();
    for (const def of defs || []) {
        if (def?.id && isCallActivitySubModule(def)) ids.add(def.id);
    }
    return ids;
}
