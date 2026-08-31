<template>
    <v-card elevation="10" class="rounded-xl sk-page-card">
        <!-- Header -->
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">업무분장</h1>
            </div>
        </div>

        <!-- 검색 + 단계 칩 필터 -->
        <div class="d-flex flex-wrap align-center px-4 pt-3" style="gap: 12px;">
            <v-text-field
                v-model="processSearchKeyword"
                placeholder="프로세스 이름 검색"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                style="max-width: 240px;"
            />
            <div class="d-flex flex-wrap align-center" style="gap: 6px;">
                <v-chip
                    v-for="opt in stageOptions"
                    :key="opt.value"
                    :variant="selectedStage === opt.value ? 'tonal' : 'outlined'"
                    size="small"
                    @click="selectedStage = opt.value"
                >
                    <v-icon start size="14">{{ opt.icon }}</v-icon>
                    {{ opt.label }} ({{ stageCounts[opt.value] }})
                </v-chip>
            </div>
        </div>

        <v-card-text class="pa-4 sk-page-card-text">
            <!-- Error Alert -->
            <v-alert
                v-if="workAssignmentError"
                type="error"
                density="compact"
                variant="tonal"
                class="mb-3"
                closable
                @click:close="workAssignmentError = ''"
            >
                {{ workAssignmentError }}
            </v-alert>

            <!-- Data Table (프로세스 단위 행, 펼치면 lane 상세) -->
            <v-data-table
                :headers="workAssignmentProcessHeaders"
                :items="workAssignmentProcessGroups"
                :loading="workAssignmentLoading"
                :expanded="expandedProcessIds"
                no-data-text="published 상태의 프로세스가 없습니다."
                density="compact"
                hover
                show-expand
                :items-per-page="25"
                :items-per-page-options="[25, 50, 100, 200]"
                item-value="processDefId"
                class="sk-data-table"
                @update:expanded="expandedProcessIds = $event"
            >
                <template v-slot:[`item.data-table-expand`]="{ internalItem, toggleExpand, isExpanded }">
                    <v-btn
                        :icon="isExpanded(internalItem) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                        size="x-small"
                        variant="text"
                        @click="toggleExpand(internalItem)"
                    />
                </template>

                <template v-slot:[`item.processName`]="{ item }">
                    <div class="d-flex align-center">
                        <v-icon size="16" class="me-2" color="primary">mdi-flowchart</v-icon>
                        <a
                            href="#"
                            class="font-weight-medium work-assignment-process-link"
                            @click.prevent.stop="goToProcess(item.processDefId, item.processName)"
                        >
                            {{ item.processName }}
                        </a>
                    </div>
                </template>

                <template v-slot:[`item.stage`]="{ item }">
                    <ProgressBadge
                        v-if="item.stage"
                        type="status"
                        :status="item.stage"
                        size="small"
                    />
                </template>

                <template v-slot:[`item.location`]="{ item }">
                    <span
                        v-if="procLocationByDefId[item.processDefId]"
                        class="text-body-2 text-medium-emphasis"
                    >
                        {{ procLocationByDefId[item.processDefId].megaName }}
                        &rsaquo;
                        {{ procLocationByDefId[item.processDefId].majorName }}
                    </span>
                    <span v-else class="text-body-2 text-medium-emphasis">
                        계층도 미등록 프로세스
                    </span>
                </template>

                <template v-slot:[`item.laneCount`]="{ item }">
                    <v-chip size="x-small" variant="tonal">{{ item.lanes.length }}개 레인</v-chip>
                </template>

                <template v-slot:[`expanded-row`]="{ columns, item }">
                    <tr class="work-assignment-expanded-row">
                        <td :colspan="columns.length" class="work-assignment-expanded-cell">
                            <v-table density="compact" class="work-assignment-lane-table">
                                <thead>
                                    <tr>
                                        <th class="text-start" style="min-width: 180px;">본부/팀</th>
                                        <th class="text-start" style="min-width: 160px;">담당자</th>
                                        <th class="text-start" style="min-width: 140px;">레인</th>
                                        <th class="text-start" style="min-width: 220px;">상세업무 설명</th>
                                        <th class="text-start" style="min-width: 140px;">비고</th>
                                        <th class="text-end" style="width: 56px;"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="lane in item.lanes" :key="lane.rowId">
                                        <td>
                                            <template v-if="lane.team">
                                                <template v-if="lane.division">{{ lane.division }} / {{ lane.team }}</template>
                                                <template v-else>{{ lane.team }}</template>
                                            </template>
                                            <template v-else>-</template>
                                        </td>
                                        <td>
                                            <div v-if="lane.assignees && lane.assignees.length > 0" class="d-flex flex-wrap" style="gap: 4px;">
                                                <v-chip
                                                    v-for="(assignee, idx) in lane.assignees"
                                                    :key="(assignee.email || assignee.label || '') + idx"
                                                    size="x-small"
                                                    variant="tonal"
                                                    color="primary"
                                                >
                                                    {{ assignee.label || assignee.name || assignee.email }}
                                                </v-chip>
                                            </div>
                                            <span v-else class="text-medium-emphasis">-</span>
                                        </td>
                                        <td>{{ lane.laneName || '-' }}</td>
                                        <td>{{ lane.taskSummary || '-' }}</td>
                                        <td>{{ lane.remark || '-' }}</td>
                                        <!-- 레인 정보 수정 버튼 — 라인별 담당자 매핑 정책 정리 전까지 숨김 (조회만 가능) -->
                                        <!-- <td class="text-end">
                                            <v-btn
                                                icon="mdi-pencil-outline"
                                                size="x-small"
                                                variant="text"
                                                title="레인 정보 수정"
                                                @click="openAssigneeEditDialog(lane)"
                                            />
                                        </td> -->
                                    </tr>
                                </tbody>
                            </v-table>
                        </td>
                    </tr>
                </template>
            </v-data-table>
        </v-card-text>

        <!-- Lane Edit Dialog -->
        <v-dialog v-model="assigneeDialogVisible" width="60%" persistent>
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon color="primary" class="me-2">mdi-account-multiple-plus-outline</v-icon>
                    레인 정보 수정
                </v-card-title>
                <v-divider />

                <div class="px-4 pt-4 pb-2">
                    <div v-if="assigneeDialogTarget" class="mb-3">
                        <div class="text-caption text-medium-emphasis">프로세스</div>
                        <div class="font-weight-medium">{{ assigneeDialogTarget.processName }}</div>
                        <div class="text-caption text-medium-emphasis mt-1">레인</div>
                        <div>{{ assigneeDialogTarget.laneName || assigneeDialogTarget.laneId }}</div>
                    </div>

                    <v-autocomplete
                        v-model="assigneeDialogTeam"
                        v-model:search="assigneeDialogTeamSearchKeyword"
                        :items="assigneeDialogTeamSearchItems"
                        :loading="assigneeDialogTeamSearchLoading"
                        item-title="name"
                        item-value="id"
                        return-object
                        chips
                        closable-chips
                        density="compact"
                        variant="outlined"
                        hide-details
                        hide-no-data
                        clearable
                        label="팀"
                        placeholder="조직명으로 검색"
                        no-data-text="검색 결과가 없습니다."
                        :custom-filter="() => true"
                        @update:search="onTeamSearchInput"
                        @update:modelValue="onTeamSelected"
                    >
                        <template v-slot:item="{ item, props }">
                            <v-list-item v-bind="props">
                                <template v-slot:append>
                                    <v-chip v-if="item.raw.member_count != null" size="x-small" color="grey" variant="tonal">
                                        {{ item.raw.member_count }}명
                                    </v-chip>
                                </template>
                            </v-list-item>
                        </template>
                    </v-autocomplete>

                    <div
                        v-if="assigneeDialogTeam && (assigneeDialogTeamParentLoading || assigneeDialogTeamParentLoaded)"
                        class="text-caption text-medium-emphasis mt-1 mb-4 px-1"
                    >
                        <span v-if="assigneeDialogTeamParentLoading">본부 정보 조회 중…</span>
                        <span v-else-if="assigneeDialogTeamParent">본부: {{ assigneeDialogTeamParent.name }}</span>
                        <span v-else>본부 없음</span>
                    </div>
                    <div v-else class="mb-4" />

                    <v-autocomplete
                        v-model="assigneeDialogSelected"
                        v-model:search="assigneeDialogSearchKeyword"
                        :items="assigneeDialogSearchItems"
                        :loading="assigneeDialogSearchLoading"
                        item-title="label"
                        item-value="email"
                        return-object
                        multiple
                        chips
                        closable-chips
                        density="compact"
                        variant="outlined"
                        hide-details
                        hide-no-data
                        label="담당자"
                        :placeholder="assigneeSearchPlaceholder"
                        no-data-text="검색 결과가 없습니다."
                        :custom-filter="() => true"
                        class="mb-4"
                        @update:search="onAssigneeSearchInput"
                    />

                    <v-textarea
                        v-model="assigneeDialogRemark"
                        label="비고"
                        placeholder="이 레인에 대한 메모를 입력하세요"
                        rows="3"
                        auto-grow
                        density="compact"
                        variant="outlined"
                        hide-details
                    />
                </div>

                <v-divider />
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" :disabled="assigneeDialogSaving" @click="closeAssigneeEditDialog">취소</v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        :loading="assigneeDialogSaving"
                        @click="saveAssigneeEdit"
                    >
                        저장
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { toSafeText } from '@/utils/safeText';
import BackendFactory from '@/components/api/BackendFactory';
import { navigateToProcessHierarchy, PROCESS_HIERARCHY_ENTRY } from '@/views/process-hierarchy/navigation';
import { userIdentityFromSearchResult, formatIdentityWithTeam } from '@/utils/userIdentity';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';
import { STAGE_DEFS } from '@/utils/processStages';

