export interface PropertySchemaVisibilityState {
    deleted_at?: unknown;
    is_active?: boolean;
    visible_by_default?: boolean;
}

/** 속성 패널에 실제 입력 필드로 노출할 수 있는 스키마인지 판정한다. */
export const isPropertySchemaVisibleInPanel = (schema: PropertySchemaVisibilityState): boolean => {
    if (schema.deleted_at) return false;
    if (schema.is_active === false) return false;
    return schema.visible_by_default !== false;
};
