import { expect, test } from '@playwright/test';
import { isPropertySchemaVisibleInPanel } from '../../../src/utils/propertySchemaVisibility.js';

test.describe('프로세스 순서도 속성 패널 스키마 노출', () => {
    test('활성 상태이고 표시 설정된 스키마만 노출한다', () => {
        expect(isPropertySchemaVisibleInPanel({ is_active: true, visible_by_default: true })).toBe(true);
        expect(isPropertySchemaVisibleInPanel({ is_active: false, visible_by_default: true })).toBe(false);
        expect(isPropertySchemaVisibleInPanel({ is_active: true, visible_by_default: false })).toBe(false);
        expect(isPropertySchemaVisibleInPanel({ deleted_at: '2026-09-01T00:00:00Z' })).toBe(false);
    });

    test('상태 필드가 없는 기존 스키마는 이전처럼 노출한다', () => {
        expect(isPropertySchemaVisibleInPanel({})).toBe(true);
        expect(isPropertySchemaVisibleInPanel({ deleted_at: null })).toBe(true);
    });
});
