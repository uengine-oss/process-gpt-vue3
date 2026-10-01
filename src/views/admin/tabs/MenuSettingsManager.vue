<template>
    <v-card flat class="sk-page-card">
        <!-- ───────────── 페이지 헤더 ───────────── -->
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">메뉴 관리</h1>
                <p class="page-subtitle">테넌트별 메뉴 표시(숨김·이름·순서)와 메뉴별 최소 접근 역할을 설정합니다.</p>
            </div>
        </div>

        <v-card-text class="pa-4 pt-2 sk-page-card-text">
            <v-alert type="info" variant="tonal" density="compact" class="mb-4" icon="mdi-information-outline">
                숨김은 사이드바 <strong>표시 설정</strong>일 뿐 권한 축소가 아닙니다. URL 직접 접근은 필요 역할 검사에 따릅니다.
                필요 역할을 기본값과 다르게 저장하면 조정 이력(menu_role_overrides)으로 기록되고, 기본값으로 되돌리면 이력이 삭제됩니다.
            </v-alert>

            <div v-if="loading" class="text-center pa-8">
                <v-progress-circular indeterminate size="24" color="primary" />
            </div>

            <div v-else class="list-scroll">
                <div v-for="section in sections" :key="section.key" class="section-block">
                    <div class="section-title">{{ section.label }}</div>
                    <table class="menu-table">
                        <thead>
                            <tr>
                                <th style="width: 70px">순서</th>
                                <th>메뉴명</th>
                                <th>경로</th>
                                <th style="width: 90px">표시</th>
                                <th style="width: 160px">필요 역할</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(row, index) in section.rows" :key="row.path" :class="{ 'row-hidden': row.hidden }">
                                <td>
                                    <div class="order-btns">
                                        <button class="option-move-btn" :disabled="index === 0 || savingSettings" @click="moveRow(section, index, -1)">
                                            <v-icon size="14">mdi-arrow-up</v-icon>
                                        </button>
                                        <button
                                            class="option-move-btn"
                                            :disabled="index === section.rows.length - 1 || savingSettings"
                                            @click="moveRow(section, index, 1)"
                                        >
                                            <v-icon size="14">mdi-arrow-down</v-icon>
                                        </button>
                                    </div>
                                </td>
                                <td>
                                    <div v-if="editingLabelPath === row.path" class="label-edit-row">
                                        <input
                                            v-model="editingLabelValue"
                                            class="form-input label-input"
                                            :placeholder="row.defaultLabel"
                                            @keyup.enter="saveLabel(row)"
                                            @keyup.esc="cancelLabelEdit"
                                        />
                                        <v-btn icon="mdi-check" size="x-small" variant="text" color="primary" :loading="savingSettings" @click="saveLabel(row)" />
                                        <v-btn icon="mdi-close" size="x-small" variant="text" @click="cancelLabelEdit" />
                                    </div>
                                    <div v-else class="label-cell">
                                        <span class="menu-label">{{ row.label || row.defaultLabel }}</span>
                                        <span v-if="row.label" class="default-label-hint" :title="`기본 이름: ${row.defaultLabel}`">({{ row.defaultLabel }})</span>
                                        <v-btn icon="mdi-pencil" size="x-small" variant="text" class="label-edit-btn" @click="startLabelEdit(row)" />
                                    </div>
                                </td>
                                <td><code class="menu-path">{{ row.path }}</code></td>
                                <td>
                                    <v-tooltip :disabled="!isSelfMenu(row)" text="메뉴 관리 화면은 숨길 수 없습니다." location="bottom">
                                        <template #activator="{ props: tipProps }">
                                            <span v-bind="tipProps">
                                                <v-switch
                                                    :model-value="!row.hidden"
                                                    color="primary"
                                                    density="compact"
                                                    hide-details
                                                    :disabled="isSelfMenu(row) || savingSettings"
                                                    @update:model-value="(v) => toggleHidden(row, v)"
                                                />
                                            </span>
                                        </template>
                                    </v-tooltip>
                                </td>
                                <td>
                                    <v-select
                                        :model-value="row.role"
                                        :items="roleOptions"
                                        item-title="label"
                                        item-value="value"
                                        density="compact"
                                        variant="outlined"
                                        hide-details
                                        @update:model-value="(v) => requestRoleChange(row, v)"
                                    >
                                        <template #append-inner>
                                            <v-tooltip v-if="row.overridden" text="기본값에서 조정됨" location="bottom">
                                                <template #activator="{ props: tipProps }">
                                                    <v-icon v-bind="tipProps" size="14" color="warning">mdi-circle-medium</v-icon>
                                                </template>
                                            </v-tooltip>
                                        </template>
                                    </v-select>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- ───────────── 사용자 정의 메뉴 ───────────── -->
                <div class="section-block">
                    <div class="section-title d-flex align-center">
                        사용자 정의 메뉴
                        <v-spacer />
                        <v-btn size="x-small" variant="tonal" color="primary" prepend-icon="mdi-plus" :disabled="savingSettings" @click="openCustomDialog()">
                            메뉴 추가
                        </v-btn>
                    </div>
                    <p class="custom-hint">
                        코드에 메뉴가 없는 화면(예: <code>/merge-requests</code>, <code>/my-inbox</code>)이나 외부 URL 을 사이드바에 올립니다.
                        최소 역할은 <strong>표시 조건</strong>일 뿐이며, 내부 경로의 접근 권한은 기존 검사에 따릅니다.
                    </p>
                    <table class="menu-table">
                        <thead>
                            <tr>
                                <th>메뉴명</th>
                                <th>대상</th>
                                <th style="width: 120px">섹션</th>
                                <th style="width: 120px">최소 역할</th>
                                <th style="width: 100px"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in customItems" :key="item.id">
                                <td>
                                    <span class="menu-label">{{ item.label }}</span>
                                    <v-icon v-if="item.external" size="14" class="ml-1" color="grey">mdi-open-in-new</v-icon>
                                </td>
                                <td><code class="menu-path">{{ item.target }}</code></td>
                                <td>{{ sectionLabel(item.section) }}</td>
                                <td>{{ item.requiredRole ? roleLabel(item.requiredRole) : '전체' }}</td>
                                <td class="text-right">
                                    <v-btn icon="mdi-pencil" size="x-small" variant="text" :disabled="savingSettings" @click="openCustomDialog(item)" />
                                    <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" :disabled="savingSettings" @click="removeCustomItem(item)" />
                                </td>
                            </tr>
                            <tr v-if="customItems.length === 0">
                                <td colspan="5" class="text-medium-emphasis">추가된 사용자 정의 메뉴가 없습니다.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </v-card-text>

        <!-- ───────────── 사용자 정의 메뉴 추가/수정 ───────────── -->
        <v-dialog v-model="customDialog.open" max-width="520" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pt-5 px-6">{{ customDialog.id ? '사용자 정의 메뉴 수정' : '사용자 정의 메뉴 추가' }}</v-card-title>
                <v-card-text class="px-6 pb-2">
                    <v-text-field v-model="customDialog.label" label="메뉴명" variant="outlined" density="compact" class="mb-2" maxlength="60" />
                    <v-text-field
                        v-model="customDialog.target"
                        label="대상 (내부 경로 또는 URL)"
                        placeholder="/merge-requests 또는 https://…"
                        variant="outlined"
                        density="compact"
                        class="mb-2"
                        :error-messages="customDialog.error ? [customDialog.error] : []"
                    />
                    <v-select v-model="customDialog.section" :items="sectionOptions" item-title="label" item-value="value" label="섹션" variant="outlined" density="compact" class="mb-2" />
                    <v-select
                        v-model="customDialog.requiredRole"
                        :items="[{ value: '', label: '전체 (제한 없음)' }, ...roleOptions]"
                        item-title="label"
                        item-value="value"
                        label="사이드바 표시 최소 역할"
                        variant="outlined"
                        density="compact"
                        class="mb-2"
                    />
                    <v-text-field v-model="customDialog.icon" label="아이콘 (선택, 사이드바 아이콘 키)" placeholder="예: document, browser, flag" variant="outlined" density="compact" />
                    <p class="text-caption text-medium-emphasis mb-0">외부 URL(http/https)은 새 탭으로 열립니다.</p>
                </v-card-text>
                <v-card-actions class="px-6 pb-5">
                    <v-spacer />
                    <v-btn variant="text" @click="customDialog.open = false">취소</v-btn>
                    <v-btn color="primary" variant="tonal" :loading="savingSettings" :disabled="!customDialog.label.trim() || !customDialog.target.trim()" @click="saveCustomItem">저장</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- ───────────── 필요 역할 변경 확인 (매뉴얼 19장 5.2절) ───────────── -->
        <v-dialog v-model="roleConfirm.open" max-width="460" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pt-5 px-6">메뉴 권한 변경 확인</v-card-title>
                <v-card-text class="px-6 pb-2">
                    <p class="mb-3">
                        <strong>{{ roleConfirm.menuLabel }}</strong> 메뉴의 최소 접근 역할을 변경합니다.
                    </p>
                    <div class="role-confirm-grid">
                        <span class="role-confirm-key">기본 권한</span>
                        <span>{{ roleLabel(roleConfirm.defaultRole) }}</span>
                        <span class="role-confirm-key">변경 전</span>
                        <span>{{ roleLabel(roleConfirm.fromRole) }}</span>
                        <span class="role-confirm-key">변경 후</span>
                        <span class="font-weight-bold">{{ roleLabel(roleConfirm.toRole) }}</span>
                    </div>
                    <p class="text-caption text-medium-emphasis mt-3 mb-0">
                        역할을 낮추면 더 많은 사용자가 접근할 수 있고, 높이면 접근 가능한 사용자가 줄어듭니다.
                        {{ roleConfirm.toRole === roleConfirm.defaultRole ? '기본값으로 되돌리면 조정 이력이 삭제됩니다.' : '' }}
                    </p>
                </v-card-text>
                <v-card-actions class="px-6 pb-5">
                    <v-spacer />
                    <v-btn variant="text" @click="cancelRoleChange">취소</v-btn>
                    <v-btn color="primary" variant="tonal" :loading="savingRole" @click="confirmRoleChange">변경</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';
