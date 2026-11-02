<template>
    <!-- 알림(되돌리기)이 떠 있는 동안은 알림을 누른 것을 바깥 클릭으로 보고 닫지 않게 한다 -->
    <v-dialog :model-value="modelValue" max-width="860px" scrollable :persistent="toast.open" @update:model-value="$emit('update:modelValue', $event)">
        <v-card data-test="skill-only-tools-dialog">
            <v-card-title class="pa-4 pb-2 d-flex align-center ga-2">
                <v-icon size="20">mdi-lock-outline</v-icon>
                <span>스킬 전용 도구</span>
                <v-tooltip location="bottom" max-width="360">
                    <template #activator="{ props }">
                        <v-icon v-bind="props" size="16" class="text-medium-emphasis" data-test="help">mdi-help-circle-outline</v-icon>
                    </template>
                    {{ COPY.adminHelp }}
                </v-tooltip>
                <v-spacer />
                <v-btn icon variant="text" size="small" aria-label="닫기" @click="$emit('update:modelValue', false)">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <div class="px-4 pb-2 d-flex align-center flex-wrap ga-2">
                <v-chip-group v-model="filter" mandatory selected-class="text-primary" data-test="filters">
                    <v-chip v-for="f in ADMIN_FILTERS" :key="f.value" :value="f.value" size="small" variant="outlined" :data-filter="f.value">
                        {{ f.label }} <span class="ml-1 text-medium-emphasis">{{ counts[f.value] }}</span>
                    </v-chip>
                </v-chip-group>
                <v-spacer />
                <v-select
                    v-model="skill"
                    :items="boundSkills"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                    placeholder="모든 스킬"
                    prepend-inner-icon="mdi-lightning-bolt-outline"
                    class="flex-0"
                    style="width: 220px"
                    data-test="skill-filter"
                />
                <v-text-field
                    v-model="query"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                    placeholder="도구 찾기"
                    prepend-inner-icon="mdi-magnify"
                    style="width: 180px"
                    class="flex-0"
                />
            </div>

            <!-- 고른 도구에 할 일 -->
            <div v-if="selected.length" class="px-4 pb-2 d-flex align-center ga-2 select-bar" data-test="select-bar">
                <span class="text-body-2">{{ selected.length }}개 선택</span>
                <v-btn size="small" variant="flat" color="primary" :disabled="!selectedToDesignate.length" data-test="designate-selected" @click="askDesignate(selectedToDesignate)">
                    <v-icon start size="16">mdi-lock</v-icon>지정 {{ selectedToDesignate.length || '' }}
                </v-btn>
                <v-btn size="small" variant="tonal" :disabled="!selectedToRelease.length" data-test="release-selected" @click="askRelease(selectedToRelease)">
                    <v-icon start size="16">mdi-lock-open-variant-outline</v-icon>해제 {{ selectedToRelease.length || '' }}
                </v-btn>
                <v-menu location="bottom start">
                    <template #activator="{ props }">
                        <v-btn v-bind="props" size="small" variant="tonal" :disabled="!skills.length" data-test="connect-selected">
                            <v-icon start size="16">mdi-link-variant</v-icon>스킬에 연결
                        </v-btn>
                    </template>
                    <v-list density="compact" max-height="320">
                        <v-list-item v-for="s in skills" :key="s" :title="s" prepend-icon="mdi-lightning-bolt-outline" :data-connect-skill="s" @click="goConnect(s, selected)" />
                    </v-list>
                </v-menu>
                <v-btn size="small" variant="text" @click="selected = []">선택 취소</v-btn>
            </div>

            <v-card-text class="pa-0">
                <v-alert v-if="loadError" type="error" density="compact" variant="tonal" class="ma-4 text-caption">
                    도구 목록을 불러오지 못했습니다: {{ loadError }}
                </v-alert>
                <div v-else-if="loading" class="pa-6 d-flex justify-center"><v-progress-circular indeterminate size="24" width="2" /></div>
                <v-table v-else density="compact" fixed-header height="420" class="tool-table" data-test="tool-table">
                    <thead>
                        <tr>
                            <th class="col-check">
                                <v-checkbox-btn
                                    :model-value="allSelected"
                                    :indeterminate="selected.length > 0 && !allSelected"
                                    :disabled="!visibleRows.length"
                                    density="compact"
                                    aria-label="모두 선택"
                                    @update:model-value="toggleAll"
                                />
                            </th>
                            <th>도구</th>
                            <th>연결된 스킬</th>
                            <th class="col-status">상태</th>
                            <th class="col-menu"></th>
                        </tr>
                    </thead>
                    <tbody v-for="group in visibleGroups" :key="group.key" :data-group="group.key">
                        <!-- 출처 묶음 머리: 딥 에이전트 서비스 도구 / MCP 서버별 -->
                        <tr class="group-row" :data-group-head="group.key">
                            <td class="col-check">
                                <v-checkbox-btn
                                    :model-value="groupSelected(group)"
                                    :indeterminate="groupPartly(group)"
                                    density="compact"
                                    :aria-label="`${group.label} 모두 선택`"
                                    @update:model-value="toggleGroup(group, $event)"
                                />
                            </td>
                            <td colspan="4">
                                <button type="button" class="group-toggle d-inline-flex align-center ga-1" :data-group-toggle="group.key" @click="toggleCollapse(group.key)">
                                    <v-icon size="16">{{ collapsed.includes(group.key) ? 'mdi-chevron-right' : 'mdi-chevron-down' }}</v-icon>
                                    <v-icon size="18" :color="group.kind === 'service' ? 'primary' : undefined" :data-source-icon="group.kind">{{ group.icon }}</v-icon>
                                    <span class="text-body-2 font-weight-medium">{{ group.label }}</span>
                                    <span class="text-caption text-medium-emphasis">{{ group.items.length }}</span>
                                    <v-tooltip activator="parent" location="top start" :text="group.hint" />
                                </button>
                            </td>
                        </tr>
                        <tr
                            v-for="row in collapsed.includes(group.key) ? [] : group.items"
                            :key="row.name"
                            :data-row="row.name"
                            :data-kind="row.kind"
                            :data-source="group.kind"
                        >
                            <td class="col-check"><v-checkbox-btn v-model="selected" :value="row.name" density="compact" /></td>
                            <td class="pl-8">
                                <v-tooltip location="top start" max-width="420" :disabled="!row.description">
                                    <template #activator="{ props }">
                                        <code v-bind="props" class="text-body-2">{{ row.name }}</code>
                                    </template>
                                    {{ oneLine(row.description, 200) }}
                                </v-tooltip>
                            </td>
                            <td class="text-caption">
                                <span v-if="row.skills.length">{{ row.skills.join(', ') }}</span>
                                <span v-else class="text-disabled">—</span>
                            </td>
                            <td class="col-status">
                                <v-tooltip location="top" :text="statusText(row)">
                                    <template #activator="{ props }">
                                        <span v-bind="props" class="d-inline-flex align-center ga-1 text-caption" :class="`text-${STATUS[row.kind].color}`">
                                            <v-icon size="16">{{ STATUS[row.kind].icon }}</v-icon>{{ STATUS[row.kind].label }}
                                        </span>
                                    </template>
                                </v-tooltip>
                            </td>
                            <td class="col-menu">
                                <v-menu location="bottom end">
                                    <template #activator="{ props }">
                                        <v-btn v-bind="props" icon variant="text" size="x-small" :data-menu="row.name" aria-label="동작">
                                            <v-icon>mdi-dots-vertical</v-icon>
                                        </v-btn>
                                    </template>
                                    <v-list density="compact" max-height="320">
                                        <v-list-item v-if="!row.designated" prepend-icon="mdi-lock" title="지정" :data-designate="row.name" @click="askDesignate([row.name])" />
                                        <v-list-item v-else prepend-icon="mdi-lock-open-variant-outline" title="지정 해제" :data-release="row.name" @click="askRelease([row.name])" />
                                        <template v-if="row.kind !== 'missing' && connectable(row).length">
                                            <v-list-subheader>스킬에 연결</v-list-subheader>
                                            <v-list-item v-for="s in connectable(row)" :key="s" :title="s" prepend-icon="mdi-link-variant" @click="goConnect(s, row.name)" />
                                        </template>
                                    </v-list>
                                </v-menu>
                            </td>
                        </tr>
                    </tbody>
                    <tbody v-if="!visibleRows.length">
                        <tr>
                            <td colspan="5" class="text-center text-caption text-medium-emphasis py-6">해당하는 도구가 없습니다</td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card-text>
        </v-card>

        <!-- 결과 확인 -->
        <v-dialog v-model="confirm.open" max-width="520px">
            <v-card data-test="admin-confirm">
                <v-card-title class="pa-4 pb-0 text-subtitle-1">{{ confirm.title }}</v-card-title>
                <v-card-text class="pa-4 text-body-2">
                    <p v-for="line in confirm.lines" :key="line" class="mb-2">{{ line }}</p>
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn variant="text" @click="confirm.open = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" data-test="admin-confirm-ok" :loading="saving" @click="confirmOk">
                        {{ confirm.okLabel }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-snackbar v-model="toast.open" :timeout="12000" :color="toast.error ? 'error' : undefined" data-test="admin-toast">
            {{ toast.text }}
            <template #actions>
                <v-btn v-if="toast.undo" variant="text" data-test="undo" @click="undo">되돌리기</v-btn>
            </template>
        </v-snackbar>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { COPY, toolStatus, oneLine, groupBySkills, adminRows, filterAdminRows, groupBySource, ADMIN_FILTERS } from '@/utils/skillToolBinding';

const MAX_LINES = 6;

// 상태 칸: 아이콘 + 짧은 라벨(자세한 문구는 툴팁)
const STATUS = {
    'after-skill': { icon: 'mdi-lock', label: '스킬 전용', color: 'primary' },
    undesignated: { icon: 'mdi-lock-open-variant-outline', label: '지정 안 됨', color: 'medium-emphasis' },
    // 연결도 지정도 없는 도구 — "지정 안 됨" 보기(연결됐지만 지정 안 된 도구)와 같은 말을 쓰면 보기 숫자와 어긋난다.
    free: { icon: 'mdi-earth', label: '모든 대화', color: 'medium-emphasis' },
    unusable: { icon: 'mdi-lock-alert-outline', label: '사용 불가', color: 'warning' },
    missing: { icon: 'mdi-help-circle-outline', label: '목록에 없음', color: 'medium-emphasis' }
};

/**
 * 관리자 현황 — 도구 표 한 장(보기·스킬·검색으로 거르고, 체크해서 지정·해제). 글 설명은 도움말 툴팁에만 둔다.
 * 변경은 동작마다 바꾼 도구만(PATCH) 저장하고, 결과가 큰 동작은 확인받으며, 알림에서 되돌릴 수 있다.
 * 서버가 관리자인지 확인한다(이 창을 여는 버튼의 관리자 판정은 표시용).
 */
export default {
    name: 'SkillOnlyToolsDialog',
    props: {
        modelValue: { type: Boolean, default: false },
        // "스킬에 연결" 대상으로 고를 수 있는 스킬 이름
        skills: { type: Array, default: () => [] },
        // 스킬 목록의 "지정 안 됨" 배지로 열었으면 그 스킬의 지정 안 된 도구로 거른다
        focusSkill: { type: String, default: '' }
    },
    emits: ['update:modelValue', 'saved'],
    data() {
        return {
            COPY,
            STATUS,
            ADMIN_FILTERS,
            loading: false,
            loadError: '',
            saving: false,
            catalog: { tools: [], missing_skill_only_tools: [] },
            bindings: {},
            skillOnly: [],
            filter: 'all',
            skill: null,
            query: '',
            selected: [],
            // 접은 출처 묶음
            collapsed: [],
            confirm: { open: false, title: '', lines: [], okLabel: '확인', onOk: null },
            toast: { open: false, text: '', undo: null, error: false }
        };
    },
    computed: {
        rows() {
            return adminRows(this.catalog.tools, this.bindings, this.skillOnly);
        },
        counts() {
            const out = {};
            for (const f of ADMIN_FILTERS) out[f.value] = filterAdminRows(this.rows, { filter: f.value, skill: this.skill || '' }).length;
            return out;
        },
        visibleRows() {
            return filterAdminRows(this.rows, { filter: this.filter, skill: this.skill || '', query: this.query });
        },
        visibleGroups() {
            return groupBySource(this.visibleRows);
        },
        boundSkills() {
            return [...new Set(this.rows.flatMap((r) => r.skills))].sort();
        },
        allSelected() {
            return this.visibleRows.length > 0 && this.visibleRows.every((r) => this.selected.includes(r.name));
        },
        selectedRows() {
            return this.rows.filter((r) => this.selected.includes(r.name));
        },
        selectedToDesignate() {
            return this.selectedRows.filter((r) => !r.designated).map((r) => r.name);
        },
        selectedToRelease() {
            return this.selectedRows.filter((r) => r.designated).map((r) => r.name);
        }
    },
    watch: {
        modelValue(open) {
            if (open) this.load();
        },
        filter() {
            this.selected = [];
        },
        skill() {
            this.selected = [];
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
    },
    mounted() {
        if (this.modelValue) this.load();
    },
    methods: {
        oneLine,
        async load() {
            this.loading = true;
            this.loadError = '';
            this.selected = [];
            this.query = '';
            this.skill = this.focusSkill || null;
            try {
                const [catalog, bindings, skillOnly] = await Promise.all([
                    this.backend.getSkillToolCatalog(),
                    this.backend.getSkillToolBindings().catch(() => ({ bindings: {} })),
                    this.backend.getSkillOnlyTools()
                ]);
                this.catalog = catalog || { tools: [] };
                this.bindings = (bindings && bindings.bindings) || {};
                this.skillOnly = (skillOnly && skillOnly.tools) || [];
            } catch (err) {
                this.loadError = err?.error || err?.response?.data?.error || err?.message || String(err);
            } finally {
                this.loading = false;
            }
            this.filter = this.defaultFilter();
        },
        /** 배지로 열었으면 지정 안 됨, 아니면 지정된 도구부터(없으면 지정 안 됨, 그것도 없으면 전체). */
        defaultFilter() {
            if (this.focusSkill) return 'undesignated';
            const has = (f) => filterAdminRows(this.rows, { filter: f }).length;
            return has('designated') ? 'designated' : has('undesignated') ? 'undesignated' : 'all';
        },
        statusText(row) {
            if (row.kind === 'missing') return '지금 도구 목록에 없는 지정입니다';
            return this.statusOf(row.name).label;
        },
        connectable(row) {
            return this.skills.filter((s) => !row.skills.includes(s));
        },
        groupSelected(group) {
            return group.items.length > 0 && group.items.every((r) => this.selected.includes(r.name));
        },
        groupPartly(group) {
            return !this.groupSelected(group) && group.items.some((r) => this.selected.includes(r.name));
        },
        toggleGroup(group, on) {
            const names = group.items.map((r) => r.name);
            this.selected = on ? [...new Set([...this.selected, ...names])] : this.selected.filter((n) => !names.includes(n));
        },
        toggleCollapse(key) {
            this.collapsed = this.collapsed.includes(key) ? this.collapsed.filter((k) => k !== key) : [...this.collapsed, key];
        },
        toggleAll(on) {
            const names = this.visibleRows.map((r) => r.name);
            this.selected = on ? [...new Set([...this.selected, ...names])] : this.selected.filter((n) => !names.includes(n));
        },
        statusOf(name) {
            return toolStatus(name, this.skillOnly, this.bindings);
        },
        summarize(names, fn) {
            const groups = groupBySkills(names, this.bindings);
            const lines = groups.slice(0, MAX_LINES).map((g) => fn(g.tools, g.skills));
            if (groups.length > MAX_LINES) lines.push(`그 밖의 도구 ${groups.slice(MAX_LINES).reduce((n, g) => n + g.tools.length, 0)}개도 같습니다.`);
            return lines;
        },
        askDesignate(names) {
            this.confirm = {
                open: true,
                title: names.length > 1 ? `도구 ${names.length}개를 스킬 전용으로 지정` : '스킬 전용으로 지정',
                lines: this.summarize(names, COPY.designateGroup),
                okLabel: '지정',
                onOk: () => this.apply({ add: names }, names.length > 1 ? `도구 ${names.length}개를 지정했습니다.` : `${names[0]} 을 지정했습니다.`)
            };
        },
        askRelease(names) {
            this.confirm = {
                open: true,
                title: '스킬 전용 지정 해제',
                lines: this.summarize(names, COPY.releaseGroup),
                okLabel: '해제',
                onOk: () => this.apply({ remove: names }, names.length > 1 ? `도구 ${names.length}개의 지정을 해제했습니다.` : `${names[0]} 의 지정을 해제했습니다.`)
            };
        },
        async confirmOk() {
            const fn = this.confirm.onOk;
            if (fn) await fn();
            this.confirm.open = false;
        },
        /** 바꾼 도구만 보내고, 알림에 반대 동작(되돌리기)을 둔다. */
        async apply(change, message, isUndo = false) {
            this.saving = true;
            try {
                const res = await this.backend.patchSkillOnlyTools(change);
                this.skillOnly = (res && res.tools) || this.skillOnly;
                this.selected = this.selected.filter((n) => ![...(change.add || []), ...(change.remove || [])].includes(n));
                const inverse = { add: change.remove || [], remove: change.add || [] };
                this.toast = { open: true, text: message, error: false, undo: isUndo ? null : inverse };
                this.$emit('saved', this.skillOnly);
            } catch (err) {
                const forbidden = err?.response?.status === 403 || /관리자/.test(err?.error || '');
                this.toast = { open: true, text: forbidden ? COPY.forbidden : err?.error || err?.message || String(err), error: true, undo: null };
                await this.load();
            } finally {
                this.saving = false;
            }
        },
        undo() {
            const change = this.toast.undo;
            // 알림을 바로 닫으면 같은 클릭의 바깥 클릭 처리 때 persistent 가 풀려 현황 창까지 닫힌다.
            setTimeout(() => {
                this.toast.open = false;
            });
            if (change) this.apply(change, '되돌렸습니다.', true);
        },
        goConnect(skill, tools) {
            this.$emit('update:modelValue', false);
            const addTool = [].concat(tools).join(',');
            this.$router.push({ path: `/skills/${encodeURIComponent(skill)}`, query: { addTool } });
        }
    }
};
</script>

<style scoped>
.tool-table th {
    font-size: 12px;
    font-weight: 600;
}
.col-check {
    width: 40px;
    padding-right: 0 !important;
}
.col-status {
    width: 120px;
    white-space: nowrap;
}
.col-menu {
    width: 40px;
}
.group-row td {
    background: rgba(var(--v-theme-on-surface), 0.04);
}
.group-toggle {
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    color: inherit;
}
.select-bar {
    min-height: 36px;
}
.flex-0 {
    flex: 0 0 auto;
}
</style>
