/**
 * BPMN 모델 검증 Service
 *
 * 백엔드 validate-bpmn-model 엔드포인트의 전송(transport) 계층.
 *
 * - 검증 버튼: validateBpmnModel({ bpmnXml }) → 3개 카테고리(BPMN_GLOBAL /
 *   SKT_BPMN_GUIDE / REQUIRED_PROPERTIES) 리포트
 * - publish precheck: precheckBpmnPublish(procDefId, tenantId)
 *   → targetStatus="published" 로 호출. 검증 error가 있으면 서버가 HTTP 422
 *   (detail=리포트, publish_blocked=true)를 반환하며, 이 경우에도 리포트를
 *   정상 반환값으로 돌려주므로 호출 측은 canPublish 플래그만 보면 된다.
 *
 * 참고: ../playground-pi-system-backend/docs/bpmn-validation-api-spec.md
 */

// 배포 환경에서는 /pi-system-backend prefix 뒤로 라우팅된다.
// (Vite dev 프록시도 /pi-system-backend/ 를 동일 백엔드로 전달 후 prefix 제거)
const API_BASE_URL = '/pi-system-backend';
const TIMEOUT_MS = 30_000;

export type BpmnValidationCategory = 'BPMN_GLOBAL' | 'SKT_BPMN_GUIDE' | 'REQUIRED_PROPERTIES';

export interface BpmnValidationIssue {
    category: BpmnValidationCategory | string;
    severity: 'error' | 'warning' | string;
    rule_id: string;
    message: string;
    element_id: string | null;
    element_name: string | null;
    element_type: string | null;
}

export interface BpmnValidationCheck {
    category: BpmnValidationCategory | string;
    title: string;
    status: 'clear' | 'failed' | string;
    error_count: number;
    warning_count: number;
    issues: BpmnValidationIssue[];
}

export interface BpmnValidationReport {
    valid: boolean;
    can_publish: boolean;
    publish_blocked: boolean;
    target_status: string | null;
    source?: Record<string, any>;
    guideline_source?: Record<string, any>;
    summary: {
        status: string;
        total: number;
        errors: number;
        warnings: number;
        categories: Record<string, { status: string; errors: number; warnings: number }>;
    };
    checks: BpmnValidationCheck[];
    issues: BpmnValidationIssue[];
}

export interface BpmnValidationRequestPayload {
    /** 현재 캔버스의 BPMN XML (검증 버튼 용) */
    bpmnXml?: string;
    /** 편집 중인 definition JSON */
    processDefinition?: Record<string, any>;
    /** 저장된 proc_def 검증 (publish precheck 용) */
    procDefId?: string;
    tenantId?: string;
    /** "published" 면 publish precheck 로 동작 */
    targetStatus?: 'published';
}

/** 검증 콘솔/다이얼로그 공용 아이템 형식 (기존 로컬 검증 결과와 동일 shape) */
export interface BpmnValidationConsoleItem {
    level: 'error' | 'warning';
    message: string;
    elementId: string | null;
    elementName: string | null;
    category: string;
    ruleId: string;
}

/** 서버가 내려주는 한국어 detail 메시지를 그대로 담는 에러 */
export class BpmnValidationError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = 'BpmnValidationError';
        this.status = status;
    }
}

export const BPMN_VALIDATION_CATEGORY_LABELS: Record<string, string> = {
    BPMN_GLOBAL: 'BPMN 문법',
    SKT_BPMN_GUIDE: 'SKT 가이드',
    REQUIRED_PROPERTIES: '속성필수값'
};

function isValidationReport(value: any): value is BpmnValidationReport {
    return !!value && typeof value === 'object' && Array.isArray(value.issues) && 'can_publish' in value;
}

/**
 * BPMN 모델 검증 호출.
 * publish precheck(422) 응답도 리포트로 정상 반환한다. 그 외 오류는 throw.
 */
export async function validateBpmnModel(
    payload: BpmnValidationRequestPayload,
    externalSignal?: AbortSignal
): Promise<BpmnValidationReport> {
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(`${API_BASE_URL}/langchain-chat/validate-bpmn-model`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const body = await res.json().catch(() => null);
        if (res.ok && isValidationReport(body)) {
            return body;
        }
        // publish precheck 차단: 422 + detail = 리포트
        if (res.status === 422 && isValidationReport(body?.detail)) {
            return body.detail;
        }
        const message = typeof body?.detail === 'string' ? body.detail : `BPMN 검증 호출 실패 (${res.status})`;
        throw new BpmnValidationError(res.status, message);
    } finally {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', onExternalAbort);
    }
}

export interface BpmnPublishPrecheckResult {
    canPublish: boolean;
    report: BpmnValidationReport;
}

/**
 * publish 전 검증 (저장된 proc_def 기준).
 * 검증 error가 하나라도 있으면 canPublish=false.
 */
export async function precheckBpmnPublish(procDefId: string, tenantId?: string): Promise<BpmnPublishPrecheckResult> {
    const report = await validateBpmnModel({
        procDefId,
        tenantId,
        targetStatus: 'published'
    });
    return { canPublish: !!report.can_publish, report };
}

/** 리포트 issue 목록 → 검증 콘솔/다이얼로그 아이템 (카테고리 라벨 prefix 포함) */
export function reportToConsoleItems(report: BpmnValidationReport | null | undefined): BpmnValidationConsoleItem[] {
    if (!report || !Array.isArray(report.issues)) return [];
    return report.issues.map((issue) => ({
        level: issue.severity === 'error' ? 'error' : 'warning',
        message: `[${BPMN_VALIDATION_CATEGORY_LABELS[issue.category] || issue.category}] ${issue.message}`,
        elementId: issue.element_id || null,
        elementName: issue.element_name || null,
        category: issue.category,
        ruleId: issue.rule_id
    }));
}

/** publish 차단 사유를 사용자 메시지로 요약 */
export function summarizeBlockingIssues(report: BpmnValidationReport | null | undefined, maxItems = 5): string {
    const errors = (report?.issues || []).filter((issue) => issue.severity === 'error');
    if (errors.length === 0) return '';
    const lines = errors.slice(0, maxItems).map((issue) => {
        const label = BPMN_VALIDATION_CATEGORY_LABELS[issue.category] || issue.category;
        const target = issue.element_name || issue.element_id;
        return `- [${label}] ${issue.message}${target ? ` (${target})` : ''}`;
    });
    if (errors.length > maxItems) {
        lines.push(`- 외 ${errors.length - maxItems}건`);
    }
    return lines.join('\n');
}