import { MENU_DEFINITIONS, SECTION_LABELS } from '@/utils/routePermissions';
import { ROLE_HIERARCHY, ROLE_META } from '@/utils/roles';
import { getMenuOverride, loadMenuRoleOverrides, upsertMenuRoleOverride, deleteMenuRoleOverride } from '@/utils/menuRoleOverrides';
import { loadMenuSettings, saveMenuSettings, CUSTOM_MENU_SECTION_LABELS, CUSTOM_MENU_SECTIONS } from '@/services/menuSettingsService';
import { isExternalMenuTarget } from '@/utils/tenantCustomizationCore';
import { useAdminConsoleStore } from '@/stores/adminConsole';

const SELF_PATH = '/admin-console/menu-settings';
const SECTION_ORDER = ['process', 'analytics', 'admin', 'notice', 'request'];

export default defineComponent({
    name: 'MenuSettingsManager',

    setup() {
        const adminStore = useAdminConsoleStore();
        const loading = ref(true);
        const savingSettings = ref(false);
        const savingRole = ref(false);
        const sections = ref([]);
        const menuSettings = ref({ items: {}, customItems: [] });

        const editingLabelPath = ref(null);
        const editingLabelValue = ref('');

        const roleConfirm = ref({
            open: false,
            path: '',
            menuLabel: '',
            defaultRole: 'admin',
            fromRole: 'admin',
            toRole: 'admin'
        });

        const roleOptions = ROLE_HIERARCHY.map((role) => ({ value: role, label: `${ROLE_META[role].label} (${role})` }));
        const roleLabel = (role) => (role && ROLE_META[role] ? `${ROLE_META[role].label} (${role})` : role || '-');

        const isSelfMenu = (row) => row.path === SELF_PATH;

        // ---- 사용자 정의 메뉴 ----
        const customItems = computed(() => menuSettings.value.customItems || []);
        const sectionOptions = CUSTOM_MENU_SECTIONS.map((value) => ({ value, label: CUSTOM_MENU_SECTION_LABELS[value] }));
        const sectionLabel = (section) => CUSTOM_MENU_SECTION_LABELS[section] || section;
        const customDialog = ref({ open: false, id: '', label: '', target: '', section: 'process', requiredRole: '', icon: '', error: '' });

        const openCustomDialog = (item) => {
            customDialog.value = {
                open: true,
                id: item?.id || '',
                label: item?.label || '',
                target: item?.target || '',
                section: item?.section || 'process',
                requiredRole: item?.requiredRole || '',
                icon: item?.icon || '',
                error: ''
            };
        };

        const saveCustomItem = async () => {
            const d = customDialog.value;
            const target = String(d.target || '').trim();
            if (!isExternalMenuTarget(target) && !target.startsWith('/')) {
                d.error = "내부 경로는 '/' 로 시작하고, 외부 주소는 http(s):// 로 시작해야 합니다.";
                return;
            }
            const existing = customItems.value;
            const before = existing.find((it) => it.id === d.id) || null;
            const next = {
                id: d.id || `cm-${Date.now().toString(36)}`,
                label: String(d.label || '').trim(),
                target,
                external: isExternalMenuTarget(target),
                section: d.section,
                icon: String(d.icon || '').trim() || undefined,
                requiredRole: d.requiredRole || undefined,
                order: before?.order
            };
            const list = before ? existing.map((it) => (it.id === before.id ? next : it)) : [...existing, next];
            menuSettings.value = { ...menuSettings.value, customItems: list };
            d.open = false;
            await persistSettings({
                targetPath: next.target,
                targetName: next.label,
                beforeValue: before ? { custom_item: before } : null,
                afterValue: { custom_item: next }
            });
        };

        const removeCustomItem = async (item) => {
            if (!window.confirm(`'${item.label}' 메뉴를 삭제할까요?`)) return;
            menuSettings.value = { ...menuSettings.value, customItems: customItems.value.filter((it) => it.id !== item.id) };
            await persistSettings({
                targetPath: item.target,
                targetName: item.label,
                beforeValue: { custom_item: item },
                afterValue: { custom_item: null }
            });
        };

        /** MENU_DEFINITIONS + 저장된 설정으로 화면 행 구성 (order 반영 정렬) */
        const buildSections = () => {
            const items = menuSettings.value.items || {};
            const bySection = new Map();

            MENU_DEFINITIONS.forEach((def, defIndex) => {
                if (!def.path || def.excludeFromMatrix) return;
                const setting = items[def.path] || {};
                const override = getMenuOverride(def.path);
                const row = {
                    path: def.path,
                    defaultLabel: def.label,
                    label: setting.label || '',
                    hidden: setting.hidden === true,
                    defaultRole: def.requiredRole,
                    role: override?.required_role || def.requiredRole,
                    overridden: !!override,
                    // order 미지정 행은 정의 순서를 유지 (지정 행이 앞으로)
                    effectiveOrder: typeof setting.order === 'number' ? setting.order : 100000 + defIndex
                };
                if (!bySection.has(def.section)) bySection.set(def.section, []);
                bySection.get(def.section).push(row);
            });

            sections.value = SECTION_ORDER.filter((key) => bySection.has(key)).map((key) => ({
                key,
                label: SECTION_LABELS[key] || key,
                rows: bySection.get(key).sort((a, b) => a.effectiveOrder - b.effectiveOrder)
            }));
        };

        const load = async () => {
            loading.value = true;
            try {
                await Promise.all([loadMenuRoleOverrides(), loadMenuSettings().then((v) => (menuSettings.value = v))]);
                buildSections();
            } catch (e) {
                console.error('[MenuSettingsManager] load error:', e);
            } finally {
                loading.value = false;
            }
        };

        /** 변경된 설정 저장 + 감사 로그. 실패 시 이전 상태로 재구성 */
        const persistSettings = async ({ targetPath, targetName, beforeValue, afterValue }) => {
            savingSettings.value = true;
            try {
                menuSettings.value = await saveMenuSettings(menuSettings.value);
                adminStore.writeAdminAuditLog({
                    action: 'menu_settings_update',
                    target_type: 'menu',
                    target_id: targetPath,
                    target_name: targetName,
                    before_value: beforeValue,
                    after_value: afterValue
                });
            } catch (e) {
                console.error('[MenuSettingsManager] save error:', e);
                await loadMenuSettings().then((v) => (menuSettings.value = v));
            } finally {
                savingSettings.value = false;
                buildSections();
            }
        };

        const updateItemSetting = (path, patch) => {
            const items = { ...(menuSettings.value.items || {}) };
            const next = { ...(items[path] || {}), ...patch };
            // 기본값과 같은 필드는 지워서 저장 항목을 최소화
            if (next.hidden !== true) delete next.hidden;
            if (!next.label) delete next.label;
            if (typeof next.order !== 'number') delete next.order;
            if (Object.keys(next).length === 0) delete items[path];
            else items[path] = next;
            menuSettings.value = { items };
        };

        // ---- 표시(숨김) ----
        const toggleHidden = (row, visible) => {
            if (isSelfMenu(row)) return;
            const before = { hidden: row.hidden };
            updateItemSetting(row.path, { hidden: !visible });
            persistSettings({
                targetPath: row.path,
                targetName: row.label || row.defaultLabel,
                beforeValue: before,
                afterValue: { hidden: !visible }
            });
        };

        // ---- 이름(라벨) ----
        const startLabelEdit = (row) => {
            editingLabelPath.value = row.path;
            editingLabelValue.value = row.label || '';
        };

        const cancelLabelEdit = () => {
            editingLabelPath.value = null;
            editingLabelValue.value = '';
        };

        const saveLabel = (row) => {
            const nextLabel = String(editingLabelValue.value || '').trim();
            cancelLabelEdit();
            if (nextLabel === (row.label || '')) return;
            const before = { label: row.label || null };
            updateItemSetting(row.path, { label: nextLabel });
            persistSettings({
                targetPath: row.path,
                targetName: nextLabel || row.defaultLabel,
                beforeValue: before,
                afterValue: { label: nextLabel || null }
            });
        };

        // ---- 순서 ----
        const moveRow = (section, index, delta) => {
            const next = index + delta;
            if (next < 0 || next >= section.rows.length) return;
            const rows = [...section.rows];
            const [moved] = rows.splice(index, 1);
            rows.splice(next, 0, moved);
            // 섹션 내 전체 행에 순서를 다시 기록해 의미를 결정적으로 유지
            rows.forEach((row, i) => updateItemSetting(row.path, { order: i }));
            persistSettings({
                targetPath: moved.path,
                targetName: moved.label || moved.defaultLabel,
                beforeValue: { order: index, section: section.key },
                afterValue: { order: next, section: section.key }
            });
        };

        // ---- 필요 역할 ----
        const requestRoleChange = (row, newRole) => {
            if (!newRole || newRole === row.role) return;
            roleConfirm.value = {
                open: true,
                path: row.path,
                menuLabel: row.label || row.defaultLabel,
                defaultRole: row.defaultRole,
                fromRole: row.role,
                toRole: newRole
            };
        };

        const cancelRoleChange = () => {
            roleConfirm.value.open = false;
            // v-select 는 model-value 바인딩이라 buildSections 재실행으로 원래 값 복원
            buildSections();
        };

        const confirmRoleChange = async () => {
            const { path, menuLabel, defaultRole, fromRole, toRole } = roleConfirm.value;
            savingRole.value = true;
            try {
                if (toRole === defaultRole) {
                    await deleteMenuRoleOverride(path);
                } else {
                    await upsertMenuRoleOverride(path, toRole, menuLabel);
                }
                adminStore.writeAdminAuditLog({
                    action: 'menu_role_override_update',
                    target_type: 'menu',
                    target_id: path,
                    target_name: menuLabel,
                    before_value: { required_role: fromRole, default_role: defaultRole },
                    after_value: { required_role: toRole, restored_default: toRole === defaultRole }
                });
                roleConfirm.value.open = false;
            } catch (e) {
                console.error('[MenuSettingsManager] role override save error:', e);
            } finally {
                savingRole.value = false;
                buildSections();
            }
        };

        onMounted(load);

        return {
            loading,
            savingSettings,
            savingRole,
            sections,
            roleOptions,
            roleLabel,
            isSelfMenu,
            editingLabelPath,
            editingLabelValue,
            startLabelEdit,
            cancelLabelEdit,
            saveLabel,
            toggleHidden,
            moveRow,
            roleConfirm,
            requestRoleChange,
            cancelRoleChange,
            confirmRoleChange,
            customItems,
            sectionOptions,
            sectionLabel,
            customDialog,
            openCustomDialog,
            saveCustomItem,
            removeCustomItem
        };
    }
});
</script>