const backend = BackendFactory.createBackend();

// ---------------- BPMN XML 헬퍼 (이 컴포넌트 전용, 외부 노출 없음) ----------------
function parseJsonSafe(input, fallback = {}) {
    if (!input || typeof input !== 'string') return fallback;
    try {
        return JSON.parse(input);
    } catch {
        return fallback;
    }
}

function bpmnLocalName(node) {
    return node.localName || node.nodeName.replace(/^.*:/, '');
}

function bpmnGetChildren(node) {
    return Array.from(node.children || []);
}

function bpmnGetAllDescendants(node) {
    return Array.from(node.getElementsByTagName('*'));
}

function bpmnGetUengineJson(node) {
    const ext = bpmnGetChildren(node).find((c) => bpmnLocalName(c) === 'extensionElements');
    if (!ext) return '';
    const props = Array.from(ext.getElementsByTagName('*')).find((c) => bpmnLocalName(c) === 'properties');
    if (!props) return '';
    const attr = props.getAttribute && props.getAttribute('json');
    if (attr) return attr;
    const jsonChild = Array.from(props.getElementsByTagName('*')).find((c) => bpmnLocalName(c) === 'json');
    return jsonChild?.textContent || '';
}

function bpmnParseUengineProps(node) {
    return parseJsonSafe(bpmnGetUengineJson(node), {});
}

// ---------------- 조직도 헬퍼 (legacy snapshot 본부 추정용 fallback) ----------------
function findOrgNodeById(node, targetId, parent = null) {
    if (!node) return null;
    const nodeId = node.id || node.data?.id;
    if (nodeId && String(nodeId) === String(targetId)) {
        return { node, parent };
    }
    const children = node.children || [];
    for (const child of children) {
        const found = findOrgNodeById(child, targetId, node);
        if (found) return found;
    }
    return null;
}

