<template>
    <div class="skill-tool-panel" data-test="skill-tool-panel">
        <div class="panel-head">
            <div class="d-flex align-center ga-1">
                <v-icon size="18">mdi-toolbox-outline</v-icon>
                <span class="text-subtitle-2 font-weight-medium text-truncate">{{ COPY.panelTitle }}</span>
                <span class="text-medium-emphasis text-caption">{{ connected.length }}</span>
                <v-tooltip location="bottom" max-width="340">
                    <template #activator="{ props }">
                        <v-icon v-bind="props" size="16" class="text-medium-emphasis" data-test="panel-help"
                            >mdi-help-circle-outline</v-icon
                        >
                    </template>
                    {{ COPY.panelHelp }}<template v-if="gitBacked"> 저장소에 연결된 스킬이라 병합된 뒤에 반영됩니다.</template>
                </v-tooltip>
                <v-spacer />
                <v-tooltip v-if="readOnly" location="bottom" :text="COPY.systemSkill">
                    <template #activator="{ props }">
                        <v-icon v-bind="props" size="18" class="text-medium-emphasis" data-test="read-only">mdi-lock-outline</v-icon>
                    </template>
                </v-tooltip>
                <v-btn
                    v-if="!readOnly"
                    icon
                    size="small"
                    variant="text"
                    :color="adding ? 'primary' : undefined"
                    :disabled="loading || !!loadError || !gitReady"
                    :aria-label="adding ? '추가 끝내기' : '도구 추가'"
                    data-test="add-tool"
                    @click="toggleAdding"
                >
                    <v-icon>{{ adding ? 'mdi-check' : 'mdi-plus' }}</v-icon>
                    <v-tooltip activator="parent" location="bottom">{{ adding ? '추가 끝내기' : '도구 추가' }}</v-tooltip>
                </v-btn>
                <v-btn icon variant="text" size="small" aria-label="닫기" data-test="panel-close" @click="$emit('close')">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </div>
            <!-- 연결이 어디에 적히는지(화면 문구 중 유일하게 필드 이름을 보인다 — 원문에서 직접 고칠 수 있게). 누르면 편집기의 그 줄로 간다 -->
            <div class="text-caption text-medium-emphasis" data-test="where-stored">
                추가한 도구는 SKILL.md 머리말
                <a href="#" class="where-link" data-test="reveal-include-tools" @click.prevent="$emit('reveal')"
                    ><code>metadata.include_tools</code></a
                >
                에 적힙니다.
            </div>
            <v-text-field
                v-if="adding"
                v-model="query"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                autofocus
                placeholder="도구 이름·설명·서버로 찾기"
                prepend-inner-icon="mdi-magnify"
                class="mt-2"
                data-test="tool-search"
            />
        </div>

        <!-- 저장 전 변경: 편집기 도구줄의 저장으로 반영한다(칸 아래쪽은 화면 밖으로 잘릴 수 있어 위에 둔다) -->
        <div v-if="unsavedText" class="panel-unsaved text-caption" data-test="unsaved-note">
            <v-icon size="14" color="warning">mdi-content-save-alert-outline</v-icon>
            <span>{{ unsavedText }}</span>
        </div>

        <div class="panel-body">
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

            <!-- 추가 모드: 도구를 눌러 바로 연결하거나 뺀다(창 없이 여러 개를 연달아) -->
            <div v-if="adding" data-test="tool-picker">
                <div v-if="notice" class="d-flex align-center ga-1 mb-2 text-caption text-medium-emphasis" data-test="picker-notice">
                    <v-icon size="14">mdi-lock-outline</v-icon><span>{{ notice }}</span>
                </div>
                <div v-for="group in pickerGroups" :key="group.key" class="mb-2" :data-group="group.key">
                    <div class="group-head">
                        <span
                            class="group-toggle d-inline-flex align-center ga-1 min-w-0"
                            :data-group-toggle="group.key"
                            @click="toggleGroup('p:' + group.key)"
                        >
                            <v-icon size="14">{{ isOpen('p:' + group.key) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                            <v-icon size="14" :data-source-icon="group.kind">{{ group.icon }}</v-icon>
                            <span class="text-truncate">{{ group.label }}</span>
                            <span>{{ group.tools.length }}</span>
                            <v-tooltip activator="parent" location="top start" :text="group.hint" />
                        </span>
                        <v-spacer />
                        <!-- 한 서버의 도구는 함께 쓰는 일이 많지만, 서비스 도구는 범용 도구가 섞여 있어 한꺼번에 추가하지 않는다 -->
                        <v-btn
                            v-if="group.kind === 'mcp' && groupAddable(group).length > 1"
                            size="x-small"
                            variant="text"
                            color="primary"
                            :data-add-group="group.key"
                            @click="requestAddMany(group.tools)"
                        >
                            <v-icon start size="14">mdi-plus-box-multiple-outline</v-icon>모두 {{ groupAddable(group).length }}
                        </v-btn>
                    </div>
                    <template v-if="isOpen('p:' + group.key)">
                        <div v-for="tool in group.tools" :key="tool.name" class="pick-row" :data-pick="tool.name">
                            <v-icon
                                size="14"
                                :color="statusColor(statusOf(tool.name).kind)"
                                :class="{ 'text-medium-emphasis': !statusColor(statusOf(tool.name).kind) }"
                                class="mt-1"
                            >
                                {{ statusOf(tool.name).kind === 'always' ? 'mdi-lock-open-variant-outline' : 'mdi-lock' }}
                                <v-tooltip activator="parent" location="top">{{ statusOf(tool.name).label }}</v-tooltip>
                            </v-icon>
                            <div class="flex-grow-1 min-w-0">
                                <code class="text-body-2 tool-name">{{ tool.name }}</code>
                                <div
                                    class="text-caption text-medium-emphasis desc"
                                    :class="{ open: expanded === tool.name }"
                                    @click="expanded = expanded === tool.name ? '' : tool.name"
                                >
                                    {{ expanded === tool.name ? tool.description : oneLine(tool.description) }}
                                </div>
                            </div>
                            <v-btn
                                v-if="connected.includes(tool.name)"
                                icon
                                size="x-small"
                                variant="text"
                                color="primary"
                                :data-picked="tool.name"
                                aria-label="빼기"
                                @click="requestRemove(tool.name)"
                            >
                                <v-icon size="18">mdi-check-circle</v-icon>
                                <v-tooltip activator="parent" location="left">연결됨 · 누르면 뺍니다</v-tooltip>
                            </v-btn>
                            <v-btn
                                v-else-if="planOf(tool) === 'not-allowed'"
                                icon
                                size="x-small"
                                variant="text"
                                disabled
                                :data-blocked="tool.name"
                            >
                                <v-icon size="18">mdi-lock-outline</v-icon>
                            </v-btn>
                            <v-btn
                                v-else
                                icon
                                size="x-small"
                                variant="text"
                                color="primary"
                                :data-add="tool.name"
                                aria-label="추가"
                                @click="requestAdd(tool)"
                            >
                                <v-icon size="18">mdi-plus-circle-outline</v-icon>
                                <v-tooltip activator="parent" location="left">{{
                                    planOf(tool) === 'designate-and-connect' ? '스킬 전용으로 지정하고 연결' : '연결'
                                }}</v-tooltip>
                            </v-btn>
                        </div>
                    </template>
                </div>
                <div v-if="!pickerGroups.length" class="text-caption text-medium-emphasis">찾는 도구가 없습니다.</div>
            </div>

            <!-- 연결된 도구: 출처(서비스 / MCP 서버)별로 묶는다 -->
            <template v-else>
                <div v-if="!loading && !connected.length && !removedRows.length" class="text-caption text-medium-emphasis">
                    연결된 도구가 없습니다.
                </div>

                <!-- 연결만 되고 지정 안 된 도구: 한 번에 지정 -->
                <div
                    v-if="designatable.length && isAdmin && !readOnly"
                    class="d-flex align-center ga-1 mb-2 text-caption text-medium-emphasis"
                    data-test="designate-all"
                >
                    <v-icon size="14">mdi-lock-open-variant-outline</v-icon>
                    <span>지정 안 됨 {{ designatable.length }}</span>
                    <v-spacer />
                    <v-btn size="x-small" variant="tonal" color="primary" data-test="designate-all-btn" @click="requestDesignateAll">
                        <v-icon start size="14">mdi-lock</v-icon>모두 지정
                    </v-btn>
                </div>

                <div class="tool-list" data-test="tool-list">
                    <div v-for="group in connectedGroups" :key="group.key" class="mb-2" :data-connected-group="group.key">
                        <div class="group-head">
                            <span
                                class="group-toggle d-inline-flex align-center ga-1 min-w-0"
                                :data-group-toggle="group.key"
                                @click="toggleGroup('c:' + group.key)"
                            >
                                <v-icon size="14">{{ isOpen('c:' + group.key) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                <v-icon size="14" :data-source-icon="group.kind">{{ group.icon }}</v-icon>
                                <span class="text-truncate">{{ group.label }}</span>
                                <span>{{ group.items.length }}</span>
                                <v-tooltip activator="parent" location="top start" :text="group.hint" />
                            </span>
                        </div>
                        <template v-if="isOpen('c:' + group.key)">
                            <div v-for="row in group.items" :key="row.name" class="tool-line" :data-connected="row.name">
                                <v-icon
                                    size="14"
                                    :color="row.color"
                                    :class="{ 'text-medium-emphasis': !row.color }"
                                    :data-status="row.name"
                                >
                                    {{ row.icon }}
                                    <v-tooltip activator="parent" location="top" max-width="320">
                                        <div v-for="line in row.tips" :key="line">{{ line }}</div>
                                    </v-tooltip>
                                </v-icon>
                                <code class="text-body-2 tool-name">{{ row.name }}</code>
                                <v-chip
                                    v-if="row.pending"
                                    size="x-small"
                                    color="primary"
                                    variant="outlined"
                                    :closable="!readOnly"
                                    :data-pending="row.name"
                                    @click:close="cancelDesignation(row.name)"
                                >
                                    {{ row.pending }}
                                </v-chip>
                                <v-spacer />
                                <v-btn
                                    v-if="!readOnly"
                                    icon
                                    size="x-small"
                                    variant="text"
                                    :data-remove="row.name"
                                    aria-label="빼기"
                                    @click="requestRemove(row.name)"
                                >
                                    <v-icon size="16">mdi-minus-circle-outline</v-icon>
                                    <v-tooltip activator="parent" location="left">빼기</v-tooltip>
                                </v-btn>
                            </div>
                        </template>
                    </div>

                    <!-- 저장 전에 뺀 도구: 되돌릴 수 있다 -->
                    <div v-if="removedRows.length" class="mb-2" data-test="removed-list">
                        <div class="group-head">
                            <v-icon size="14">mdi-minus-circle-outline</v-icon><span>뺀 도구 · 저장하면 반영</span>
                        </div>
                        <div v-for="row in removedRows" :key="row.name" class="tool-line removed" :data-removed="row.name">
                            <code class="text-body-2 tool-name">{{ row.name }}</code>
                            <v-spacer />
                            <!-- 마지막 연결을 뺀 스킬 전용 도구: 지정 해제(기본)·유지를 고른다 -->
                            <v-btn
                                v-if="row.plan === 'last-connection'"
                                icon
                                size="x-small"
                                variant="text"
                                :color="row.release ? undefined : 'warning'"
                                :data-release="row.name"
                                @click="toggleRelease(row.name)"
                            >
                                <v-icon size="16">{{ row.release ? 'mdi-lock-open-variant-outline' : 'mdi-lock-alert-outline' }}</v-icon>
                                <v-tooltip activator="parent" location="left" max-width="300">
                                    {{
                                        row.release
                                            ? '저장하면 스킬 전용 지정도 해제 — 모든 대화에서 다시 보입니다. 누르면 지정 유지'
                                            : '지정 유지 — 어떤 대화에서도 쓸 수 없게 됩니다. 누르면 지정 해제'
                                    }}
                                </v-tooltip>
                            </v-btn>
                            <v-icon v-else-if="row.plan === 'last-connection-warn'" size="16" color="warning" class="mx-1">
                                mdi-alert-outline
                                <v-tooltip activator="parent" location="left" max-width="300"
                                    >{{ COPY.lastConnection(row.name) }} 스킬 전용 지정은 관리자만 해제할 수 있습니다.</v-tooltip
                                >
                            </v-icon>
                            <v-btn
                                icon
                                size="x-small"
                                variant="text"
                                :data-undo="row.name"
                                aria-label="되돌리기"
                                @click="undoRemove(row.name)"
                            >
                                <v-icon size="16">mdi-undo</v-icon>
                                <v-tooltip activator="parent" location="left">되돌리기</v-tooltip>
                            </v-btn>
                        </div>
                    </div>
                </div>

                <v-alert
                    v-if="hints.length"
                    type="info"
                    density="compact"
                    variant="tonal"
                    class="mt-2 text-caption"
                    data-test="description-hint"
                >
                    모델은 설명만 보고 이 스킬을 고릅니다. 이 도구로 할 수 있는 일을 설명에 적어 주세요: <code>{{ hints.join(', ') }}</code>
                </v-alert>
            </template>
        </div>
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
    searchTools,
    addManyPlan,
    pickerNotice,
    shortList,
    groupBySource
} from '@/utils/skillToolBinding';

/**
 * 스킬 상세의 "이 스킬을 읽어야 쓰는 도구". 연결은 SKILL.md 머리말(원문이 단일 출처)에, 스킬 전용
 * 지정은 딥 에이전트에 저장된다. 관리자가 지정 안 된 도구를 추가하면 둘을 함께 한다 —
 * 지정은 연결이 반영된 뒤(로컬 스킬은 저장 직후, 저장소 스킬은 병합 뒤 관리자 현황에서) 보낸다.
 * 추가·빼기는 확인 창 없이 바로 하고, 저장 전까지 줄에서 되돌린다(최종 확인은 저장 창).
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
    emits: ['update:content', 'status', 'open', 'close', 'reveal'],
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
            // 이미 스킬 전용인 도구를 연결만 하고 아직 저장하지 않은 것
            connectedUnsaved: [],
            notices: [],
            adding: false,
            query: '',
            expanded: '',
            // 접은 묶음 — 'c:'(연결된 도구)·'p:'(추가 모드) + 출처 키
            collapsed: []
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
                const tool = this.byName.get(name);
                const base = { name, source: tool?.source, server: tool?.server };
                if (!this.loading && !this.loadError && !tool) {
                    return { ...base, tips: [COPY.notInTenant], color: 'error', icon: 'mdi-alert-circle-outline' };
                }
                const pendingAdd = this.pendingAdd.includes(name);
                const designated = this.skillOnly.includes(name) || (pendingAdd && !this.gitBacked);
                const releasing = this.pendingRemove.includes(name);
                if (designated && !releasing) {
                    const skills = [...new Set([...(this.bindings[name]?.skills || []), this.skillName])];
                    return {
                        ...base,
                        tips: [`${COPY.afterSkill} · ${skills.join(', ')}`, ...(pendingAdd ? this.designationTips(name) : [])],
                        color: 'primary',
                        icon: 'mdi-lock',
                        pending: pendingAdd ? '저장하면 지정' : ''
                    };
                }
                if (pendingAdd) {
                    return {
                        ...base,
                        tips: [COPY.always, ...this.designationTips(name)],
                        icon: 'mdi-lock-open-variant-outline',
                        pending: '병합 후 지정'
                    };
                }
                return { ...base, tips: [COPY.always], icon: 'mdi-lock-open-variant-outline' };
            });
            const fresh = (r) => (this.pendingAdd.includes(r.name) || this.connectedUnsaved.includes(r.name) ? 0 : 1);
            return rows
                .map((r, i) => ({ r, i }))
                .sort((a, b) => fresh(a.r) - fresh(b.r) || a.i - b.i)
                .map((x) => x.r);
        },
        /** 연결된 도구를 출처(딥 에이전트 서비스 / MCP 서버 / 목록에 없음)별로 묶는다. */
        connectedGroups() {
            return groupBySource(this.connectedRows).map((g) => (g.kind === 'missing' ? { ...g, hint: COPY.notInTenant } : g));
        },
        /** 저장 전에 뺀 도구 — 되돌리기와 마지막 연결의 지정 해제·유지를 줄에서 고른다. */
        removedRows() {
            return this.removedUnsaved.map((name) => ({
                name,
                plan: removeToolPlan(name, this.skillName, { bindings: this.bindings, skillOnly: this.skillOnly, isAdmin: this.isAdmin }),
                release: this.pendingRemove.includes(name)
            }));
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
        /** 패널 위의 한 줄 — 무엇이 바뀌었는지는 목록(지정 대기 표시·뺀 도구)이 보여 준다. */
        unsavedText() {
            return this.unsavedDetail ? '저장하면 반영됩니다.' : '';
        },
        /** 저장 창 안내 — 바뀐 도구를 이름까지 적는다. */
        unsavedDetail() {
            const short = (names) => (names.length > 3 ? `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}개` : names.join(', '));
            const parts = [];
            if (this.pendingAdd.length) parts.push(`지정하고 연결: ${short(this.pendingAdd)}`);
            if (this.pendingRemove.length) parts.push(`지정 해제: ${short(this.pendingRemove)}`);
            if (this.connectedUnsaved.length) parts.push(`연결: ${short(this.connectedUnsaved)}`);
            if (this.removedUnsaved.length) parts.push(`뺀 도구: ${short(this.removedUnsaved)}`);
            return parts.length ? `저장하면 반영됩니다. ${parts.join(' · ')}` : '';
        },
        hints() {
            const designated = this.connected.filter((n) => this.skillOnly.includes(n) || this.pendingAdd.includes(n));
            return descriptionHints(readDescription(this.content), designated, this.catalog.tools);
        },
        pickerGroups() {
            return searchTools(this.catalog.tools, this.query);
        },
        notice() {
            return pickerNotice(this.pickerGroups, { isAdmin: this.isAdmin, skillOnly: this.skillOnly });
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
            this.connectedUnsaved = this.connectedUnsaved.filter((n) => names.includes(n));
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
        /** 관리자 현황의 "스킬에 연결"에서 왔으면(?addTool=이름,이름…) 그 도구 추가를 바로 연다. */
        addFromRoute() {
            if (this.routeHandled) return;
            this.routeHandled = true;
            const names = String(this.$route?.query?.addTool || '')
                .split(',')
                .map((n) => n.trim())
                .filter(Boolean);
            const tools = names.map((n) => this.byName.get(n)).filter((t) => t && !this.connected.includes(t.name));
            if (!tools.length || this.readOnly) return;
            this.$emit('open');
            if (tools.length === 1) this.requestAdd(tools[0]);
            else this.requestAddMany(tools);
        },
        groupAddable(group) {
            const plan = addManyPlan(group.tools, { isAdmin: this.isAdmin, skillOnly: this.skillOnly, connected: this.connected });
            return [...plan.connect, ...plan.designate];
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
        toggleGroup(key) {
            this.collapsed = this.collapsed.includes(key) ? this.collapsed.filter((k) => k !== key) : [...this.collapsed, key];
        },
        /** 추가 모드에서 찾는 중이면 결과가 숨지 않게 모두 편다. */
        isOpen(key) {
            if (key.startsWith('p:') && this.query) return true;
            return !this.collapsed.includes(key);
        },
        toggleAdding() {
            this.query = '';
            this.adding = !this.adding;
        },
        /** 지정할 때 생기는 일 — 줄의 툴팁으로 보인다(확인 창 대신). */
        designationTips(name) {
            const tips = [COPY.designateConfirm(name, [this.skillName])];
            const others = (this.bindings[name]?.skills || []).filter((n) => n !== this.skillName);
            if (others.length) tips.push(COPY.otherSkills(name, others));
            const direct = (this.bindings[name]?.direct_assignments || []).length;
            if (direct) tips.push(COPY.directUse(direct));
            if (designationTiming({ gitBacked: this.gitBacked }) === 'defer') tips.push(COPY.deferForMerge);
            return tips;
        },
        setConnected(names) {
            this.$emit('update:content', writeIncludeTools(this.content, names));
        },
        /** 연결을 더한다. 저장 전에 뺐던 도구는 되돌리기와 같다(새로 저장할 연결이 아니다). */
        connect(names, designate = []) {
            const restored = names.filter((n) => this.removedUnsaved.includes(n));
            this.setConnected([...this.connected, ...names, ...designate]);
            this.connectedUnsaved = [...new Set([...this.connectedUnsaved, ...names.filter((n) => !restored.includes(n))])];
            this.pendingAdd = [...new Set([...this.pendingAdd, ...designate])];
        },
        removeConnection(name) {
            // 되돌릴 때 원래 자리로 넣는다(원문 diff 에 순서 변경이 남지 않게).
            this.removedAt = { ...this.removedAt, [name]: this.connected.indexOf(name) };
            this.setConnected(this.connected.filter((n) => n !== name));
            // 저장 전에 추가했다 뺀 도구는 저장할 것이 없다.
            if (!this.pendingAdd.includes(name) && !this.connectedUnsaved.includes(name)) {
                this.removedUnsaved = [...new Set([...this.removedUnsaved, name])];
            }
        },
        requestAdd(tool) {
            const plan = this.planOf(tool);
            if (plan === 'connect') this.connect([tool.name]);
            // 실제로 지정을 보낼지는 저장이 끝난 시점의 저장소 연결 여부로 정한다(afterSaved).
            else if (plan === 'designate-and-connect') this.connect([], [tool.name]);
        },
        /** 여러 도구를 한 번에 추가한다. */
        requestAddMany(tools) {
            const { connect, designate } = addManyPlan(tools, {
                isAdmin: this.isAdmin,
                skillOnly: this.skillOnly,
                connected: this.connected
            });
            if (connect.length || designate.length) this.connect(connect, designate);
        },
        requestDesignateAll() {
            this.pendingAdd = [...new Set([...this.pendingAdd, ...this.designatable])];
        },
        cancelDesignation(name) {
            this.pendingAdd = this.pendingAdd.filter((n) => n !== name);
        },
        /**
         * 바로 뺀다. 이 스킬이 마지막 연결인 스킬 전용 도구는, 관리자면 지정도 해제하는 것을 기본으로 하고
         * (빼고 나면 어떤 대화에서도 쓸 수 없으므로) 뺀 도구 줄에서 유지로 바꿀 수 있다.
         */
        requestRemove(name) {
            const plan = removeToolPlan(name, this.skillName, {
                bindings: this.bindings,
                skillOnly: this.skillOnly,
                isAdmin: this.isAdmin
            });
            const pendingDesignation = this.pendingAdd.includes(name);
            this.removeConnection(name);
            if (plan === 'last-connection' && !pendingDesignation) this.pendingRemove = [...new Set([...this.pendingRemove, name])];
        },
        toggleRelease(name) {
            this.pendingRemove = this.pendingRemove.includes(name)
                ? this.pendingRemove.filter((n) => n !== name)
                : [...this.pendingRemove, name];
        },
        undoRemove(name) {
            this.pendingRemove = this.pendingRemove.filter((n) => n !== name);
            this.removedUnsaved = this.removedUnsaved.filter((n) => n !== name);
            const names = [...this.connected];
            const at = this.removedAt?.[name];
            names.splice(at >= 0 ? Math.min(at, names.length) : names.length, 0, name);
            this.setConnected(names);
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
            this.connectedUnsaved = [];
            let summary = '';
            if (designationTiming({ gitBacked: this.gitBacked }) === 'defer') {
                if (add.length) this.notices.push({ type: 'info', text: `${add.join(', ')}: ${COPY.deferForMerge}` });
                if (remove.length) this.notices.push({ type: 'info', text: `${remove.join(', ')}: ${COPY.deferReleaseForMerge}` });
            } else if (add.length || remove.length) {
                try {
                    const res = await this.backend.patchSkillOnlyTools({ add, remove });
                    this.skillOnly = (res && res.tools) || this.skillOnly;
                    if (add.length) summary += ` ${shortList(add)} ${COPY.nowAfterSkill}`;
                    if (remove.length) summary += ` ${shortList(remove)} ${COPY.nowAlways}`;
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
/* 편집기 옆 칸을 꽉 채운다 — 머리·꼬리는 고정, 목록만 스크롤 */
.skill-tool-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}
.panel-head {
    flex: none;
    padding: 6px 8px 8px 12px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.panel-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 12px;
}
.panel-unsaved {
    flex: none;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 12px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: rgba(var(--v-theme-warning), 0.08);
}
.where-link {
    text-decoration: none;
}
.where-link code {
    color: rgb(var(--v-theme-primary));
    font-size: 11px;
}
.group-head {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
    font-size: 12px;
    font-weight: 500;
    color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.group-toggle {
    cursor: pointer;
    user-select: none;
}
.tool-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding-left: 4px;
}
.tool-line:hover,
.pick-row:hover {
    background: rgba(var(--v-theme-on-surface), 0.04);
}
.tool-line.removed .tool-name {
    text-decoration: line-through;
    opacity: 0.6;
}
.tool-name {
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}
.pick-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 4px 0 4px 4px;
}
.desc {
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.desc.open {
    white-space: pre-wrap;
}
.min-w-0 {
    min-width: 0;
}
</style>