<style scoped>
/* sk-page-card / page-header 계열은 SKGlobalStyle.scss 전역 정의 */

.list-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.section-block {
    /* flex 컬럼 안에서 기본 flex-shrink:1 이면 섹션이 눌려 표가 잘리고 스크롤이 생기지 않는다.
       자연 높이를 유지해야 .list-scroll 이 넘치는 만큼 스크롤된다. */
    flex: 0 0 auto;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 8px;
    background: rgb(var(--v-theme-surface));
    overflow: hidden;
}

.section-title {
    font-size: 13px;
    font-weight: 700;
    padding: 10px 14px;
    color: rgb(var(--v-theme-textPrimary));
    background: rgb(var(--v-theme-background));
    border-bottom: 1px solid rgb(var(--v-theme-borderColor));
}

.menu-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.menu-table th {
    text-align: left;
    font-size: 11.5px;
    font-weight: 600;
    color: rgb(var(--v-theme-textSecondary));
    padding: 8px 12px;
    border-bottom: 1px solid rgb(var(--v-theme-borderColor));
    white-space: nowrap;
}

.menu-table td {
    padding: 6px 12px;
    border-bottom: 1px solid rgb(var(--v-theme-borderColor));
    vertical-align: middle;
}

.menu-table tbody tr:last-child td {
    border-bottom: none;
}