function resolveDivisionAndTeam(orgChart, organization) {
    const result = { division: '', team: '' };
    if (!organization || !orgChart) return result;

    const orgId = organization.id || organization.value;
    const orgName = toSafeText(organization.name || organization.label);

    const match = findOrgNodeById(orgChart, orgId);
    if (!match) {
        result.team = orgName;
        return result;
    }

    const teamNode = match.node;
    result.team = toSafeText(teamNode.data?.name || teamNode.name || orgName);

    let cursor = match.parent;
    let topDivision = null;
    while (cursor) {
        if (cursor.data?.isTeam) {
            topDivision = cursor;
        }
        const parentMatch = findOrgNodeById(orgChart, cursor.data?.pid || cursor.pid);
        cursor = parentMatch ? parentMatch.node : null;
        if (!cursor || cursor === orgChart) break;
    }
    if (topDivision && topDivision !== teamNode) {
        result.division = toSafeText(topDivision.data?.name || topDivision.name);
    }

    return result;
}

// ---------------- BPMN snapshot → lane 행 변환 (1 lane = 1 row) ----------------
function buildLaneRowsFromBpmn(xml, procDefId, procName, orgChart) {
    const rows = [];
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) return rows;

        const allElements = bpmnGetAllDescendants(doc.documentElement);
        const laneNodes = allElements.filter((n) => bpmnLocalName(n) === 'lane');

        laneNodes.forEach((laneNode) => {
            const props = bpmnParseUengineProps(laneNode);
            const laneId = laneNode.getAttribute('id') || '';
            const laneName = laneNode.getAttribute('name') || '';

            const orgList = Array.isArray(props.laneOrganization)
                ? props.laneOrganization
                : (props.laneOrganization ? [props.laneOrganization] : []);
            const userList = Array.isArray(props.laneAssignee)
                ? props.laneAssignee
                : (props.laneAssignee ? [props.laneAssignee] : []);

            let division = '';
            let team = '';
            let teamOrg = null;
            // 'parent' 키 자체 존재 여부 — 신규 저장본(키 있음, null/객체) vs legacy(키 자체 없음) 구분
            let parentResolved = false;
            if (orgList.length > 0 && orgList[0] && typeof orgList[0] === 'object') {
                const primary = orgList[0];
                team = toSafeText(primary.name || primary.label || '');
                parentResolved = 'parent' in primary;

                if (parentResolved) {
                    // 신규 저장본: snapshot 의 parent 직접 사용
                    division = toSafeText(primary.parent?.name || '');
                } else {
                    // Legacy: orgChart 트리워크로 division 추정
                    const resolved = resolveDivisionAndTeam(orgChart, primary);
                    division = resolved.division;
                    if (!team) team = resolved.team;
                }

                teamOrg = {
                    id: toSafeText(primary.id || primary.value || '').trim(),
                    name: toSafeText(primary.name || primary.label || ''),
                    ...(primary.member_count != null ? { member_count: primary.member_count } : {})
                };
                if (parentResolved) {
                    teamOrg.parent = primary.parent
                        ? { id: toSafeText(primary.parent.id || '').trim(), name: toSafeText(primary.parent.name || '') }
                        : null;
                }
                if (orgList.length > 1 && !team) {
                    team = orgList.map((o) => toSafeText(o?.name || o?.label)).filter(Boolean).join(', ');
                }
            }
            if (!team && laneName) team = laneName;

            const assignees = userList
                .map((u) => ({
                    label: toSafeText(u?.label || u?.name || u?.email || u),
                    email: toSafeText(u?.email || u?.id || u).trim(),
                    name: toSafeText(u?.name || u?.label || u)
                }))
                .filter((a) => a.email || a.label);

            rows.push({
                rowId: `${procDefId}::${laneId || laneName}`,
                processDefId: procDefId,
                laneId,
                laneName,
                division,
                team,
                teamOrg,
                hasParentInfo: parentResolved,
                assignees,
                processName: procName,
                taskSummary: toSafeText(props.laneDescription),
                remark: toSafeText(props.laneRemark)
            });
        });
    } catch (e) {
        console.warn('[WorkAssignment] BPMN 파싱 실패:', procDefId, e);
    }
    return rows;
}

// ---------------- BPMN snapshot → 지정한 lane 의 props 일부를 갱신해 새 XML 반환 ----------------
// propsUpdate: { key: value }
//  - value === null/undefined  → 해당 key 삭제
//  - 그 외                      → 해당 key 를 그 값으로 설정 (병합)
function updateLanePropsInXml(xml, targetLaneId, propsUpdate) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('BPMN XML 파싱 실패');
    }

    const allElements = bpmnGetAllDescendants(doc.documentElement);
    const laneNode = allElements.find((n) => bpmnLocalName(n) === 'lane' && (n.getAttribute('id') || '') === targetLaneId);
    if (!laneNode) throw new Error(`lane(id=${targetLaneId}) 을 snapshot 에서 찾을 수 없습니다.`);

    const bpmnNs = laneNode.namespaceURI || 'http://www.omg.org/spec/BPMN/20100524/MODEL';
    const uengineNs = 'http://uengine';
    const bpmnPrefix = laneNode.prefix || 'bpmn';

    // extensionElements 확보 (없으면 lane 의 첫 자식으로 생성)
    let extEl = bpmnGetChildren(laneNode).find((c) => bpmnLocalName(c) === 'extensionElements');
    if (!extEl) {
        extEl = doc.createElementNS(bpmnNs, `${bpmnPrefix}:extensionElements`);
        laneNode.insertBefore(extEl, laneNode.firstChild);
    }

    // properties 확보
    let propsEl = Array.from(extEl.getElementsByTagName('*')).find((c) => bpmnLocalName(c) === 'properties');
    if (!propsEl) {
        propsEl = doc.createElementNS(uengineNs, 'uengine:properties');
        extEl.appendChild(propsEl);
    }

    // 기존 json 읽기 (attribute 우선, 없으면 child)
    let propsJson = {};
    const existingAttr = propsEl.getAttribute('json');
    const existingJsonChild = Array.from(propsEl.getElementsByTagName('*')).find((c) => bpmnLocalName(c) === 'json');
    if (existingAttr) {
        propsJson = parseJsonSafe(existingAttr, {});
    } else if (existingJsonChild) {
        propsJson = parseJsonSafe(existingJsonChild.textContent || '{}', {});
    }

    // propsUpdate 적용 (null/undefined 면 키 삭제, 그 외엔 설정)
    Object.entries(propsUpdate || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            delete propsJson[key];
        } else {
            propsJson[key] = value;
        }
    });

    const newJsonStr = JSON.stringify(propsJson);

    // 기존 표기 형식을 보존하며 다시 쓰기
    if (existingJsonChild) {
        existingJsonChild.textContent = newJsonStr;
        if (existingAttr) propsEl.removeAttribute('json');
    } else {
        propsEl.setAttribute('json', newJsonStr);
    }

    return new XMLSerializer().serializeToString(doc);
}

