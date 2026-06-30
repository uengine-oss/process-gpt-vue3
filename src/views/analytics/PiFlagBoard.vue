<template>
    <UiParentCard :title="$t('piFlagBoard.title') || 'PI Flag 모아보기'" class="pi-flag-board">
        <!-- 헤더 우측 액션: 통계 칩 + 새로고침 -->
        <template #action>
            <div class="d-flex align-center">
                <v-chip size="small" variant="tonal" class="mr-2">{{ $t('piFlagBoard.total') || '전체' }} {{ rows.length }}</v-chip>
                <v-chip size="small" color="success" variant="tonal" class="mr-2">
                    {{ $t('piFlagPanel.statusOpen') || '향후 과제' }} {{ openCount }}
                </v-chip>
                <v-chip size="small" color="error" variant="tonal" class="mr-2">
                    {{ $t('piFlagPanel.statusResolved') || '즉시 개선' }} {{ resolvedCount }}
                </v-chip>
                <v-tooltip :text="$t('piFlagBoard.refresh') || '새로고침'" location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn v-bind="props" icon variant="text" size="small" :loading="loading" @click="loadBoard">
                            <v-icon>mdi-refresh</v-icon>
                        </v-btn>
                    </template>
                </v-tooltip>
            </div>
        </template>

        <!-- 필터 바 -->
        <v-row dense class="mb-2">
            <v-col cols="12" md="4">
                <v-text-field
                    v-model="filters.keyword"
                    label="사유·태스크·프로세스·작성자 검색"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                    prepend-inner-icon="mdi-magnify"
                ></v-text-field>
            </v-col>
            <v-col cols="6" md="2">
                <v-select
                    v-model="filters.status"
                    :items="statusOptions"
                    item-title="label"
                    item-value="value"
                    :label="$t('piFlagPanel.statusLabel') || '상태'"
                    density="compact"
                    variant="outlined"
                    hide-details
                ></v-select>
            </v-col>
            <v-col cols="6" md="3">
                <v-select
                    v-model="filters.type"
                    :items="typeOptions"
                    :label="$t('piFlagPanel.typeLabel') || '유형'"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                ></v-select>
            </v-col>
            <v-col cols="12" md="3">
                <v-select
                    v-model="filters.process"
                    :items="processOptions"
                    :label="$t('piFlagBoard.process') || '프로세스'"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                ></v-select>
            </v-col>
        </v-row>

        <div class="text-caption text-medium-emphasis mb-1">
            검색 결과 <b>{{ groupedRows.length }}</b
            >개 프로세스 / PI Flag {{ filteredRows.length }}건 / 전체 {{ rows.length }}건
        </div>

        <!-- 에러 -->
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-2">{{ error }}</v-alert>

        <!-- 테이블 -->
        <v-data-table
            class="pi-flag-board-table"
            density="compact"
            :headers="headers"
            :items="groupedRows"
            v-model:expanded="expandedProcessRows"
            item-value="uniqueKey"
            :loading="loading"
            :items-per-page="20"
            show-expand
        >
            <template v-slot:[`item.process`]="{ item }">
                <span class="cell-link" @click.stop="goToProcess(item)">{{ item.procDefName }}</span>
            </template>

            <template v-slot:[`item.element`]="{ item }">
                <span class="cell-multiline">{{ item.taskCount }}개 태스크 / {{ item.flagCount }}건</span>
            </template>

            <template v-slot:[`item.status`]="{ item }">
                <div class="cell-status-summary">
                    <v-chip v-if="item.resolvedCount > 0" size="small" variant="tonal" color="error">
                        <v-icon start size="14">mdi-flag</v-icon>
                        {{ $t('piFlagPanel.statusResolved') || '즉시 개선' }} {{ item.resolvedCount }}
                    </v-chip>
                    <v-chip v-if="item.openCount > 0" size="small" variant="tonal" color="success">
                        <v-icon start size="14">mdi-flag</v-icon>
                        {{ $t('piFlagPanel.statusOpen') || '향후 과제' }} {{ item.openCount }}
                    </v-chip>
                </div>
            </template>

            <template v-slot:[`item.type`]="{ item }">
                <div class="cell-type-list">
                    <span v-for="type in item.types" :key="`${item.uniqueKey}-type-${type}`" class="cell-type">{{ type }}</span>
                    <span v-if="item.types.length === 0" class="cell-type">-</span>
                </div>
            </template>

            <template v-slot:[`item.description`]="{ item }">
                <span class="cell-multiline">{{ item.description }}</span>
            </template>

            <template v-slot:[`item.createdAt`]="{ item }">
                <span class="cell-date">{{ formatDate(item.createdAt) }}</span>
            </template>

            <template v-slot:[`item.data-table-expand`]="{ internalItem, isExpanded, toggleExpand }">
                <div class="expand-toggle-cell">
                    <v-btn icon variant="text" density="compact" size="x-small" @click.stop="toggleExpand(internalItem)">
                        <v-icon size="18">{{ isExpanded(internalItem) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
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
                                            <span class="task-link-text">{{ child.elementNames[0] }}</span>
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
                                            {{
                                                child.status === 'resolved'
                                                    ? $t('piFlagPanel.statusResolved') || '즉시 개선'
                                                    : $t('piFlagPanel.statusOpen') || '향후 과제'
                                            }}
                                        </v-chip>
                                        <span v-if="child.type" class="child-diff-type-text">{{ child.type }}</span>
                                    </div>
                                    <div class="child-diff-meta">
                                        {{ child.authorName || $t('piFlagPanel.unknownAuthor') || '익명' }} ·
                                        {{ formatDate(child.createdAt) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            </template>

            <template v-slot:no-data>
                <div class="text-center pa-6 text-medium-emphasis">
                    <v-icon size="32" color="grey-lighten-2">mdi-flag-outline</v-icon>
                    <div class="text-caption mt-1">{{ $t('piFlagBoard.empty') || '등록된 PI Flag가 없습니다' }}</div>
                </div>
            </template>
        </v-data-table>
    </UiParentCard>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import UiParentCard from '@/components/shared/UiParentCard.vue';

export default {
    name: 'PiFlagBoard',
    components: { UiParentCard },
    data() {
        return {
            backend: null,
            loading: false,
            error: '',
            rows: [],
            expandedProcessRows: [],
            filters: {
                keyword: '',
                status: 'all',
                type: null,
                process: null
            }
        };
    },
    computed: {
        headers() {
            return [
                { title: this.$t('piFlagBoard.process') || '프로세스', key: 'process', width: 180 },
                { title: '태스크', key: 'element', width: 180, sortable: false },
                { title: this.$t('piFlagPanel.statusLabel') || '상태', key: 'status', width: 120 },
                { title: this.$t('piFlagPanel.typeLabel') || '유형', key: 'type', width: 120 },
                { title: this.$t('piFlagPanel.reasonLabel') || '사유', key: 'description', sortable: false },
                { title: '', key: 'data-table-expand', sortable: false, width: 56, align: 'end' }
            ];
        },
        statusOptions() {
            return [
                { label: this.$t('piFlagBoard.all') || '전체', value: 'all' },
                { label: this.$t('piFlagPanel.statusOpen') || '향후 과제', value: 'open' },
                { label: this.$t('piFlagPanel.statusResolved') || '즉시 개선', value: 'resolved' }
            ];
        },
        typeOptions() {
            return [...new Set(this.rows.map((r) => r.type).filter(Boolean))].sort();
        },
        processOptions() {
            return [...new Set(this.rows.map((r) => r.procDefName).filter(Boolean))].sort();
        },
        openCount() {
            return this.rows.filter((r) => r.status !== 'resolved').length;
        },
        resolvedCount() {
            return this.rows.filter((r) => r.status === 'resolved').length;
        },
        filteredRows() {
            const kw = (this.filters.keyword || '').trim().toLowerCase();
            return this.rows.filter((r) => {
                if (this.filters.status !== 'all') {
                    const st = r.status === 'resolved' ? 'resolved' : 'open';
                    if (st !== this.filters.status) return false;
                }
                if (this.filters.type && r.type !== this.filters.type) return false;
                if (this.filters.process && r.procDefName !== this.filters.process) return false;
                if (kw) {
                    const hay = [r.description, r.procDefName, r.authorName, r.type, ...(r.elementNames || [])].join(' ').toLowerCase();
                    if (!hay.includes(kw)) return false;
                }
                return true;
            });
        },
        groupedRows() {
            const grouped = new Map();
            this.filteredRows.forEach((row) => {
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
                        (row.elementNames || []).forEach((name) => {
                            if (name) taskKeys.add(name);
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
                        elementNames: [`${taskKeys.size}개 태스크`],
                        taskCount: taskKeys.size,
                        flagCount: children.length,
                        status: resolvedCount > 0 && openCount === 0 ? 'resolved' : 'open',
                        resolvedCount,
                        openCount,
                        type: types.join(', '),
                        types,
                        description: descriptionSummary,
                        authorName: first.authorName || '',
                        createdAt: first.createdAt || '',
                        children
                    };
                })
                .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        }
    },
    mounted() {
        this.backend = BackendFactory.createBackend();
        this.loadBoard();
    },
    methods: {
        async loadBoard() {
            this.loading = true;
            this.error = '';
            try {
                const defs = await this.backend.listDefinition('', { match: { tenant_id: window.$tenantName } });
                const rows = [];
                (defs || []).forEach((def) => {
                    const xml = def?.bpmn;
                    if (!xml || typeof xml !== 'string') return;
                    // PI Flag 가 없는 정의는 건너뛰기 (probe) — comments JSON 키 존재 여부로 판정
                    // (저장 시 uengine:Properties → uengine:properties 로 케이스가 바뀌므로 요소명 토큰은 쓰지 않음)
                    if (!xml.includes('comments')) return;
                    const procName = def.name || def.id;
                    rows.push(...this.parsePiFlags(xml, def.id, procName));
                });
                this.rows = rows;
            } catch (e) {
                console.error('[PiFlagBoard] load 실패:', e);
                this.error = this.$t('piFlagBoard.loadFailed') || 'PI Flag 데이터를 불러오지 못했습니다.';
            } finally {
                this.loading = false;
            }
        },
        // 하나의 프로세스 XML 에서 PI Flag 추출 → groupId 로 묶어 행 생성
        parsePiFlags(xml, procDefId, procDefName) {
            const result = [];
            let doc;
            try {
                doc = new DOMParser().parseFromString(xml, 'application/xml');
            } catch (e) {
                return result;
            }

            const lower = (name) => (name || '').toLowerCase();
            const all = doc.getElementsByTagName('*');
            // commentKey(groupId||id) -> { comment, elementNames:Set }
            const groups = new Map();
            const ungrouped = [];

            for (let i = 0; i < all.length; i++) {
                const el = all[i];
                if (lower(el.localName || el.nodeName) !== 'properties') continue;
                // 저장 전(json 속성) / 저장 후(<uengine:json> 자식 요소) 두 형식 모두 지원
                const json = this.extractPropsJson(el);
                if (!json) continue;
                let parsed;
                try {
                    parsed = JSON.parse(json);
                } catch (e) {
                    continue;
                }
                if (!Array.isArray(parsed.comments) || !parsed.comments.length) continue;

                // 이 properties 가 속한 BPMN 요소(이름/ id) 찾기: extensionElements 의 부모
                const owner = this.findOwnerElement(el);
                const elementName = (owner && (owner.getAttribute('name') || owner.getAttribute('id'))) || '';

                parsed.comments.forEach((c) => {
                    if (!c) return;
                    const key = c.groupId || c.id;
                    if (c.groupId) {
                        if (!groups.has(key)) groups.set(key, { comment: c, names: new Set() });
                        if (elementName) groups.get(key).names.add(elementName);
                    } else {
                        ungrouped.push({ comment: c, name: elementName });
                    }
                });
            }

            groups.forEach((g) => {
                result.push(this.toRow(procDefId, procDefName, g.comment, [...g.names]));
            });
            ungrouped.forEach((u) => {
                result.push(this.toRow(procDefId, procDefName, u.comment, u.name ? [u.name] : ['-']));
            });
            return result;
        },
        // uengine:properties 에서 json 문자열 추출 — json 속성(저장 전) 또는 <uengine:json> 자식 요소(저장 후)
        extractPropsJson(propsEl) {
            const attr = propsEl.getAttribute && propsEl.getAttribute('json');
            if (attr) return attr;
            const children = propsEl.childNodes || [];
            for (let i = 0; i < children.length; i++) {
                const c = children[i];
                if (c.nodeType === 1 && (c.localName || c.nodeName || '').toLowerCase().replace(/^.*:/, '') === 'json') {
                    return c.textContent;
                }
            }
            return null;
        },
        // properties 요소에서 위로 올라가 BPMN 요소(extensionElements 의 부모)를 찾음
        findOwnerElement(propsEl) {
            let node = propsEl.parentNode;
            while (node && node.localName) {
                if ((node.localName || '').toLowerCase() === 'extensionelements') {
                    return node.parentNode;
                }
                node = node.parentNode;
            }
            return null;
        },
        toRow(procDefId, procDefName, c, elementNames) {
            return {
                uniqueKey: `${procDefId}:${c.groupId || c.id}`,
                procDefId,
                procDefName,
                elementNames: elementNames.length ? elementNames : ['-'],
                isGrouped: elementNames.length > 1,
                status: c.status === 'resolved' ? 'resolved' : 'open',
                type: c.type || '',
                description: c.description || '',
                authorName: c.authorName || this.$t('piFlagPanel.unknownAuthor') || '익명',
                createdAt: c.createdAt || ''
            };
        },
        goToProcess(item) {
            if (!item?.procDefId) return;
            this.$router.push(`/definitions/${item.procDefId}`);
        },
        formatDate(iso) {
            if (!iso) return '';
            try {
                const d = new Date(iso);
                if (isNaN(d.getTime())) return '';
                const pad = (n) => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            } catch (e) {
                return '';
            }
        }
    }
};
</script>

<style scoped>
/* 다른 페이지처럼 세로로 가득 차게 (UiParentCard 루트 = v-card) */
.pi-flag-board {
    height: calc(100vh - 132px);
    display: flex;
    flex-direction: column;
}
.pi-flag-board :deep(.v-card-text) {
    flex: 1 1 auto;
    overflow: auto;
}

/* PI Flag Board 테이블 톤 (참조 pi-system 디자인 인용) */
.pi-flag-board-table :deep(thead th) {
    background: #f8fafc !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #374151 !important;
}

.pi-flag-board-table :deep(tbody td) {
    font-size: 12px !important;
    color: #1f2937;
    vertical-align: top;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
}

.pi-flag-board-table :deep(tbody tr) {
    cursor: default;
}

.cell-link {
    color: #1976d2;
    cursor: pointer;
    text-decoration: none;
}

.cell-date {
    font-variant-numeric: tabular-nums;
    color: #6b7280;
}
.cell-multiline {
    display: inline-block;
    max-width: 320px;
    white-space: pre-wrap;
    word-break: break-word;
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

.child-diff-meta {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
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

.cell-status-summary,
.cell-type-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
}

.cell-type {
    color: #475569;
    font-size: 12px;
}

.expand-toggle-cell {
    display: flex;
    justify-content: flex-end;
}

@media (max-width: 1100px) {
    .child-diff-row {
        flex-direction: column;
    }

    .child-diff-side {
        align-items: flex-start;
        flex-basis: auto;
        width: 100%;
    }

    .child-diff-kind {
        justify-content: flex-start;
    }
}

@media (max-width: 720px) {
    .child-diff-meta {
        white-space: normal;
    }
}
</style>
