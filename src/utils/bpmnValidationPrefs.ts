/** 저장 시 자동 BPMN 검증 여부 (ProcessDefinitionChatHeader 토글과 동기화) */
export const AUTO_BPMN_VALIDATION_STORAGE_KEY = 'processDefinition.autoBpmnValidation';

export function readAutoBpmnValidation(): boolean {
    if (typeof localStorage === 'undefined') return true;
    const v = localStorage.getItem(AUTO_BPMN_VALIDATION_STORAGE_KEY);
    if (v === null) return true;
    return v !== 'false';
}

export function writeAutoBpmnValidation(enabled: boolean): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(AUTO_BPMN_VALIDATION_STORAGE_KEY, enabled ? 'true' : 'false');
}