export default defineComponent({
    name: 'WorkAssignmentPage',
    components: { ProgressBadge },
    setup() {
        const router = useRouter();

        function goToProcess(procDefId, processName) {
            if (!procDefId) return;
            navigateToProcessHierarchy(
                router,
                {
                    id: String(procDefId).trim(),
                    name: String(processName || procDefId).trim(),
                    entry: PROCESS_HIERARCHY_ENTRY.ARCHITECTURE
                },
                { openInNewTab: true }
            );
        }

        const workAssignmentProcessHeaders = computed(() => [
            { title: '프로세스', key: 'processName', align: 'start' },
            { title: '단계', key: 'stage', align: 'start', sortable: false, width: 110 },
            { title: '위치', key: 'location', align: 'start', sortable: false },
            { title: '레인 수', key: 'laneCount', align: 'start', sortable: false, width: 120 }
        ]);

        // 프로세스 이름 검색 키워드 — 칩 필터와 결합되어 표/카운트 모두에 반영됨
        const processSearchKeyword = ref('');

        // 1단계: 이름 검색 적용 (칩 카운트 + 표 둘 다 이 베이스를 사용)
        const searchedWorkAssignmentRows = computed(() => {
            const kw = (processSearchKeyword.value || '').trim().toLowerCase();
            if (!kw) return workAssignmentRows.value;
            return workAssignmentRows.value.filter((r) => (r.processName || '').toLowerCase().includes(kw));
        });

        // 2단계: 단계 필터 적용 (표 행 표시용)
        const filteredWorkAssignmentRows = computed(() => {
            if (selectedStage.value === 'all') return searchedWorkAssignmentRows.value;
            return searchedWorkAssignmentRows.value.filter((r) => r.stage === selectedStage.value);
        });

        const workAssignmentProcessGroups = computed(() => {
            const groups = new Map();
            filteredWorkAssignmentRows.value.forEach((row) => {
                const key = row.processDefId;
                if (!groups.has(key)) {
                    groups.set(key, {
                        processDefId: row.processDefId,
                        processName: row.processName,
                        stage: row.stage,
                        lanes: []
                    });
                }
                groups.get(key).lanes.push(row);
            });
            return Array.from(groups.values()).sort((a, b) => (a.processName || '').localeCompare(b.processName || '', 'ko-KR'));
        });

        // 각 단계별 unique proc_def 카운트 (칩 옆 숫자) — 검색 결과 베이스로 집계
        const stageCounts = computed(() => {
            const counts = { all: 0, published: 0, final_edit: 0, public_feedback: 0, in_review: 0 };
            const perStage = {
                published: new Set(),
                final_edit: new Set(),
                public_feedback: new Set(),
                in_review: new Set()
            };
            searchedWorkAssignmentRows.value.forEach((row) => {
                if (row.stage && perStage[row.stage]) {
                    perStage[row.stage].add(row.processDefId);
                }
            });
            counts.published = perStage.published.size;
            counts.final_edit = perStage.final_edit.size;
            counts.public_feedback = perStage.public_feedback.size;
            counts.in_review = perStage.in_review.size;
            counts.all = counts.published + counts.final_edit + counts.public_feedback + counts.in_review;
            return counts;
        });

        const expandedProcessIds = ref([]);

        const workAssignmentRows = ref([]);
        const workAssignmentLoading = ref(false);
        const workAssignmentError = ref('');
        // configuration.organization 트리 — legacy snapshot 의 본부 추정 fallback 용
        const workAssignmentOrgChart = ref(null);
        // 프로세스 계층도 (mega > major > sub) — 각 proc_def 의 원래 위치 표시용
        const workAssignmentProcMap = ref(null);

        async function loadProcessDefinitionMap() {
            try {
                const cached = window.$procMap;
                if (cached?.mega_proc_list) {
                    workAssignmentProcMap.value = cached;
                    return;
                }
                const result = await backend.getProcessDefinitionMap();
                workAssignmentProcMap.value = result?.value || result || null;
            } catch (e) {
                console.warn('[WorkAssignment] 프로세스 계층도 로드 실패:', e);
                workAssignmentProcMap.value = null;
            }
        }

        // procDefId → { megaName, majorName } 룩업
        const procLocationByDefId = computed(() => {
            const map = {};
            const megaList = workAssignmentProcMap.value?.mega_proc_list || [];
            for (const mega of megaList) {
                const megaName = mega?.name || '';
                for (const major of mega?.major_proc_list || []) {
                    const majorName = major?.name || '';
                    for (const sub of major?.sub_proc_list || []) {
                        const id = sub?.id == null ? '' : String(sub.id).trim();
                        if (!id) continue;
                        map[id] = { megaName, majorName };
                    }
                }
            }
            return map;
        });

        // 단계 필터 — STAGE_DEFS 단일 정의에서 아이콘·라벨 재사용 (초안 제외, 1→4단계 순)
        const stageOptions = [
            { value: 'all', label: '전체', icon: 'mdi-format-list-bulleted' },
            ...[...STAGE_DEFS]
                .filter((s) => s.stage !== 'draft')
                .sort((a, b) => a.order - b.order)
                .map((s) => ({
                    value: s.stage,
                    label: s.label,
                    icon: s.icon
                }))
        ];
        const selectedStage = ref('all');

        async function loadOrganizationChart() {
            try {
                const orgData = await backend.getData('configuration', {
                    match: { key: 'organization' }
                });
                if (orgData && orgData.value) {
                    const orgValue = typeof orgData.value === 'string' ? JSON.parse(orgData.value) : orgData.value;
                    workAssignmentOrgChart.value = orgValue?.chart || orgValue;
                }
            } catch (e) {
                console.warn('[WorkAssignment] 조직도 로드 실패:', e);
                workAssignmentOrgChart.value = null;
            }
        }

        // 담당자 편집 다이얼로그 상태
        const assigneeDialogVisible = ref(false);
        const assigneeDialogTarget = ref(null);
        const assigneeDialogSelected = ref([]);
        const assigneeDialogSearchKeyword = ref('');
        const assigneeDialogSearchItems = ref([]);
        const assigneeDialogSearchLoading = ref(false);
        const assigneeDialogSaving = ref(false);
        const assigneeDialogRemark = ref('');
        let assigneeSearchDebounceTimer = null;
        let assigneeSearchSeq = 0;

        // 팀 편집 상태 (lane 단위 개별 설정)
        const assigneeDialogTeam = ref(null);
        const assigneeDialogTeamParent = ref(null);
        const assigneeDialogTeamParentLoading = ref(false);
        // parent 가 "확인됨" 상태인지 — legacy(미확인)과 신규(parent: null 확정) 구분용
        const assigneeDialogTeamParentLoaded = ref(false);
        const assigneeDialogTeamSearchKeyword = ref('');
        const assigneeDialogTeamSearchItems = ref([]);
        const assigneeDialogTeamSearchLoading = ref(false);
        let assigneeTeamSearchDebounceTimer = null;
        let assigneeTeamSearchSeq = 0;
        let assigneeTeamParentFetchSeq = 0;

        // 4개 단계(in_review / public_feedback / final_edit / published) 를 한 번에 로드
        //   - proc_def_approval_state 의 최신 state 우선
        //   - approval_state 에 없는 proc_def 는 proc_def_version (version_tag='published') 로 published 취급
        //   - 각 lane row 에 stage 태그 → 칩 필터링 + 저장 분기 모두에 사용
        async function loadAllStages() {
            workAssignmentLoading.value = true;
            workAssignmentError.value = '';
            try {
                const supabase = window.$supabase;
                if (!supabase) {
                    workAssignmentRows.value = [];
                    workAssignmentError.value = 'supabase 인스턴스가 없습니다.';
                    return;
                }

                const tenantId = window.$tenantName;

                // 1) approval_state — 4개 stage 의 최신 row per proc_def
                const { data: states, error: stErr } = await supabase
                    .from('proc_def_approval_state')
                    .select('proc_def_id, state, updated_at')
                    .eq('tenant_id', tenantId)
                    .in('state', ['in_review', 'public_feedback', 'final_edit', 'published'])
                    .order('updated_at', { ascending: false });
                if (stErr) throw stErr;

                const stageByProcDefId = new Map();
                (states || []).forEach((row) => {
                    if (row?.proc_def_id && !stageByProcDefId.has(row.proc_def_id)) {
                        stageByProcDefId.set(row.proc_def_id, row.state);
                    }
                });

                // 2) proc_def_version published 최신 — approval_state 누락분 cover
                const { data: publishedVersions, error: verErr } = await supabase
                    .from('proc_def_version')
                    .select('proc_def_id, version, snapshot')
                    .eq('tenant_id', tenantId)
                    .eq('version_tag', 'published');
                if (verErr) throw verErr;

                const latestPublishedByDefId = new Map();
                (publishedVersions || []).forEach((row) => {
                    const defId = row.proc_def_id;
                    const curVer = parseFloat(row.version || '0') || 0;
                    const prev = latestPublishedByDefId.get(defId);
                    const prevVer = prev ? parseFloat(prev.version || '0') || 0 : -Infinity;
                    if (!prev || curVer > prevVer) {
                        latestPublishedByDefId.set(defId, row);
                    }
                });

                // 3) 합집합
                const allProcDefIds = new Set([
                    ...stageByProcDefId.keys(),
                    ...latestPublishedByDefId.keys()
                ]);
                if (allProcDefIds.size === 0) {
                    workAssignmentRows.value = [];
                    return;
                }

                // 4) proc_def 메타 (이름 + bpmn working copy)
                const { data: defs, error: defErr } = await supabase
                    .from('proc_def')
                    .select('id, name, bpmn')
                    .eq('tenant_id', tenantId)
                    .in('id', Array.from(allProcDefIds))
                    .is('deleted_at', null);
                if (defErr) throw defErr;

                const defMap = new Map();
                (defs || []).forEach((d) => defMap.set(d.id, d));

                // 5) proc_def 마다 effective stage 확정 + BPMN 결정 + lane 변환
                const builtRows = [];
                for (const procDefId of allProcDefIds) {
                    const def = defMap.get(procDefId);
                    if (!def) continue;

                    // approval_state 우선, 없으면 published 로 간주
                    const stage = stageByProcDefId.get(procDefId) || 'published';

                    // BPMN: published → frozen snapshot 우선 (없으면 working copy fallback)
                    //       그 외 → working copy
                    let xml = '';
                    if (stage === 'published') {
                        const verRow = latestPublishedByDefId.get(procDefId);
                        const snapshot = verRow?.snapshot;
                        xml = typeof snapshot === 'string' ? snapshot : snapshot?.bpmn || snapshot?.xml || '';
                        if (!xml) xml = def.bpmn || '';
                    } else {
                        xml = def.bpmn || '';
                    }
                    if (!xml) continue;

                    const procName = def.name || procDefId;
                    const laneRows = buildLaneRowsFromBpmn(xml, procDefId, procName, workAssignmentOrgChart.value);
                    laneRows.forEach((r) => { r.stage = stage; });
                    builtRows.push(...laneRows);
                }

                workAssignmentRows.value = builtRows;
            } catch (e) {
                workAssignmentError.value = `프로세스 로드 실패: ${e?.message || e}`;
                workAssignmentRows.value = [];
            } finally {
                workAssignmentLoading.value = false;
            }
        }

        // ----- 레인 정보 편집 (팀 + 담당자 + 비고) -----
        function openAssigneeEditDialog(row) {
            assigneeDialogTarget.value = row;
            // 기존 값 복사 (참조 분리)
            assigneeDialogSelected.value = (row.assignees || []).map((a) => ({ ...a }));
            assigneeDialogRemark.value = toSafeText(row.remark);
            assigneeDialogSearchItems.value = [...assigneeDialogSelected.value];
            assigneeDialogSearchKeyword.value = '';
            // 팀 초기화 — 기존 teamOrg 가 있으면 그대로 사용
            assigneeDialogTeam.value = row.teamOrg ? { ...row.teamOrg } : null;
            assigneeDialogTeamParent.value = row.teamOrg?.parent ? { ...row.teamOrg.parent } : null;
            // teamOrg 에 parent 키가 명시적으로 존재(객체 or null)하면 loaded — legacy 는 키 자체 없음
            assigneeDialogTeamParentLoaded.value = !!row.teamOrg && 'parent' in row.teamOrg;
            assigneeDialogTeamParentLoading.value = false;
            assigneeDialogTeamSearchItems.value = assigneeDialogTeam.value ? [assigneeDialogTeam.value] : [];
            assigneeDialogTeamSearchKeyword.value = '';
            assigneeDialogVisible.value = true;
        }

        function closeAssigneeEditDialog() {
            assigneeDialogVisible.value = false;
            assigneeDialogTarget.value = null;
            assigneeDialogSelected.value = [];
            assigneeDialogRemark.value = '';
            assigneeDialogSearchItems.value = [];
            assigneeDialogSearchKeyword.value = '';
            assigneeDialogTeam.value = null;
            assigneeDialogTeamParent.value = null;
            assigneeDialogTeamParentLoading.value = false;
            assigneeDialogTeamParentLoaded.value = false;
            assigneeDialogTeamSearchItems.value = [];
            assigneeDialogTeamSearchKeyword.value = '';
        }

        async function fetchAssigneeSearch(keyword) {
            const trimmed = toSafeText(keyword).trim();
            if (!trimmed) {
                assigneeDialogSearchItems.value = [...assigneeDialogSelected.value];
                return;
            }
            const seq = ++assigneeSearchSeq;
            assigneeDialogSearchLoading.value = true;
            try {
                // 팀 선택 시 클라이언트 필터로 누락 줄이기 위해 limit 확장
                const result = await backend.searchUsersByName(trimmed, 0, 100);
                if (seq !== assigneeSearchSeq) return;
                const users = (result && result.users) || [];
                const teamId = toSafeText(assigneeDialogTeam.value?.id || '').trim();
                const fetched = users
                    .map((u) => {
                        const identity = userIdentityFromSearchResult(u);
                        const value = toSafeText(identity.email || identity.id || identity.employee_no || '').trim();
                        return {
                            label: formatIdentityWithTeam(identity, value),
                            email: value,
                            name: toSafeText(identity.username),
                            user_id: toSafeText(identity.employee_no).trim(),
                            org_name: toSafeText(identity.org_name),
                            org_id: toSafeText(identity.org_code).trim()
                        };
                    })
                    .filter((u) => !teamId || u.org_id === teamId);
                // 이미 선택된 항목도 같이 보여서 chip 표시 깨지지 않게
                const merged = new Map();
                [...assigneeDialogSelected.value, ...fetched].forEach((opt) => {
                    if (opt?.email) merged.set(opt.email, opt);
                });
                assigneeDialogSearchItems.value = Array.from(merged.values());
            } catch (e) {
                if (seq !== assigneeSearchSeq) return;
                console.warn('[WorkAssignment] 담당자 검색 실패:', e);
            } finally {
                if (seq === assigneeSearchSeq) assigneeDialogSearchLoading.value = false;
            }
        }

        function onAssigneeSearchInput(query) {
            assigneeDialogSearchKeyword.value = query || '';
            if (assigneeSearchDebounceTimer) clearTimeout(assigneeSearchDebounceTimer);
            assigneeSearchDebounceTimer = setTimeout(() => fetchAssigneeSearch(query), 250);
        }

        async function fetchTeamSearch(keyword) {
            const trimmed = toSafeText(keyword).trim();
            if (!trimmed) {
                assigneeDialogTeamSearchItems.value = assigneeDialogTeam.value ? [assigneeDialogTeam.value] : [];
                return;
            }
            const seq = ++assigneeTeamSearchSeq;
            assigneeDialogTeamSearchLoading.value = true;
            try {
                const result = await backend.searchGroupsByName(trimmed, 0, 500);
                if (seq !== assigneeTeamSearchSeq) return;
                const groups = (result && result.groups) || [];
                const fetched = groups.map((g) => ({
                    id: toSafeText(g.id).trim(),
                    name: toSafeText(g.name),
                    ...(g.member_count != null ? { member_count: g.member_count } : {})
                }));
                // 현재 선택된 팀이 검색 결과에 없으면 같이 표시 (chip 깨짐 방지)
                const merged = new Map();
                if (assigneeDialogTeam.value?.id) merged.set(assigneeDialogTeam.value.id, assigneeDialogTeam.value);
                fetched.forEach((opt) => {
                    if (opt.id) merged.set(opt.id, opt);
                });
                assigneeDialogTeamSearchItems.value = Array.from(merged.values());
            } catch (e) {
                if (seq !== assigneeTeamSearchSeq) return;
                console.warn('[WorkAssignment] 팀 검색 실패:', e);
            } finally {
                if (seq === assigneeTeamSearchSeq) assigneeDialogTeamSearchLoading.value = false;
            }
        }

        function onTeamSearchInput(query) {
            assigneeDialogTeamSearchKeyword.value = query || '';
            if (assigneeTeamSearchDebounceTimer) clearTimeout(assigneeTeamSearchDebounceTimer);
            assigneeTeamSearchDebounceTimer = setTimeout(() => fetchTeamSearch(query), 250);
        }

        async function fetchTeamParent(teamId) {
            const trimmed = toSafeText(teamId).trim();
            if (!trimmed) {
                assigneeDialogTeamParent.value = null;
                assigneeDialogTeamParentLoaded.value = false;
                return;
            }
            const seq = ++assigneeTeamParentFetchSeq;
            assigneeDialogTeamParentLoading.value = true;
            try {
                const detail = await backend.getGroupById(trimmed);
                if (seq !== assigneeTeamParentFetchSeq) return;
                if (detail?.parent) {
                    assigneeDialogTeamParent.value = {
                        id: toSafeText(detail.parent.id || '').trim(),
                        name: toSafeText(detail.parent.name || '')
                    };
                } else {
                    assigneeDialogTeamParent.value = null;
                }
                assigneeDialogTeamParentLoaded.value = true;
            } catch (e) {
                if (seq !== assigneeTeamParentFetchSeq) return;
                console.warn('[WorkAssignment] 팀 parent 조회 실패:', e);
                // 조회 실패는 loaded=false 로 두어 placeholder 노출 안 함
                assigneeDialogTeamParent.value = null;
                assigneeDialogTeamParentLoaded.value = false;
            } finally {
                if (seq === assigneeTeamParentFetchSeq) assigneeDialogTeamParentLoading.value = false;
            }
        }

        // 팀 변경 시: parent 단건 조회 + 키워드 있으면 새 팀 기준 담당자 재검색
        function onTeamSelected(newTeam) {
            const nextId = toSafeText(newTeam?.id || '').trim();
            if (!nextId) {
                assigneeDialogTeamParent.value = null;
                assigneeDialogTeamParentLoading.value = false;
                assigneeDialogTeamParentLoaded.value = false;
            } else if (newTeam && 'parent' in newTeam) {
                // 이미 parent 키가 결정돼 있는 경우(다이얼로그 재진입 시 row.teamOrg 등) — 그대로 사용
                assigneeDialogTeamParent.value = newTeam.parent ? { ...newTeam.parent } : null;
                assigneeDialogTeamParentLoaded.value = true;
            } else {
                fetchTeamParent(nextId);
            }

            const kw = toSafeText(assigneeDialogSearchKeyword.value).trim();
            if (!kw) {
                assigneeDialogSearchItems.value = [...assigneeDialogSelected.value];
                return;
            }
            fetchAssigneeSearch(kw);
        }

        const assigneeSearchPlaceholder = computed(() => {
            return assigneeDialogTeam.value?.id
                ? `${toSafeText(assigneeDialogTeam.value.name)} 소속만 표시 — 이름 입력`
                : '이름·이메일·조직명으로 검색';
        });

        async function saveAssigneeEdit() {
            const target = assigneeDialogTarget.value;
            if (!target) return;
            assigneeDialogSaving.value = true;
            workAssignmentError.value = '';
            try {
                const supabase = window.$supabase;
                if (!supabase) throw new Error('supabase 인스턴스가 없습니다.');

                const tenantId = window.$tenantName;
                // 저장 분기는 "현재 필터" 가 아니라 "이 lane row 가 어느 stage 에서 로드됐는가" 기준
                const isPublishedStage = target.stage === 'published';

                // 1) 원본 XML 확보 — 배포완료는 published snapshot, 그 외는 proc_def.bpmn (working copy)
                let xmlOld = '';
                let verRow = null;
                let snapshot = null;
                if (isPublishedStage) {
                    const { data, error: vErr } = await supabase
                        .from('proc_def_version')
                        .select('arcv_id, snapshot, version')
                        .eq('tenant_id', tenantId)
                        .eq('proc_def_id', target.processDefId)
                        .eq('version_tag', 'published')
                        .order('version', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (vErr) throw vErr;
                    if (!data) throw new Error('published 버전을 찾을 수 없습니다.');
                    verRow = data;
                    snapshot = verRow.snapshot;
                    xmlOld = typeof snapshot === 'string' ? snapshot : snapshot?.bpmn || snapshot?.xml || '';
                    if (!xmlOld) throw new Error('snapshot 내용이 비어있습니다.');
                } else {
                    const { data: defRow, error: defErr } = await supabase
                        .from('proc_def')
                        .select('bpmn')
                        .eq('id', target.processDefId)
                        .eq('tenant_id', tenantId)
                        .maybeSingle();
                    if (defErr) throw defErr;
                    xmlOld = typeof defRow?.bpmn === 'string' ? defRow.bpmn : '';
                    if (!xmlOld) throw new Error('proc_def.bpmn 내용이 비어있습니다.');
                }

                // 2) 저장할 담당자 객체 정규화
                const assigneesToSave = (assigneeDialogSelected.value || []).map((a) => ({
                    label: toSafeText(a.label || a.name || a.email),
                    email: toSafeText(a.email || '').trim(),
                    name: toSafeText(a.name || a.label || a.email),
                    user_id: toSafeText(a.user_id || ''),
                    org_name: toSafeText(a.org_name || ''),
                    org_id: toSafeText(a.org_id || '')
                }));

                const remarkText = toSafeText(assigneeDialogRemark.value).trim();

                // 팀 정규화 — parent 가 "확인된" 경우에만 parent 키 저장
                //   - loaded=true & parent 객체 → { parent: { id, name } }
                //   - loaded=true & parent 없음(최상위 팀) → { parent: null }
                //   - loaded=false (legacy 미수정) → parent 키 자체 생략하여 legacy 상태 유지
                const teamSel = assigneeDialogTeam.value;
                const teamId = toSafeText(teamSel?.id || '').trim();
                const parentSel = assigneeDialogTeamParent.value;
                const parentField = assigneeDialogTeamParentLoaded.value
                    ? {
                        parent: parentSel?.id
                            ? { id: toSafeText(parentSel.id).trim(), name: toSafeText(parentSel.name) }
                            : null
                    }
                    : {};
                const teamToSave = teamId
                    ? [{
                        id: teamId,
                        name: toSafeText(teamSel.name),
                        ...parentField
                    }]
                    : null;

                // 3) lane props 일괄 갱신 — 팀 + 담당자 + 비고 (해당 lane 만)
                const propsUpdate = {
                    laneOrganization: teamToSave,
                    laneAssignee: assigneesToSave.length > 0 ? assigneesToSave : null,
                    laneAssigneeType: assigneesToSave.length > 0 ? 'user' : null,
                    laneRemark: remarkText || null
                };
                const xmlNew = updateLanePropsInXml(xmlOld, target.laneId, propsUpdate);

                // 4) proc_def_version.snapshot 갱신 — 배포완료 단계에만 적용 (검토 중 frozen snapshot 은 보호)
                if (isPublishedStage && verRow) {
                    const snapshotNew = typeof snapshot === 'string'
                        ? xmlNew
                        : (snapshot && typeof snapshot === 'object'
                            ? { ...snapshot, bpmn: xmlNew, ...(snapshot?.xml ? { xml: xmlNew } : {}) }
                            : xmlNew);

                    const { error: updVerErr } = await supabase
                        .from('proc_def_version')
                        .update({ snapshot: snapshotNew })
                        .eq('arcv_id', verRow.arcv_id);
                    if (updVerErr) throw updVerErr;
                }

                // 5) proc_def.bpmn 동기화 (모든 단계)
                const { error: updDefErr } = await supabase
                    .from('proc_def')
                    .update({ bpmn: xmlNew })
                    .eq('id', target.processDefId)
                    .eq('tenant_id', tenantId);
                if (updDefErr) throw updDefErr;

                // 6) 다이얼로그 닫고 표 전체 재로드 (4개 stage 통합 로드)
                closeAssigneeEditDialog();
                await loadAllStages();
            } catch (e) {
                workAssignmentError.value = `담당자 저장 실패: ${e?.message || e}`;
            } finally {
                assigneeDialogSaving.value = false;
            }
        }

        onMounted(async () => {
            // orgChart + procMap 병렬 로드 (서로 독립이라 둘 다 끝나야 lane 빌드 시 활용 가능)
            await Promise.all([loadOrganizationChart(), loadProcessDefinitionMap()]);
            await loadAllStages();
        });

        return {
            workAssignmentProcessHeaders,
            workAssignmentProcessGroups,
            expandedProcessIds,
            workAssignmentRows,
            workAssignmentLoading,
            workAssignmentError,
            stageOptions,
            selectedStage,
            stageCounts,
            processSearchKeyword,
            procLocationByDefId,
            goToProcess,
            assigneeDialogVisible,
            assigneeDialogTarget,
            assigneeDialogSelected,
            assigneeDialogSearchKeyword,
            assigneeDialogSearchItems,
            assigneeDialogSearchLoading,
            assigneeDialogSaving,
            assigneeDialogRemark,
            assigneeDialogTeam,
            assigneeDialogTeamParent,
            assigneeDialogTeamParentLoading,
            assigneeDialogTeamParentLoaded,
            assigneeDialogTeamSearchKeyword,
            assigneeDialogTeamSearchItems,
            assigneeDialogTeamSearchLoading,
            assigneeSearchPlaceholder,
            openAssigneeEditDialog,
            closeAssigneeEditDialog,
            onAssigneeSearchInput,
            onTeamSearchInput,
            onTeamSelected,
            saveAssigneeEdit
        };
    }
});
</script>

<style scoped>
/* 펼친 영역 sub-table (글로벌 sk-* 미적용 영역) */
.work-assignment-expanded-row .work-assignment-expanded-cell {
    padding: 0 0 8px 24px !important;
    background: #f8fafc;
}

.work-assignment-lane-table {
    background: transparent;
}

/* 좁은 화면에서도 헤더 텍스트가 세로로 깨지지 않게 가로 스크롤 허용 */
.work-assignment-expanded-cell {
    overflow-x: auto;
}

.work-assignment-lane-table :deep(th) {
    background: #f8fafc !important;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
}

.work-assignment-lane-table :deep(td) {
    font-size: 12px;
    color: #1f2937;
    height: auto !important;
    padding-top: 6px !important;
    padding-bottom: 6px !important;
    white-space: normal;
    vertical-align: top;
}

.work-assignment-lane-table :deep(tr) {
    height: auto !important;
}

.work-assignment-process-link {
    color: inherit;
    text-decoration: none;
    cursor: pointer;
}

.work-assignment-process-link:hover {
    color: rgb(var(--v-theme-primary));
    text-decoration: underline;
}
</style>
