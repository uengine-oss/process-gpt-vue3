<template>
    <v-dialog :model-value="modelValue" max-width="1200" @update:model-value="$emit('update:modelValue', $event)">
        <v-card>
            <div class="d-flex align-center pr-2">
                <v-card-title class="text-h6">{{ $t('raci.matrixTitle') || 'RACI 통합 매트릭스' }}</v-card-title>
                <span class="raci-legend">{{ $t('raci.legend') || 'R=책임(수행) · A=승인 · S=지원 · C=자문 · I=통보' }}</span>
                <v-btn icon variant="plain" class="ml-auto cp-raci-close" @click="$emit('update:modelValue', false)">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </div>
            <v-card-text style="overflow: auto; max-height: calc(100vh - 180px)">
                <div v-if="!isViewMode" class="d-flex align-center flex-wrap mb-3">
                    <v-combobox
                        v-model="newOrg"
                        :items="orgSuggestions"
                        :label="$t('raci.addOrg') || '조직/역할 추가'"
                        :placeholder="$t('raci.orgPlaceholder') || '조직/역할 이름'"
                        density="compact"
                        variant="outlined"
                        hide-details
                        style="max-width: 280px"
                        @keydown.enter="onOrgEnter"
                    />
                    <v-btn size="small" color="primary" variant="tonal" class="ml-2 cp-raci-add-org" @click="addOrg">
                        {{ $t('raci.add') || '추가' }}
                    </v-btn>
                    <span class="raci-hint ml-4">{{ $t('raci.cellHint') || '셀을 클릭하면 공백→R→A→S→C→I 순으로 바뀝니다.' }}</span>
                </div>
                <div style="overflow-x: auto">
                    <table class="raci-matrix">
                        <thead>
                            <tr>
                                <th class="raci-th raci-th-task">{{ $t('raci.task') || 'Task' }}</th>
                                <th class="raci-th raci-th-lane">{{ $t('raci.role') || '역할(레인)' }}</th>
                                <th v-for="org in orgs" :key="org" class="raci-th raci-th-org">
                                    <div class="d-flex align-center justify-center">
                                        <span>{{ org }}</span>
                                        <v-icon
                                            v-if="!isViewMode && isOrgEmpty(org)"
                                            size="14"
                                            class="ml-1"
                                            style="cursor: pointer"
                                            @click.stop="removeOrg(org)"
                                            >mdi-close</v-icon
                                        >
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in rows" :key="row.id">
                                <td class="raci-td raci-td-task">{{ row.name }}</td>
                                <td class="raci-td raci-td-lane">{{ row.laneName }}</td>
                                <td
                                    v-for="org in orgs"
                                    :key="org"
                                    class="raci-td raci-cell"
                                    :class="[cellClass(row, org), { 'raci-cell-editable': !isViewMode }]"
                                    @click="onCellClick(row, org)"
                                >
                                    {{ cellValue(row, org) }}
                                </td>
                            </tr>
                            <tr v-if="rows.length === 0">
                                <td class="raci-td text-center" :colspan="orgs.length + 2">
                                    {{ $t('raci.noTasks') || '표시할 태스크가 없습니다.' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script>
import { useBpmnStore } from '@/stores/bpmn';
import { readUengineProperties, writeUengineProperties } from '@/utils/bpmnUengineProperties';

const RACI_KEYS = ['R', 'A', 'S', 'C', 'I'];

export default {
    name: 'raci-matrix-dialog',
    props: {
        modelValue: Boolean,
        isViewMode: Boolean,
        processDefinition: Object
    },
    // changed: 셀 편집이 모델러에 반영될 때마다 — 호스트가 닫힘 시점 영구 저장 여부를 판단하는 데 쓴다
    emits: ['update:modelValue', 'changed'],
    data() {
        return {
            rows: [],
            orgs: [],
            laneNames: [],
            newOrg: ''
        };
    },
    computed: {
        orgSuggestions() {
            return this.laneNames.filter((name) => !this.orgs.includes(name));
        }
    },
    watch: {
        modelValue(open) {
            if (open) this.build();
        }
    },
    methods: {
        getModeler() {
            return useBpmnStore().getModeler;
        },
        build() {
            this.rows = [];
            this.orgs = [];
            this.laneNames = [];
            this.newOrg = '';

            const modeler = this.getModeler();
            if (!modeler) return;
            const elementRegistry = modeler.get('elementRegistry');
            const all = elementRegistry.getAll();

            // 레인 이름 및 태스크 -> 레인 매핑 (bpmn-js가 flowNodeRef를 지오메트리 기준으로 유지)
            const laneByTaskId = {};
            all.filter((el) => el.type === 'bpmn:Lane').forEach((laneEl) => {
                const laneName = laneEl.businessObject?.name || '';
                if (laneName && !this.laneNames.includes(laneName)) this.laneNames.push(laneName);
                (laneEl.businessObject?.flowNodeRef || []).forEach((flowNode) => {
                    laneByTaskId[flowNode.id] = laneName;
                });
            });

            const taskElements = all.filter((el) => el.type && el.type.includes('Task'));
            const rows = taskElements.map((el) => {
                const props = readUengineProperties(el.businessObject);
                return {
                    id: el.id,
                    name: el.businessObject?.name || el.id,
                    // 행 식별자는 Task명 — taskCode는 화면에 노출하지 않고 정렬 근거로만 쓴다
                    taskCode: props.taskCode || '',
                    laneName: laneByTaskId[el.id] || '',
                    raci: this.normalizeRaci(props.raci),
                    x: el.x || 0,
                    y: el.y || 0
                };
            });

            // 정렬: 모든 태스크에 taskCode가 있으면 코드 자연순, 아니면 좌표(흐름 근사) 순
            const allHaveCode = rows.length > 0 && rows.every((r) => r.taskCode);
            if (allHaveCode) {
                rows.sort((a, b) => a.taskCode.localeCompare(b.taskCode, undefined, { numeric: true }));
            } else {
                rows.sort((a, b) => a.x - b.x || a.y - b.y);
            }
            this.rows = rows;

            // 열: raci에 등장하는 조직명을 등장 순서대로
            const orgs = [];
            rows.forEach((row) => {
                RACI_KEYS.forEach((key) => {
                    row.raci[key].forEach((org) => {
                        if (org && !orgs.includes(org)) orgs.push(org);
                    });
                });
            });
            this.orgs = orgs;
        },
        normalizeRaci(value) {
            const out = { R: [], A: [], S: [], C: [], I: [] };
            if (value && typeof value === 'object') {
                RACI_KEYS.forEach((key) => {
                    if (Array.isArray(value[key])) out[key] = value[key].filter(Boolean);
                    else if (typeof value[key] === 'string' && value[key]) out[key] = [value[key]];
                });
            }
            return out;
        },
        cellLetters(row, org) {
            return RACI_KEYS.filter((key) => row.raci[key].includes(org));
        },
        cellValue(row, org) {
            return this.cellLetters(row, org).join(',');
        },
        cellClass(row, org) {
            const letters = this.cellLetters(row, org);
            return letters.length === 1 ? `raci-cell-${letters[0]}` : letters.length > 1 ? 'raci-cell-multi' : '';
        },
        isOrgEmpty(org) {
            return !this.rows.some((row) => this.cellLetters(row, org).length > 0);
        },
        // Enter 시 콤보박스가 입력 텍스트를 modelValue로 커밋한 뒤에 추가한다
        onOrgEnter() {
            this.$nextTick(() => this.addOrg());
        },
        addOrg() {
            const name = (this.newOrg || '').toString().trim();
            if (!name) return;
            if (!this.orgs.includes(name)) this.orgs.push(name);
            this.newOrg = '';
        },
        removeOrg(org) {
            if (!this.isOrgEmpty(org)) return;
            this.orgs = this.orgs.filter((o) => o !== org);
        },
        onCellClick(row, org) {
            if (this.isViewMode) return;
            const present = this.cellLetters(row, org);
            let next;
            if (present.length > 1) {
                next = null; // 복수 지정 셀은 먼저 비운다
            } else if (present.length === 0) {
                next = 'R';
            } else {
                const idx = RACI_KEYS.indexOf(present[0]);
                next = idx === RACI_KEYS.length - 1 ? null : RACI_KEYS[idx + 1];
            }
            RACI_KEYS.forEach((key) => {
                row.raci[key] = row.raci[key].filter((name) => name !== org);
            });
            if (next) row.raci[next].push(org);
            this.persistRow(row);
        },
        persistRow(row) {
            const cleaned = {};
            let empty = true;
            RACI_KEYS.forEach((key) => {
                cleaned[key] = [...row.raci[key]];
                if (cleaned[key].length > 0) empty = false;
            });
            const raci = empty ? null : cleaned;

            writeUengineProperties(this.getModeler(), row.id, { raci });

            // 패널 재오픈 시 stale 값으로 되돌아가지 않도록 processDefinition.activities에도 동기화
            if (this.processDefinition && Array.isArray(this.processDefinition.activities)) {
                const targetActivity = this.processDefinition.activities.find((activity) => activity.id === row.id);
                if (targetActivity) targetActivity.raci = raci;
            }

            this.$emit('changed');
        }
    }
};
</script>

<style scoped>
.raci-legend {
    font-size: 11px;
    color: var(--cds-text-secondary, rgba(0, 0, 0, 0.6));
    white-space: nowrap;
}
.raci-hint {
    font-size: 11px;
    color: var(--cds-text-secondary, rgba(0, 0, 0, 0.6));
}
.raci-matrix {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
}
.raci-matrix th,
.raci-matrix td {
    border: 1px solid var(--cds-border-1, rgba(0, 0, 0, 0.12));
    padding: 6px 10px;
}
.raci-th {
    background-color: var(--cds-surface-2, rgba(0, 0, 0, 0.04));
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 1;
}
.raci-td-task {
    min-width: 180px;
}
.raci-td-lane {
    white-space: nowrap;
    text-align: center;
    color: var(--cds-text-secondary, rgba(0, 0, 0, 0.6));
}
.raci-cell {
    text-align: center;
    min-width: 64px;
    font-weight: 700;
    user-select: none;
}
.raci-cell-editable {
    cursor: pointer;
}
.raci-cell-editable:hover {
    outline: 2px solid rgba(var(--v-theme-primary), 0.4);
    outline-offset: -2px;
}
.raci-cell-R {
    background-color: rgba(211, 47, 47, 0.12);
    color: #c62828;
}
.raci-cell-A {
    background-color: rgba(48, 63, 159, 0.12);
    color: #283593;
}
.raci-cell-S {
    background-color: rgba(46, 125, 50, 0.12);
    color: #2e7d32;
}
.raci-cell-C {
    background-color: rgba(239, 108, 0, 0.12);
    color: #e65100;
}
.raci-cell-I {
    background-color: rgba(97, 97, 97, 0.12);
    color: #616161;
}
.raci-cell-multi {
    background-color: rgba(123, 31, 162, 0.12);
    color: #6a1b9a;
}
</style>