.row-hidden {
    opacity: 0.5;
}

.order-btns {
    display: flex;
    gap: 4px;
}

.option-move-btn {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 6px;
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-textSecondary));
    cursor: pointer;
}

.option-move-btn:disabled {
    opacity: 0.35;
    cursor: default;
}

.label-cell {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
}

.menu-label {
    font-weight: 600;
    color: rgb(var(--v-theme-textPrimary));
}

.default-label-hint {
    font-size: 11px;
    color: rgb(var(--v-theme-textSecondary));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.label-edit-btn {
    opacity: 0;
    transition: opacity 0.15s ease;
}

.menu-table tr:hover .label-edit-btn {
    opacity: 1;
}

.label-edit-row {
    display: flex;
    align-items: center;
    gap: 4px;
}

.label-input {
    max-width: 220px;
}

.form-input {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 6px;
    font-size: 13px;
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-textPrimary));
    outline: none;
}

.form-input:focus {
    border-color: rgb(var(--v-theme-primary));
}

.custom-hint {
    margin: 0;
    padding: 8px 14px;
    font-size: 12px;
    line-height: 1.6;
    color: rgb(var(--v-theme-textSecondary));
}

.menu-path {
    font-size: 11.5px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgb(var(--v-theme-background));
    color: rgb(var(--v-theme-textSecondary));
}

.role-confirm-grid {
    display: grid;
    grid-template-columns: 80px 1fr;
    row-gap: 6px;
    font-size: 13px;
}

.role-confirm-key {
    color: rgb(var(--v-theme-textSecondary));
}
</style>
