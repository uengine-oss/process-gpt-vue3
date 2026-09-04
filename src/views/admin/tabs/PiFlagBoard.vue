<template>
    <div class="pi-flag-board">
        <!-- Summary / actions -->
        <div class="section-header">
            <div class="summary-cards" aria-label="PI Flag 요약">
                <button class="summary-card" :class="{ 'summary-card--active': !filters.status }" @click="setTimingFilter('')">
                    <span class="summary-card__label">전체 PI Flag</span>
                    <strong>{{ allFlags.length }}</strong>
                    <span>{{ processOptions.length }}개 프로세스</span>
                </button>
                <button
                    class="summary-card summary-card--urgent"
                    :class="{ 'summary-card--active': filters.status === 'resolved' }"
                    @click="setTimingFilter('resolved')"
                >
                    <span class="summary-card__label">즉시 개선</span>
                    <strong>{{ resolvedCount }}</strong>
                    <span>우선 검토 대상</span>
                </button>
                <button
                    class="summary-card summary-card--future"
                    :class="{ 'summary-card--active': filters.status === 'open' }"
                    @click="setTimingFilter('open')"
                >
                    <span class="summary-card__label">향후 과제</span>
                    <strong>{{ openCount }}</strong>
                    <span>중장기 검토 대상</span>
                </button>
                <div class="summary-card summary-card--neutral">
                    <span class="summary-card__label">유형 미지정</span>
                    <strong>{{ unclassifiedCount }}</strong>
                    <span>분류가 필요합니다</span>
                </div>
            </div>
        </div>

        <!-- Filter Bar -->
        <div class="filter-bar">
            <div class="filter-bar__primary">
                <v-text-field
                    v-model="filters.keyword"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                    prepend-inner-icon="mdi-magnify"
                    placeholder="사유, 태스크, 프로세스, 작성자 검색"
                    class="filter-keyword"
                />
                <v-select
                    v-model="filters.domains"
                    :items="domainOptions"
                    item-title="name"
                    item-value="id"
                    multiple
                    density="compact"
                    variant="outlined"
                    hide-details
                    placeholder="전체 도메인"
                    class="filter-compact"
                >
                    <template v-slot:selection="{ item, index }">
                        <span v-if="index === 0" class="select-summary-text">
                            {{ filters.domains.length === 1 ? item.title : `${item.title} 외 ${filters.domains.length - 1}` }}
                        </span>
                    </template>
                </v-select>
                <v-select
                    v-model="filters.status"
                    :items="statusOptions"
                    item-title="title"
                    item-value="value"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                    placeholder="전체 개선 시점"
                    class="filter-compact filter-compact--narrow"
                />
                <v-btn
                    variant="outlined"
                    color="default"
                    size="small"
                    class="filter-toggle-btn"
                    @click="advancedFilterOpen = !advancedFilterOpen"
                >
                    <v-icon start size="16">mdi-tune-variant</v-icon>
                    상세 필터
                    <v-chip v-if="advancedActiveCount > 0" size="x-small" color="error" variant="flat" class="ml-2 filter-toggle-count">
                        {{ advancedActiveCount }}
                    </v-chip>
                    <v-icon end size="16">{{ advancedFilterOpen ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                </v-btn>
                <v-btn
                    variant="outlined"
                    color="default"
                    size="small"
                    prepend-icon="mdi-filter-remove-outline"
                    :disabled="!hasActiveFilter"
                    class="filter-reset-btn"
                    @click="resetFilters"
                >
                    초기화
                </v-btn>
                <div class="section-actions">
                    <button class="action-btn" :disabled="loading" @click="reload">
                        <v-icon size="16">mdi-refresh</v-icon>
                        <span>새로고침</span>
                    </button>
                    <button class="action-btn" :disabled="filteredFlags.length === 0" @click="exportCsv">
                        <v-icon size="16">mdi-download</v-icon>
                        <span>CSV 내보내기</span>
                    </button>
                    <button class="action-btn" :disabled="filteredFlags.length === 0" @click="exportIssueJson">
                        <v-icon size="16">mdi-code-json</v-icon>
                        <span>이슈 JSON</span>
                    </button>
                </div>
            </div>

            <v-expand-transition>
                <div v-if="advancedFilterOpen" class="filter-bar__advanced">
                    <div class="advanced-grid">
                        <div class="advanced-field advanced-field--wide">
                            <span class="advanced-label">프로세스</span>
                            <v-autocomplete
                                v-model="filters.processes"
                                :items="processOptions"
                                item-title="name"
                                item-value="id"
                                multiple
                                chips
                                closable-chips
                                density="compact"
                                variant="outlined"
                                hide-details
                                placeholder="전체 프로세스"
                            />
                        </div>
                        <div class="advanced-field">
                            <span class="advanced-label">유형</span>
                            <v-select
                                v-model="filters.type"
                                :items="typeOptionItems"
                                item-title="title"
                                item-value="value"
                                density="compact"
                                variant="outlined"
                                hide-details
                                clearable
                                placeholder="전체 유형"
                            />
                        </div>
                        <div class="advanced-field">
                            <span class="advanced-label">작성자</span>
                            <v-text-field
                                v-model="filters.author"
                                density="compact"
                                variant="outlined"
                                hide-details
                                clearable
                                placeholder="작성자 검색"
                            />
                        </div>
                        <div class="advanced-field">
                            <span class="advanced-label">작성 시작일</span>
                            <v-text-field v-model="filters.startDate" type="date" density="compact" variant="outlined" hide-details />
                        </div>
                        <div class="advanced-field">
                            <span class="advanced-label">작성 종료일</span>
                            <v-text-field v-model="filters.endDate" type="date" density="compact" variant="outlined" hide-details />
                        </div>
                    </div>
                </div>
            </v-expand-transition>
        </div>

        <div class="results-summary">
            검색 결과 <b>{{ groupedFlags.length }}</b
            >개 프로세스 / PI Flag {{ filteredFlags.length }}건 / 전체 {{ allFlags.length }}건
        </div>

        <!-- Loading / Error / Empty -->
        <div v-if="loading" class="state-area">
            <v-progress-circular indeterminate color="primary" size="28" />
            <span class="state-text">PI Flag 데이터를 불러오는 중입니다…</span>
        </div>
        <div v-else-if="loadError" class="state-area state-area--error">
            <v-icon color="error">mdi-alert-circle-outline</v-icon>
            <span class="state-text">{{ loadError }}</span>
            <button class="action-btn" @click="reload">다시 시도</button>
        </div>
        <div v-else-if="filteredFlags.length === 0" class="state-area">
            <v-icon color="grey">mdi-flag-off-outline</v-icon>
            <div class="empty-text-block">
                <span class="state-text">{{
                    allFlags.length === 0 ? '등록된 PI Flag가 없습니다.' : '조건에 맞는 PI Flag가 없습니다.'
                }}</span>
                <span class="empty-hint">
                    {{
                        allFlags.length === 0
                            ? '프로세스 순서도에서 개선이 필요한 태스크에 PI Flag를 등록해 보세요.'
                            : '필터를 초기화하거나 검색 조건을 변경해 보세요.'
                    }}
                </span>
                <v-btn
                    v-if="allFlags.length === 0"
                    size="small"
                    variant="outlined"
                    color="primary"
                    @click="$router.push('/process-architecture')"
                >
                    프로세스 체계도로 이동
                </v-btn>
                <v-btn v-else size="small" variant="text" @click="resetFilters">필터 초기화</v-btn>
            </div>
        </div>

        <!-- Table -->
        <v-data-table
            v-else
            :headers="tableHeaders"
            :items="groupedFlags"
            v-model:expanded="expandedProcessRows"
            item-value="uniqueKey"
            :items-per-page="25"
            :items-per-page-options="[25, 50, 100, 200]"
            density="compact"
            hover
            class="sk-data-table pi-flag-table"
            show-expand
        >
            <template v-slot:[`item.domainName`]="{ item }">
                <span class="cell-domain">{{ item.domainName || '미지정' }}</span>
            </template>
            <template v-slot:[`item.procDefName`]="{ item }">
                <a class="cell-process-link" @click.stop="goToProcess(item)">{{ item.procDefName }}</a>
            </template>
            <template v-slot:[`item.elementName`]="{ item }">
                <span class="cell-element">{{ item.taskCount }}개 태스크 / {{ item.flagCount }}건</span>
            </template>
            <template v-slot:[`item.status`]="{ item }">
                <div class="cell-status-summary">
                    <v-chip v-if="item.resolvedCount > 0" size="small" variant="tonal" color="error">
                        <v-icon start size="14">mdi-flag</v-icon>
                        즉시 개선 {{ item.resolvedCount }}
                    </v-chip>
                    <v-chip v-if="item.openCount > 0" size="small" variant="tonal" color="success">
                        <v-icon start size="14">mdi-flag</v-icon>
                        향후 과제 {{ item.openCount }}
                    </v-chip>
                </div>
            </template>
            <template v-slot:[`item.type`]="{ item }">
                <div class="cell-type-list">
                    <span v-for="type in item.types" :key="`${item.uniqueKey}-type-${type}`" class="cell-type">
                        {{ type }}
                    </span>
                    <span v-if="item.types.length === 0" class="cell-type">-</span>
                </div>
            </template>
            <template v-slot:[`item.description`]="{ item }">
                <span class="cell-description">{{ item.descriptionSummary }}</span>
            </template>
            <template v-slot:[`item.data-table-expand`]="{ internalItem, isExpanded, toggleExpand }">
                <div class="expand-toggle-cell">
                    <v-btn icon variant="text" density="compact" size="x-small" @click.stop="toggleExpand(internalItem)">
                        <v-icon size="18">
                            {{ isExpanded(internalItem) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                        </v-icon>
                    </v-btn>
                </div>
            </template>
            <template #expanded-row="{ columns, item }">
                <tr class="pi-flag-expanded-row">
                    <td :colspan="columns.length" class="pi-flag-expanded-cell">
                        <div class="child-diff-list">
                            <div v-for="child in item.children" :key="child.uniqueKey" class="child-diff-row">
                                <div class="child-diff-main">
                                    <div class="child-diff-task">
                                        <div v-if="child.isGrouped" class="task-link-list">
                                            <span
                                                v-for="(name, idx) in child.elementNames || []"
                                                :key="`${child.uniqueKey}-mem-${idx}`"
                                                class="task-link"
                                            >
                                                <span class="task-link-label">Task</span>
                                                <span class="task-link-text">{{ name }}</span>
                                            </span>
                                        </div>
                                        <span v-else class="task-link">
                                            <span class="task-link-label">Task</span>
                                            <span class="task-link-text">{{ child.elementName || child.elementId }}</span>
                                        </span>
                                    </div>
                                    <div class="child-diff-description">
                                        <span class="task-link-label">사유</span>
                                        <span class="child-diff-description-text">{{ child.description || '사유 없음' }}</span>
                                    </div>
                                </div>
                                <div class="child-diff-side">
                                    <div class="child-diff-kind">
                                        <v-chip size="x-small" variant="tonal" :color="child.status === 'resolved' ? 'error' : 'success'">
                                            <v-icon start size="12">mdi-flag</v-icon>
                                            {{ child.status === 'resolved' ? '즉시 개선' : '향후 과제' }}
                                        </v-chip>
                                        <span v-if="child.type" class="child-diff-type-text">{{ child.type }}</span>
                                    </div>
                                    <div class="child-diff-meta">
                                        {{ child.authorName || '익명' }} · {{ formatDatetime(child.createdAt) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            </template>
        </v-data-table>
    </div>
</template>

<script>
import { defineComponent } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { navigateToProcessHierarchy, PROCESS_HIERARCHY_ENTRY } from '@/views/process-hierarchy/navigation';
import { downloadIssueJson } from '@/composables/blueprint/piFlagIssueExport';

const PI_FLAG_PROBE_TOKENS = ['uengine:Properties', '"comments"'];

export default defineComponent({
    name: 'PiFlagBoard',
    data() {
        return {
            loading: false,
            loadError: '',
            allFlags: [],
            expandedProcessRows: [],
            candidateDefCount: 0,
            parsedDefWithFlagCount: 0,
            domainNameMap: {},
            advancedFilterOpen: false,
            statusOptions: [
                { title: '즉시 개선', value: 'resolved' },
                { title: '향후 과제', value: 'open' }
            ],
            filters: {
                domains: [],
                processes: [],
                status: '',
                type: '',
                author: '',
                startDate: '',
                endDate: '',
                keyword: ''
            },
            tableHeaders: [
                { title: '도메인', key: 'domainName', sortable: true, width: 140 },
                { title: '프로세스', key: 'procDefName', sortable: true, width: 200 },
                { title: '태스크', key: 'elementName', sortable: false, width: 180 },
                { title: '개선 시점', key: 'status', sortable: true, width: 130 },
                { title: '유형', key: 'type', sortable: true, width: 140 },
                { title: '사유', key: 'description', sortable: false, minWidth: 240 },
                { title: '', key: 'data-table-expand', sortable: false, width: 56, align: 'end' }
            ]
        };
    },
    computed: {
        resolvedCount() {
            return this.allFlags.filter((f) => f.status === 'resolved').length;
        },
        openCount() {
            return this.allFlags.filter((f) => f.status !== 'resolved').length;
        },
        unclassifiedCount() {
            return this.allFlags.filter((f) => !f.type).length;
        },
        domainOptions() {
            const seen = new Map();
            this.allFlags.forEach((f) => {
                const id = f.domainId || f.domainName || '';
                if (!id) return;
                if (!seen.has(id)) seen.set(id, { id, name: f.domainName || id });
            });
            return Array.from(seen.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
        },
        processOptions() {
            const seen = new Map();
            this.allFlags.forEach((f) => {
                if (!f.procDefId) return;
                if (!seen.has(f.procDefId)) seen.set(f.procDefId, { id: f.procDefId, name: f.procDefName || f.procDefId });
            });
            return Array.from(seen.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
        },
        typeOptions() {
            const set = new Set();
            this.allFlags.forEach((f) => {
                if (f.type) set.add(f.type);
            });
            return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), 'ko'));
        },
        typeOptionItems() {
            return this.typeOptions.map((t) => ({ title: t, value: t }));
        },
        advancedActiveCount() {
            const f = this.filters;
            let count = 0;
            if (f.processes.length > 0) count += 1;
            if (f.type) count += 1;
            if ((f.author || '').trim()) count += 1;
            if (f.startDate) count += 1;
            if (f.endDate) count += 1;
            return count;
        },
        hasActiveFilter() {
            const f = this.filters;
            return (
                f.domains.length > 0 ||
                f.processes.length > 0 ||
                !!f.status ||
                !!f.type ||
                !!(f.author || '').trim() ||
                !!f.startDate ||
                !!f.endDate ||
                !!(f.keyword || '').trim()
            );
        },
        filteredFlags() {
            const f = this.filters;
            const startBound = f.startDate ? `${f.startDate}T00:00:00` : '';
            const endBound = f.endDate ? `${f.endDate}T23:59:59` : '';
            const authorQ = (f.author || '').trim().toLowerCase();
            const keywordQ = (f.keyword || '').trim().toLowerCase();
            return this.allFlags.filter((row) => {
                if (f.domains.length > 0) {
                    const dKey = row.domainId || row.domainName || '';
                    if (!f.domains.includes(dKey)) return false;
                }
                if (f.processes.length > 0 && !f.processes.includes(row.procDefId)) return false;
                if (f.status && row.status !== f.status) return false;
                if (f.type && row.type !== f.type) return false;
                if (authorQ) {
                    const haystack = `${row.authorName || ''} ${row.authorId || ''}`.toLowerCase();
                    if (!haystack.includes(authorQ)) return false;
                }
                if (startBound && row.createdAt && row.createdAt < startBound) return false;
                if (endBound && row.createdAt && row.createdAt > endBound) return false;
                if (keywordQ) {
                    const haystack = [
                        row.description,
                        row.elementName,
                        row.elementId,
                        ...(row.elementNames || []),
                        ...(row.elementIds || []),
                        row.procDefName,
                        row.type,
                        row.authorName,
                        row.domainName
                    ]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();
                    if (!haystack.includes(keywordQ)) return false;
                }
                return true;
            });
        },
        groupedFlags() {
            const grouped = new Map();
            this.filteredFlags.forEach((row) => {
                const key = row.procDefId || row.procDefName || 'unknown-process';
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key).push(row);
            });

            return Array.from(grouped.entries())
                .map(([processKey, rows]) => {
                    const children = [...rows].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
                    const first = children[0] || {};
                    const taskKeys = new Set();
                    children.forEach((row) => {
                        const ids = row.elementIds && row.elementIds.length > 0 ? row.elementIds : [row.elementId || row.elementName || ''];
                        ids.forEach((id) => {
                            if (id) taskKeys.add(id);
                        });
                    });
                    const types = Array.from(new Set(children.map((row) => row.type).filter(Boolean))).sort((a, b) =>
                        String(a).localeCompare(String(b), 'ko')
                    );
                    const resolvedCount = children.filter((row) => row.status === 'resolved').length;
                    const openCount = children.length - resolvedCount;
                    const descriptions = Array.from(new Set(children.map((row) => row.description).filter(Boolean)));
                    const descriptionSummary = descriptions.length <= 1 ? descriptions[0] || '' : `${descriptions.length}개 사유`;
                    return {
                        uniqueKey: `process::${processKey}`,
                        procDefId: first.procDefId || '',
                        procDefName: first.procDefName || processKey,
                        domainId: first.domainId || '',
                        domainName: first.domainName || '미지정',
                        elementName: `${taskKeys.size}개 태스크`,
                        taskCount: taskKeys.size,
                        flagCount: children.length,
                        status: resolvedCount > 0 && openCount === 0 ? 'resolved' : 'open',
                        resolvedCount,
                        openCount,
                        type: types.join(', '),
                        types,
                        description: descriptionSummary,
                        descriptionSummary,
                        authorName: first.authorName || '익명',
                        createdAt: first.createdAt || '',
                        children
                    };
                })
                .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        }
    },
    mounted() {
        this.loadAll();
    },
    methods: {
        async loadAll() {
            this.loading = true;
            this.loadError = '';
            this.candidateDefCount = 0;
            this.parsedDefWithFlagCount = 0;
            try {
                const supabase = window.$supabase;
                const tenantId = window.$tenantName;
                if (!supabase || !tenantId) {
                    throw new Error('Supabase 또는 테넌트 정보가 초기화되지 않았습니다.');
                }

                const [domainNameMap, procToDomain] = await Promise.all([
                    this.fetchDomainNameMap(),
                    this.fetchProcessDomainMap(supabase, tenantId)
                ]);
                this.domainNameMap = domainNameMap;

                const candidates = await this.fetchPiFlagCandidates(supabase, tenantId);
                this.candidateDefCount = candidates.length;
                const flags = [];
                let defWithFlagCount = 0;
                candidates.forEach((def) => {
                    const rows = this.parsePiFlagsFromBpmn(def, procToDomain, domainNameMap);
                    if (rows.length > 0) {
                        defWithFlagCount += 1;
                        flags.push(...rows);
                    }
                });
                this.parsedDefWithFlagCount = defWithFlagCount;
                flags.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
                this.allFlags = flags;
            } catch (err) {
                console.warn('[PiFlagBoard] loadAll failed', err);
                this.loadError = err?.message || 'PI Flag 데이터를 불러오지 못했습니다.';
                this.allFlags = [];
            } finally {
                this.loading = false;
            }
        },

        async fetchPiFlagCandidates(supabase, tenantId) {
            const orFilter = PI_FLAG_PROBE_TOKENS.map((token) => `bpmn.ilike.%${token}%`).join(',');
            const { data, error } = await supabase
                .from('proc_def')
                .select('id,name,bpmn,owner')
                .eq('tenant_id', tenantId)
                .is('deleted_at', null)
                .or(orFilter)
                .order('name', { ascending: true });
            if (error) {
                console.warn('[PiFlagBoard] fetchPiFlagCandidates with OR ilike failed, fallback to full scan:', error);
                const { data: fallback, error: fallbackError } = await supabase
                    .from('proc_def')
                    .select('id,name,bpmn,owner')
                    .eq('tenant_id', tenantId)
                    .is('deleted_at', null)
                    .order('name', { ascending: true });
                if (fallbackError) throw fallbackError;
                return fallback || [];
            }
            return data || [];
        },

        async fetchProcessDomainMap(supabase, tenantId) {
            const map = {};
            try {
                const backend = BackendFactory.createBackend();
                const defMap = await backend.getProcessDefinitionMap();

                (defMap?.mega_proc_list || []).forEach((mega) => {
                    (mega?.major_proc_list || []).forEach((major) => {
                        const domainRef = major?.domain || major?.domain_id || major?.domainId || '';
                        if (!domainRef) return;
                        const majorId = major?.id || major?.name;
                        if (majorId && !map[majorId]) map[majorId] = domainRef;
                        (major?.sub_proc_list || []).forEach((sub) => {
                            const subId = sub?.id;
                            const procDefId = sub?.proc_def_id;
                            if (subId && !map[subId]) map[subId] = domainRef;
                            if (procDefId && !map[procDefId]) map[procDefId] = domainRef;
                        });
                    });
                });

                if (Object.keys(map).length > 0) return map;
            } catch (err) {
                console.warn('[PiFlagBoard] fetchProcessDomainMap via definitionMap failed, falling back to tb_bpmn_model', err);
            }

            try {
                const { data, error } = await supabase.from('tb_bpmn_model').select('proc_def_id, domain_id').eq('tenant_id', tenantId);
                if (error) throw error;
                (data || []).forEach((row) => {
                    if (row.proc_def_id && row.domain_id) {
                        map[row.proc_def_id] = row.domain_id;
                    }
                });
                return map;
            } catch (err) {
                console.warn('[PiFlagBoard] fetchProcessDomainMap fallback failed', err);
                return map;
            }
        },

        async fetchDomainNameMap() {
            try {
                const backend = BackendFactory.createBackend();
                const metrics = await backend.getMetricsMap();
                const map = {};
                (metrics?.domains || []).forEach((d) => {
                    const id = d?.id || d?.name;
                    if (!id) return;
                    map[id] = d?.name || id;
                    if (d?.name) map[d.name] = d.name;
                });
                return map;
            } catch (err) {
                console.warn('[PiFlagBoard] fetchDomainNameMap failed', err);
                return {};
            }
        },

        collectElementsByLocalName(root, lowerLocalName) {
            if (!root) return [];
            const result = [];
            const target = String(lowerLocalName || '').toLowerCase();
            const walker = (root.ownerDocument || root).createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
            let node = walker.nextNode();
            while (node) {
                const ln = (node.localName || node.nodeName || '').toLowerCase();
                if (ln === target || ln === `bpmn:${target}` || ln.endsWith(`:${target}`)) {
                    result.push(node);
                }
                node = walker.nextNode();
            }
            return result;
        },

        parsePiFlagsFromBpmn(def, procToDomain, domainNameMap) {
            const raw = [];
            const xml = def?.bpmn;
            if (!xml || typeof xml !== 'string') return raw;
            let doc;
            try {
                doc = new DOMParser().parseFromString(xml, 'text/xml');
            } catch (err) {
                console.warn('[PiFlagBoard] DOMParser failed', def?.id, err);
                return raw;
            }
            const parserError = doc.getElementsByTagName('parsererror')[0];
            if (parserError) return raw;

            const exts = this.collectElementsByLocalName(doc, 'extensionelements');
            const domainId = procToDomain[def.id] || '';
            const domainName = domainNameMap[domainId] || domainId || '미지정';

            exts.forEach((ext) => {
                const parent = ext.parentNode;
                if (!parent || parent.nodeType !== 1) return;
                const elementId = parent.getAttribute('id') || '';
                const elementName = parent.getAttribute('name') || elementId;

                const propsList = this.collectElementsByLocalName(ext, 'properties');
                propsList.forEach((p) => {
                    const json = p.getAttribute('json');
                    if (!json) return;
                    let parsed;
                    try {
                        parsed = JSON.parse(json);
                    } catch {
                        return;
                    }
                    if (!parsed || !Array.isArray(parsed.comments)) return;
                    parsed.comments.forEach((c) => {
                        if (!c) return;
                        raw.push({
                            commentKey: c.groupId || c.id || '',
                            commentId: c.id || '',
                            elementId,
                            elementName,
                            comment: c
                        });
                    });
                });
            });

            // Collapse comments that share the same key (i.e. same comment.id replicated
            // across multiple elements when the user submitted a group flag) into one row.
            const grouped = new Map();
            const ungrouped = [];
            raw.forEach((entry, idx) => {
                if (!entry.commentKey) {
                    ungrouped.push({ ...entry, _idx: idx });
                    return;
                }
                if (!grouped.has(entry.commentKey)) grouped.set(entry.commentKey, []);
                grouped.get(entry.commentKey).push({ ...entry, _idx: idx });
            });

            const buildRow = (members, idx) => {
                const first = members[0];
                const c = first.comment;
                const elementIds = members.map((m) => m.elementId);
                const elementNames = members.map((m) => m.elementName);
                return {
                    uniqueKey: `${def.id}::${first.commentKey || `__solo_${idx}`}::${first.elementId}`,
                    procDefId: def.id,
                    procDefName: def.name || def.id,
                    domainId,
                    domainName,
                    elementId: first.elementId,
                    elementName: first.elementName,
                    elementIds,
                    elementNames,
                    groupSize: members.length,
                    isGrouped: members.length > 1,
                    status: c.status || 'open',
                    type: c.type || '',
                    // 신규 PI Flag 모델 필드 (없으면 구버전 description 폴백)
                    category: c.category || c.type || '',
                    title: c.title || '',
                    problem: c.problem || c.description || '',
                    improvement: c.improvement || '',
                    description: c.description || '',
                    authorId: c.authorId || '',
                    authorName: c.authorName || '익명',
                    createdAt: c.createdAt || ''
                };
            };

            const rows = [];
            grouped.forEach((members) => rows.push(buildRow(members, members[0]._idx)));
            ungrouped.forEach((entry) => rows.push(buildRow([entry], entry._idx)));
            return rows;
        },

        reload() {
            this.loadAll();
        },

        resetFilters() {
            this.filters.domains = [];
            this.filters.processes = [];
            this.filters.status = '';
            this.filters.type = '';
            this.filters.author = '';
            this.filters.startDate = '';
            this.filters.endDate = '';
            this.filters.keyword = '';
        },

        setTimingFilter(status) {
            this.filters.status = this.filters.status === status ? '' : status;
        },

        goToProcess(row) {
            if (!row?.procDefId) return;
            const id = String(row.procDefId).trim();
            const nameText = String(row.procDefName != null && row.procDefName !== '' ? row.procDefName : id).trim();
            navigateToProcessHierarchy(
                this.$router,
                { id, name: nameText, entry: PROCESS_HIERARCHY_ENTRY.ARCHITECTURE },
                { openInNewTab: true }
            );
        },

        formatDatetime(value) {
            if (!value) return '-';
            try {
                const d = new Date(value);
                if (Number.isNaN(d.getTime())) return value;
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const hh = String(d.getHours()).padStart(2, '0');
                const mi = String(d.getMinutes()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
            } catch {
                return value;
            }
        },

        exportIssueJson() {
            const rows = this.filteredFlags;
            if (rows.length === 0) return;
            const flags = rows.map((r) => ({
                domainName: r.domainName || '',
                procDefName: r.procDefName || '',
                procDefId: r.procDefId || '',
                elementId: r.elementId || '',
                elementName: r.elementName || '',
                elementNames: r.elementNames || [],
                status: r.status || 'open',
                type: r.type || '',
                category: r.category || r.type || '',
                title: r.title || '',
                problem: r.problem || r.description || '',
                improvement: r.improvement || '',
                description: r.description || '',
                authorName: r.authorName || '',
                createdAt: r.createdAt || ''
            }));
            downloadIssueJson(flags);
        },

        exportCsv() {
            const rows = this.filteredFlags;
            if (rows.length === 0) return;
            const headers = ['도메인', '프로세스', '태스크', '상태', '유형', '사유', '작성자', '작성일'];
            const escapeText = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const escapeAsText = (v) => `="${String(v ?? '').replace(/"/g, '""')}"`;
            const body = rows.map((r) => {
                const names = r.elementNames && r.elementNames.length > 0 ? r.elementNames.join(', ') : r.elementName || r.elementId || '';
                return [
                    escapeText(r.domainName || ''),
                    escapeText(r.procDefName || ''),
                    escapeText(r.isGrouped ? `[그룹 ${r.groupSize}건] ${names}` : names),
                    escapeText(r.status === 'resolved' ? '즉시 개선' : '향후 과제'),
                    escapeText(r.type || ''),
                    escapeText(r.description || ''),
                    escapeText(r.authorName || ''),
                    escapeAsText(this.formatDatetime(r.createdAt))
                ];
            });
            const headerLine = headers.map(escapeText).join(',');
            const bodyLines = body.map((line) => line.join(','));
            const csv = '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            a.href = url;
            a.download = `pi_flag_${dateStr}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
});
</script>

<style scoped>
.pi-flag-board {
    padding: 16px;
    background: #ffffff;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.pi-flag-board > .section-header,
.pi-flag-board > .filter-bar,
.pi-flag-board > .results-summary,
.pi-flag-board > .state-area {
    flex: 0 0 auto;
}

.pi-flag-board > .sk-data-table {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
}

.section-header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    margin-bottom: 20px;
    gap: 12px;
    overflow: visible;
}

.summary-cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(132px, 1fr));
    gap: 10px;
    min-width: 0;
    width: 100%;
}

.summary-card {
    appearance: none;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 10px;
    min-width: 0;
    padding: 12px 14px;
    text-align: left;
    color: #475569;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #94a3b8;
    border-radius: 10px;
}

button.summary-card {
    cursor: pointer;
    transition: none;
}

.summary-card--active {
    background: #f8fafc;
}

.summary-card--urgent {
    border-left-color: #ef4444;
}

.summary-card--future {
    border-left-color: #3b82f6;
}

.summary-card--neutral {
    border-left-color: #f59e0b;
}

.summary-card__label {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.summary-card strong {
    grid-row: span 2;
    color: #0f172a;
    font-size: 24px;
    line-height: 1;
}

.summary-card > span:last-child {
    color: #94a3b8;
    font-size: 10px;
}

.section-icon {
    color: #ef5350;
    font-size: 22px;
}

.section-title {
    font-size: 18px;
    font-weight: 700;
    color: #1f2937;
}

.section-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    white-space: nowrap;
}

.action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
}

.action-btn:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #9ca3af;
}

.action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.filter-bar {
    margin-bottom: 16px;
    padding: 2px;
    background: #ffffff;
    border-radius: 10px;
}

/* 전역의 0.5px 분할 outline(start/notch/end)은 비활성 상태에서 상단선이 끊겨
   보일 수 있다. 이 화면에서는 분할 outline을 끄고 단일 연속 테두리를 사용한다. */
.filter-bar :deep(.v-field--variant-outlined) {
    border: 1px solid #cbd5e1;
}

.filter-bar :deep(.v-field--variant-outlined .v-field__outline) {
    display: none;
}

.filter-bar :deep(.v-field--focused.v-field--variant-outlined) {
    border-color: hsl(var(--accent-100));
    box-shadow: inset 0 0 0 1px hsl(var(--accent-100));
}

.filter-bar__primary {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 180px 150px auto auto auto;
    align-items: center;
    gap: 8px;
}

.filter-keyword {
    min-width: 0;
}

.filter-compact {
    min-width: 0;
}

.filter-compact--narrow {
    min-width: 0;
}

.select-summary-text {
    font-size: 13px;
    color: #1f2937;
}

.filter-toggle-btn {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
}

.filter-toggle-count {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    font-weight: 700;
}

.filter-reset-btn {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;
    color: #334155 !important;
    border-color: #94a3b8 !important;
    background: #ffffff;
}

.filter-reset-btn:disabled {
    color: #cbd5e1 !important;
    border-color: #e2e8f0 !important;
}

.filter-bar__advanced {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed #e5e7eb;
}

.advanced-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
}

.advanced-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.advanced-field--wide {
    grid-column: span 2;
}

.advanced-label {
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    letter-spacing: 0.02em;
}

.results-summary {
    margin: 4px 2px 12px;
    font-size: 12px;
    color: #6b7280;
}

.results-summary b {
    color: #ef5350;
    font-weight: 700;
}

.results-meta {
    margin-left: 8px;
    color: #94a3b8;
    font-size: 11px;
}

.empty-text-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
}

.empty-hint {
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.6;
}

.state-area {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 24px;
    color: #6b7280;
    font-size: 13px;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px dashed #e5e7eb;
}

.state-area--error {
    color: #b91c1c;
    background: #fef2f2;
    border-color: #fecaca;
}

.state-text {
    font-size: 13px;
}

.pi-flag-table :deep(th) {
    background: #f8fafc;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
}

.pi-flag-table :deep(td) {
    font-size: 12px;
    color: #1f2937;
    height: auto !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
    white-space: normal;
    vertical-align: top;
}

.pi-flag-table :deep(tr.v-data-table__tr) {
    height: auto !important;
}

.pi-flag-expanded-row .pi-flag-expanded-cell {
    padding: 0 !important;
    background: #f8fafc;
}

.child-diff-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
}

.child-diff-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    padding: 8px 0 14px;
    background: transparent;
    border-bottom: 1px solid #e5e7eb;
}

.child-diff-row:last-child {
    padding-bottom: 8px;
    border-bottom: 0;
}

.child-diff-main {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    flex: 1 1 auto;
}

.child-diff-task {
    display: flex;
    align-items: center;
    min-width: 0;
}

.child-diff-description {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.5;
    color: #1f2937;
    word-break: break-all;
}

.child-diff-description-text {
    min-width: 0;
}

.child-diff-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex: 0 0 220px;
}

.child-diff-kind {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 4px;
}

.child-diff-type-text {
    font-size: 12px;
    line-height: 1.5;
    color: #475569;
}

.task-link-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
}

.task-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    max-width: 100%;
    color: #1f2937;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.45;
}

.task-link-label {
    flex: 0 0 auto;
    padding: 2px 6px;
    border-radius: 3px;
    background: #eef0f2;
    color: #64748b;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.4;
}

.task-link-text {
    min-width: 0;
    word-break: break-all;
}

.child-diff-meta {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
}

.cell-status-summary,
.cell-type-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
}

.expand-toggle-cell {
    display: flex;
    justify-content: flex-end;
}

.cell-domain {
    font-weight: 500;
    color: #475569;
}

.cell-process-link {
    color: #1d4ed8;
    cursor: pointer;
    text-decoration: none;
}

.cell-process-link:hover {
    text-decoration: none;
}

.cell-element {
    display: inline-block;
    max-width: 240px;
    white-space: normal;
    word-break: break-all;
    line-height: 1.5;
    vertical-align: top;
    color: #334155;
}

.cell-group-members {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-width: 240px;
}

.cell-group-member {
    max-width: 100%;
}

.cell-type {
    color: #475569;
    font-size: 12px;
}

.cell-description {
    display: inline-block;
    max-width: 210px;
    white-space: normal;
    word-break: break-all;
    line-height: 1.5;
    vertical-align: top;
    color: #1f2937;
}

.cell-author {
    color: #475569;
}

.cell-date {
    font-family: 'Roboto Mono', monospace;
    color: #6b7280;
}

@media (max-width: 1100px) {
    .summary-cards {
        grid-template-columns: repeat(2, minmax(132px, 1fr));
    }

    .filter-bar__primary {
        grid-template-columns: minmax(240px, 1fr) 180px 150px;
    }

    .filter-toggle-btn,
    .filter-reset-btn {
        justify-self: start;
    }

    .section-actions {
        grid-column: 1 / -1;
        justify-self: end;
    }

    .advanced-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .advanced-field--wide {
        grid-column: span 2;
    }

    .child-diff-list {
        padding-left: 16px;
    }

    .child-diff-row {
        flex-direction: column;
    }

    .child-diff-side {
        align-items: flex-start;
        flex-basis: auto;
        width: 100%;
    }

    .child-diff-kind {
        text-align: left;
    }
}

@media (max-width: 720px) {
    .summary-cards {
        grid-template-columns: 1fr 1fr;
    }

    .filter-bar__primary {
        grid-template-columns: 1fr;
    }

    .section-actions {
        grid-column: auto;
        justify-self: start;
    }

    .advanced-grid {
        grid-template-columns: 1fr;
    }

    .advanced-field--wide {
        grid-column: span 1;
    }

    .filter-keyword {
        flex: 1 1 100%;
    }

    .child-diff-meta {
        white-space: normal;
    }
}
</style>
