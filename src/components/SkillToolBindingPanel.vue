<template>
    <div class="skill-tool-panel" data-test="skill-tool-panel">
        <div class="d-flex align-center ga-2 mb-3">
            <v-icon size="20">mdi-toolbox-outline</v-icon>
            <span class="text-subtitle-1 font-weight-medium">{{ COPY.panelTitle }}</span>
            <span class="text-medium-emphasis text-body-2">{{ connected.length }}</span>
            <v-tooltip location="bottom" max-width="340">
                <template #activator="{ props }">
                    <v-icon v-bind="props" size="16" class="text-medium-emphasis" data-test="panel-help">mdi-help-circle-outline</v-icon>
                </template>
                {{ COPY.panelHelp }}<template v-if="gitBacked"> 저장소에 연결된 스킬이라 병합된 뒤에 반영됩니다.</template>
            </v-tooltip>
            <v-spacer />
            <v-btn
                v-if="!readOnly"
                size="small"
                variant="tonal"
                color="primary"
                :disabled="loading || !!loadError || !gitReady"
                data-test="add-tool"
                @click="openPicker"
            >
                <v-icon start size="16">mdi-plus</v-icon>추가
            </v-btn>
            <v-btn icon variant="text" size="small" aria-label="닫기" data-test="panel-close" @click="$emit('close')">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </div>

        <v-alert v-if="loadError" type="error" density="compact" variant="tonal" class="mb-2 text-caption">
            도구 목록을 불러오지 못했습니다: {{ loadError }}
        </v-alert>
        <div v-else-if="loading" class="d-flex align-center ga-2 text-caption text-medium-emphasis mb-2">
            <v-progress-circular indeterminate size="16" width="2" /> 도구 목록을 불러오는 중…
        </div>

        <v-alert
            v-for="(n, i) in notices"
            :key="i"
            :type="n.type"
            density="compact"
            variant="tonal"
            closable
            class="mb-2 text-caption"
            data-test="panel-notice"
            @click:close="notices.splice(i, 1)"
        >
            {{ n.text }}
        </v-alert>

        <div v-if="!loading && !connected.length" class="text-caption text-medium-emphasis mb-1">연결된 도구가 없습니다.</div>

        <!-- 저장 전 변경: 저장해야 서버에 반영된다 -->
        <v-alert v-if="unsavedText" type="warning" density="compact" variant="tonal" class="mb-2 text-caption" data-test="unsaved-note">
            {{ unsavedText }}
        </v-alert>

        <!-- 연결만 되고 지정 안 된 도구: 한 번에 지정 -->
        <div v-if="designatable.length && isAdmin && !readOnly" class="d-flex align-center ga-2 mb-2 text-caption text-medium-emphasis" data-test="designate-all">
            <v-icon size="16">mdi-lock-open-variant-outline</v-icon>
            <span>지정 안 됨 {{ designatable.length }}</span>
            <v-spacer />
            <v-btn size="x-small" variant="tonal" color="primary" data-test="designate-all-btn" @click="requestDesignateAll">
                <v-icon start size="14">mdi-lock</v-icon>모두 지정
            </v-btn>
        </div>

        <div class="tool-list" data-test="tool-list">
            <div v-for="row in connectedRows" :key="row.name" class="tool-line" :data-connected="row.name">
                <v-tooltip location="top" :text="row.label">
                    <template #activator="{ props }">
                        <v-icon v-bind="props" size="16" :color="row.color" :class="{ 'text-medium-emphasis': !row.color }" :data-status="row.name">
                            {{ row.icon }}
                        </v-icon>
                    </template>
                </v-tooltip>
                <code class="text-body-2">{{ row.name }}</code>
                <v-chip v-if="row.pending" size="x-small" color="primary" variant="outlined">{{ row.pending }}</v-chip>
                <v-spacer />
                <v-btn
                    v-if="!readOnly"
                    icon
                    size="x-small"
                    variant="text"
                    :data-remove="row.name"
                    aria-label="빼기"
                    title="빼기"
                    @click="requestRemove(row.name)"
                >
                    <v-icon size="16">mdi-minus-circle-outline</v-icon>
                </v-btn>
            </div>
        </div>

        <v-alert v-if="hints.length" type="info" density="compact" variant="tonal" class="mt-2 text-caption" data-test="description-hint">
            모델은 설명만 보고 이 스킬을 고릅니다. 이 도구로 할 수 있는 일을 설명에 적어 주세요: <code>{{ hints.join(', ') }}</code>
        </v-alert>

        <!-- 도구 추가 -->
        <v-dialog v-model="picker" max-width="640px" scrollable>
            <v-card data-test="tool-picker">
                <v-card-title class="pa-4 pb-2">도구 추가</v-card-title>
                <v-card-text class="pa-4 pt-0">
                    <v-text-field
                        v-model="query"
                        density="compact"
                        variant="outlined"
                        hide-details
                        clearable
                        autofocus
                        placeholder="도구 이름이나 설명으로 찾기"
                        prepend-inner-icon="mdi-magnify"
                        class="mb-3"
                    />
                    <div v-for="group in pickerGroups" :key="group.key" class="mb-3">
                        <div class="text-caption font-weight-medium text-medium-emphasis mb-1">{{ group.label }}</div>
                        <div v-for="tool in group.tools" :key="tool.name" class="pick-row" :data-pick="tool.name">
                            <div class="flex-grow-1 min-w-0">
                                <div class="d-flex align-center flex-wrap ga-1">
                                    <code class="text-body-2">{{ tool.name }}</code>
                                    <v-chip size="x-small" variant="tonal" :color="statusColor(statusOf(tool.name).kind)">
                                        {{ statusOf(tool.name).label }}
                                    </v-chip>
                                </div>
                                <div class="text-caption text-medium-emphasis">
                                    {{ oneLine(tool.description) }}
                                    <a
                                        v-if="tool.description && oneLine(tool.description) !== tool.description.trim()"
                                        href="#"
                                        class="ml-1"
                                        @click.prevent="expanded = expanded === tool.name ? '' : tool.name"
                                        >{{ expanded === tool.name ? '접기' : '더보기' }}</a
                                    >
                                </div>
                                <div v-if="expanded === tool.name" class="text-caption text-medium-emphasis full-desc">{{ tool.description }}</div>
                                <div v-if="planOf(tool) === 'not-allowed'" class="text-caption text-warning">{{ COPY.adminOnly }}</div>
                            </div>
                            <v-btn
                                v-if="connected.includes(tool.name)"
                                size="small"
                                variant="text"
                                disabled
                            >
                                연결됨
                            </v-btn>
                            <v-btn
                                v-else
                                size="small"
                                variant="tonal"
                                color="primary"
                                :disabled="planOf(tool) === 'not-allowed'"
                                @click="requestAdd(tool)"
                            >
                                추가
                            </v-btn>
                        </div>
                    </div>
                    <div v-if="!pickerGroups.length" class="text-caption text-medium-emphasis">찾는 도구가 없습니다.</div>
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn variant="text" @click="picker = false">닫기</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 지정과 연결 확인 / 마지막 연결 빼기 확인 -->
        <v-dialog v-model="confirm.open" max-width="520px">
            <v-card data-test="panel-confirm">
                <v-card-title class="pa-4 pb-0 text-subtitle-1">{{ confirm.title }}</v-card-title>
                <v-card-text class="pa-4 text-body-2">
                    <p v-for="line in confirm.lines" :key="line" class="mb-2">{{ line }}</p>
                    <v-radio-group v-if="confirm.choices" v-model="confirm.choice" hide-details density="compact" class="skill-tool-choices">
                        <v-radio v-for="c in confirm.choices" :key="c.value" :label="c.label" :value="c.value" />
                    </v-radio-group>
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn variant="text" @click="confirm.open = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" data-test="panel-confirm-ok" @click="confirmOk">{{ confirm.okLabel }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { getIsAdminClaim } from '@/utils/authClaims';
import {
    COPY,
    readIncludeTools,
    writeIncludeTools,
    readDescription,
    descriptionHints,
    toolStatus,
    addToolPlan,
    removeToolPlan,
    designationTiming,
    oneLine,
    searchTools
} from '@/utils/skillToolBinding';

/**
 * 스킬 상세의 "이 스킬을 읽어야 쓰는 도구". 연결은 SKILL.md 머리말(원문이 단일 출처)에, 스킬 전용
 * 지정은 딥 에이전트에 저장된다. 관리자가 지정 안 된 도구를 추가하면 확인 후 둘을 함께 한다 —
 * 지정은 연결이 반영된 뒤(로컬 스킬은 저장 직후, 저장소 스킬은 병합 뒤 관리자 현황에서) 보낸다.
 * 편집기는 저장이 끝나면 afterSaved() 를 부른다.
 */
export default {
    name: 'SkillToolBindingPanel',
    props: {
        content: { type: String, default: '' },
        skillName: { type: String, default: '' },
        readOnly: { type: Boolean, default: false },
        gitBacked: { type: Boolean, default: false },
        // 저장소 연결 여부를 다 불러왔는지. 그 전에는 추가를 열지 않는다(지정 시점 안내가 틀리지 않게).
        gitReady: { type: Boolean, default: true }
    },
    emits: ['update:content', 'status', 'open', 'close'],
    data() {
        return {
            COPY,
            loading: false,
            loadError: '',
            catalog: { tools: [] },
            bindings: {},
            skillOnly: [],
            // 저장 후 보낼 지정 변경
            pendingAdd: [],
            pendingRemove: [],
            // 이 화면에서 뺐지만 아직 저장하지 않은 연결
            removedUnsaved: [],
            notices: [],
            picker: false,
            query: '',
            expanded: '',
            confirm: { open: false, title: '', lines: [], okLabel: '확인', choices: null, choice: null, onOk: null }
        };
    },
    computed: {
        isAdmin() {
            return getIsAdminClaim();
        },
        connected() {
            return readIncludeTools(this.content);
        },
        byName() {
            return new Map((this.catalog.tools || []).map((t) => [t.name, t]));
        },
        connectedRows() {
            // 저장 전 변경이 있는 도구를 맨 위에 둔다(방금 추가한 도구가 화면 밖으로 밀리지 않게).
            const rows = this.connected.map((name) => {
                if (!this.loading && !this.loadError && !this.byName.has(name)) {
                    return { name, label: COPY.notInTenant, color: 'error', icon: 'mdi-alert-circle-outline' };
                }
                const pendingAdd = this.pendingAdd.includes(name);
                const designated = this.skillOnly.includes(name) || (pendingAdd && !this.gitBacked);
                const releasing = this.pendingRemove.includes(name);
                if (designated && !releasing) {
                    const skills = [...new Set([...(this.bindings[name]?.skills || []), this.skillName])];
                    return {
                        name,
                        label: `${COPY.afterSkill} · ${skills.join(', ')}`,
                        color: 'primary',
                        icon: 'mdi-lock',
                        pending: pendingAdd ? '저장하면 지정' : ''
                    };
                }
                if (pendingAdd) return { name, label: COPY.always, color: undefined, icon: 'mdi-lock-open-variant-outline', pending: '병합 후 지정' };
                return { name, label: COPY.always, color: undefined, icon: 'mdi-lock-open-variant-outline' };
            });
            const fresh = (r) => (this.pendingAdd.includes(r.name) ? 0 : 1);
            return rows.map((r, i) => ({ r, i })).sort((a, b) => fresh(a.r) - fresh(b.r) || a.i - b.i).map((x) => x.r);
        },
        /** 연결돼 있지만 스킬 전용이 아닌 도구(관리자가 지정할 수 있는 것). */
        designatable() {
            if (this.loading || this.loadError) return [];
            return this.connected.filter((name) => {
                const tool = this.byName.get(name);
                return tool && tool.category !== 'unbindable' && !this.skillOnly.includes(name) && !this.pendingAdd.includes(name);
            });
        },
        status() {
            return { count: this.connected.length, designatable: this.isAdmin ? this.designatable.length : 0, unsaved: !!this.unsavedText };
        },
        unsavedText() {
            const short = (names) => (names.length > 3 ? `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}개` : names.join(', '));
            const parts = [];
            if (this.pendingAdd.length) parts.push(`지정하고 연결: ${short(this.pendingAdd)}`);
            if (this.pendingRemove.length) parts.push(`지정 해제: ${short(this.pendingRemove)}`);
            if (this.removedUnsaved.length) parts.push(`뺀 도구: ${short(this.removedUnsaved)}`);
            return parts.length ? `저장하면 반영됩니다. ${parts.join(' · ')}` : '';
        },
        hints() {
            const designated = this.connected.filter((n) => this.skillOnly.includes(n) || this.pendingAdd.includes(n));
            return descriptionHints(readDescription(this.content), designated, this.catalog.tools);
        },
        pickerGroups() {
            return searchTools(this.catalog.tools, this.query);
        }
    },
    watch: {
        // 편집기 도구줄의 아이콘 배지·저장 점 표시용
        status: {
            immediate: true,
            handler(v) {
                this.$emit('status', v);
            }
        },
        gitReady(ready) {
            if (ready && !this.loading) this.addFromRoute();
        },
        connected(names) {
            // 원문에서 직접 지웠거나 다시 적은 도구는 보류 중인 지정 변경도 따라간다.
            this.pendingAdd = this.pendingAdd.filter((n) => names.includes(n));
            this.pendingRemove = this.pendingRemove.filter((n) => !names.includes(n));
            this.removedUnsaved = this.removedUnsaved.filter((n) => !names.includes(n));
        }
    },
    mounted() {
        this.backend = BackendFactory.createBackend();
        this.load().then(() => {
            if (this.gitReady) this.addFromRoute();
        });
    },
    methods: {
        oneLine,
        async load() {
            this.loading = true;
            this.loadError = '';
            try {
                const [catalog, bindings, skillOnly] = await Promise.all([
                    this.backend.getSkillToolCatalog(),
                    this.backend.getSkillToolBindings().catch(() => ({ bindings: {} })),
                    this.backend.getSkillOnlyTools().catch(() => ({ tools: [] }))
                ]);
                this.catalog = catalog || { tools: [] };
                this.bindings = (bindings && bindings.bindings) || {};
                this.skillOnly = (skillOnly && skillOnly.tools) || [];
            } catch (err) {
                this.loadError = err?.error || err?.response?.data?.error || err?.message || String(err);
            } finally {
                this.loading = false;
            }
        },
        /** 관리자 현황의 "스킬에 연결"에서 왔으면(?addTool=이름) 그 도구 추가를 바로 연다. */
        addFromRoute() {
            if (this.routeHandled) return;
            const name = this.$route?.query?.addTool;
            this.routeHandled = true;
            const tool = name && this.byName.get(String(name));
            if (tool && !this.readOnly && !this.connected.includes(tool.name)) {
                this.$emit('open');
                this.requestAdd(tool);
            }
        },
        statusOf(name) {
            return toolStatus(name, this.skillOnly, this.bindings);
        },
        statusColor(kind) {
            return kind === 'after-skill' ? 'primary' : kind === 'unusable' ? 'warning' : undefined;
        },
        planOf(tool) {
            return addToolPlan(tool, { isAdmin: this.isAdmin, skillOnly: this.skillOnly });
        },
        openPicker() {
            this.query = '';
            this.picker = true;
        },
        setConnected(names) {
            this.$emit('update:content', writeIncludeTools(this.content, names));
        },
        removeConnection(name) {
            this.setConnected(this.connected.filter((n) => n !== name));
            // 추가했다 뺀 도구는 저장할 것이 없다.
            if (!this.pendingAdd.includes(name)) this.removedUnsaved = [...new Set([...this.removedUnsaved, name])];
        },
        ask(options) {
            this.confirm = { open: true, okLabel: '확인', choices: null, choice: null, lines: [], ...options };
        },
        confirmOk() {
            const { onOk, choice } = this.confirm;
            this.confirm.open = false;
            if (onOk) onOk(choice);
        },
        requestAdd(tool) {
            const plan = this.planOf(tool);
            if (plan === 'connect') {
                this.setConnected([...this.connected, tool.name]);
                this.picker = false;
                return;
            }
            if (plan !== 'designate-and-connect') return;
            const direct = (this.bindings[tool.name]?.direct_assignments || []).length;
            const timing = designationTiming({ gitBacked: this.gitBacked });
            const lines = [
                timing === 'defer'
                    ? COPY.designateGroup([tool.name], [this.skillName])
                    : COPY.designateConfirm(tool.name, [this.skillName])
            ];
            const others = (this.bindings[tool.name]?.skills || []).filter((n) => n !== this.skillName);
            if (others.length) lines.push(COPY.otherSkills(tool.name, others));
            if (direct) lines.push(COPY.directUse(direct));
            if (timing === 'defer') lines.push(COPY.deferForMerge);
            else lines.push('스킬을 저장하면 연결과 함께 지정됩니다.');
            this.ask({
                title: '스킬 전용으로 지정하고 이 스킬에 연결',
                lines,
                okLabel: '지정하고 연결',
                onOk: () => {
                    this.setConnected([...this.connected, tool.name]);
                    // 실제로 보낼지는 저장이 끝난 시점의 저장소 연결 여부로 정한다(afterSaved).
                    this.pendingAdd = [...new Set([...this.pendingAdd, tool.name])];
                    this.picker = false;
                }
            });
        },
        requestDesignateAll() {
            const names = [...this.designatable];
            if (!names.length) return;
            const timing = designationTiming({ gitBacked: this.gitBacked });
            const lines = [COPY.designateGroup(names, [this.skillName])];
            const others = [...new Set(names.flatMap((n) => (this.bindings[n]?.skills || []).filter((s) => s !== this.skillName)))];
            if (others.length) lines.push(COPY.otherSkills(names.join(', '), others));
            lines.push(timing === 'defer' ? COPY.deferForMerge : '스킬을 저장하면 함께 지정됩니다.');
            this.ask({
                title: `${names.length}개 도구를 스킬 전용으로 지정`,
                lines,
                okLabel: '모두 지정',
                onOk: () => {
                    this.pendingAdd = [...new Set([...this.pendingAdd, ...names])];
                }
            });
        },
        requestRemove(name) {
            const plan = removeToolPlan(name, this.skillName, { bindings: this.bindings, skillOnly: this.skillOnly, isAdmin: this.isAdmin });
            const pendingDesignation = this.pendingAdd.includes(name);
            if (plan === 'disconnect' || pendingDesignation) {
                this.removeConnection(name);
                return;
            }
            if (plan === 'last-connection-warn') {
                this.ask({
                    title: '도구 빼기',
                    lines: [COPY.lastConnection(name), '스킬 전용 지정은 관리자만 해제할 수 있습니다.'],
                    okLabel: '빼기',
                    onOk: () => this.removeConnection(name)
                });
                return;
            }
            this.ask({
                title: '도구 빼기',
                lines: [COPY.lastConnection(name)],
                okLabel: '빼기',
                choice: 'release',
                choices: [
                    { value: 'release', label: '스킬 전용 지정도 해제 — 모든 대화에서 다시 보입니다' },
                    { value: 'keep', label: '지정 유지 — 어떤 대화에서도 쓸 수 없게 됩니다' }
                ],
                onOk: (choice) => {
                    this.removeConnection(name);
                    if (choice === 'release') this.pendingRemove = [...new Set([...this.pendingRemove, name])];
                }
            });
        },
        /**
         * 편집기가 SKILL.md 저장을 마친 뒤 부른다. 보류한 지정 변경을 보낸다. 저장소 스킬은 저장이 병합
         * 요청이라 연결이 아직 반영되지 않았으므로 보내지 않고 관리자 현황에서 하도록 안내한다.
         */
        async afterSaved() {
            const add = [...this.pendingAdd];
            const remove = [...this.pendingRemove];
            this.pendingAdd = [];
            this.pendingRemove = [];
            this.removedUnsaved = [];
            let summary = '';
            if (designationTiming({ gitBacked: this.gitBacked }) === 'defer') {
                if (add.length) this.notices.push({ type: 'info', text: `${add.join(', ')}: ${COPY.deferForMerge}` });
                if (remove.length) this.notices.push({ type: 'info', text: `${remove.join(', ')}: ${COPY.deferReleaseForMerge}` });
            } else if (add.length || remove.length) {
                try {
                    const res = await this.backend.patchSkillOnlyTools({ add, remove });
                    this.skillOnly = (res && res.tools) || this.skillOnly;
                    if (add.length) summary += ` ${add.join(', ')} ${COPY.nowAfterSkill}`;
                    if (remove.length) summary += ` ${remove.join(', ')} ${COPY.nowAlways}`;
                } catch (err) {
                    const forbidden = err?.response?.status === 403 || /관리자/.test(err?.error || '');
                    this.notices.push({ type: 'warning', text: forbidden ? COPY.forbidden : COPY.designateFailed });
                }
            }
            const bindings = await this.backend.getSkillToolBindings().catch(() => null);
            if (bindings) this.bindings = bindings.bindings || {};
            return summary.trim();
        }
    }
};
</script>

<style scoped>
.skill-tool-panel {
    padding: 12px 16px;
}
.tool-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 0;
    border-bottom: 1px solid rgba(var(--v-border-color), 0.08);
}
.pick-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(var(--v-border-color), 0.08);
}
.full-desc {
    white-space: pre-wrap;
}
.min-w-0 {
    min-width: 0;
}
</style>

<style>
/* 확인창은 별도 레이어로 그려져 scoped 규칙이 닿지 않는다. 테마의 회색 라벨 때문에 선택지가 비활성처럼 보이지 않게 한다. */
.skill-tool-choices .v-label {
    opacity: 1;
    color: inherit;
}
</style>
