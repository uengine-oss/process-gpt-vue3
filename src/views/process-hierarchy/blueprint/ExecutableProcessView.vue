<template>
    <div class="execview">
        <!-- 빈 상태 -->
        <div v-if="!hasDefinition" class="execview__placeholder">
            <v-icon size="64" color="teal-lighten-2">mdi-play-circle-outline</v-icon>
            <div class="execview__placeholder-title">아직 실행형 프로세스가 없습니다</div>
            <div class="execview__placeholder-desc">
                현재 순서도는 문서화용이라 그대로 실행할 수 없습니다.<br />
                AI가 순서도를 실행 엔진용 정의(역할·분기 조건·자동화 태스크)로 변환합니다.
            </div>
            <div v-if="pools.length >= 2" class="execview__pools execview__pools--placeholder">
                <div class="execview__pools-title">
                    <v-icon size="15">mdi-view-agenda-outline</v-icon>
                    실행형 Pool — 시작 이벤트·실행 흐름의 기준이 됩니다 (여러 개 지정 가능)
                </div>
                <div class="execview__pools-chips">
                    <v-chip
                        v-for="p in pools"
                        :key="p.id"
                        size="small"
                        :variant="isExecPool(p.id) ? 'flat' : 'outlined'"
                        :color="isExecPool(p.id) ? 'teal' : 'grey'"
                    >
                        <v-icon v-if="isExecPool(p.id)" start size="13">mdi-play-circle-outline</v-icon>
                        {{ p.name }} ({{ poolStat(p.id) }})
                    </v-chip>
                </div>
                <div class="text-caption text-medium-emphasis mt-1">
                    지정·해제는 As-Is/To-Be 캔버스에서 Pool 을 우클릭 → 속성 패널의 "실행형 Pool" 토글로 합니다.
                </div>
                <div v-if="!execPoolIdSet.size" class="text-caption text-warning mt-1">
                    실행형 Pool 이 미지정이면 액티비티가 가장 많은 풀 기준으로 변환됩니다.
                </div>
            </div>
            <v-btn
                color="teal"
                variant="flat"
                size="large"
                rounded="lg"
                class="mt-6"
                :loading="generating"
                :disabled="readonly || !sourceXml"
                @click="$emit('generate')"
            >
                <v-icon start>mdi-auto-fix</v-icon>
                AI 실행형 변환
            </v-btn>
            <div v-if="!sourceXml" class="text-caption text-disabled mt-2">변환할 BPMN 이 없습니다.</div>
        </div>

        <template v-else>
            <!-- 상단 바 -->
            <div class="execview__bar">
                <v-chip size="x-small" variant="flat" color="teal">실행형</v-chip>
                <v-chip size="x-small" variant="tonal" color="grey">원본: {{ sourceLabel }}</v-chip>
                <v-chip v-if="executable?.applied_at" size="x-small" variant="flat" color="success">
                    <v-icon start size="12">mdi-check-decagram</v-icon>
                    실행 정의 등록됨
                </v-chip>
                <v-chip v-if="needsReapply" size="x-small" variant="flat" color="orange">
                    <v-icon start size="12">mdi-pencil-outline</v-icon>
                    수정됨 · 재등록 필요
                </v-chip>
                <v-tooltip
                    v-if="offDiagramActivityIds.size"
                    text="AI가 엔진 계약(자동 접수 등)으로 추가한 태스크입니다. 원본 도면(XML)에는 없어 캔버스에 표시되지 않지만 실행 시에는 수행됩니다. 목록은 액티비티 탭에서 '도면 외' 배지로 확인하세요."
                    location="bottom"
                    max-width="360"
                >
                    <template #activator="{ props: tt }">
                        <v-chip v-bind="tt" size="x-small" variant="flat" color="deep-purple">
                            <v-icon start size="12">mdi-shape-square-plus</v-icon>
                            도면 외 태스크 {{ offDiagramActivityIds.size }}
                        </v-chip>
                    </template>
                </v-tooltip>
                <v-chip
                    size="x-small"
                    variant="flat"
                    :color="validationColor"
                >
                    {{ validationLabel }}
                </v-chip>
                <v-tooltip
                    v-if="assigneeIssues.length"
                    text="역할 담당자(endpoint)가 실제 계정과 맞지 않아 실행 시 'Agent not found' 등 배정 실패가 예상됩니다. 검증 탭에서 상세를 확인하고 역할 패널에서 계정을 선택하세요."
                    location="bottom"
                    max-width="360"
                >
                    <template #activator="{ props: tt }">
                        <v-chip v-bind="tt" size="x-small" variant="flat" color="error" @click="detailTab = 'validation'">
                            <v-icon start size="12">mdi-account-alert</v-icon>
                            담당자 문제 {{ assigneeIssues.length }}
                        </v-chip>
                    </template>
                </v-tooltip>
                <span class="execview__summary">{{ executable?.summary }}</span>
                <v-spacer />
                <v-btn size="small" variant="tonal" color="teal" :loading="generating" :disabled="readonly" @click="$emit('generate')">
                    <v-icon start size="15">mdi-refresh</v-icon>
                    재변환
                </v-btn>
                <v-tooltip
                    v-if="isAdmin"
                    :text="
                        hasErrors
                            ? '검증 오류를 해결해야 등록할 수 있습니다 (재변환 시 오류가 AI에 피드백됩니다)'
                            : '변환된 정의를 proc_def 실행 정의로 등록하고, userTask 폼(form_def)을 자동 생성·연결합니다. 등록 후 순서도 실행 버튼으로 인스턴스를 시작할 수 있습니다.'
                    "
                    location="bottom"
                >
                    <template #activator="{ props: tt }">
                        <div v-bind="tt" class="d-inline-block">
                            <v-btn
                                size="small"
                                variant="flat"
                                color="success"
                                :loading="applying"
                                :disabled="readonly || hasErrors"
                                @click="$emit('apply')"
                            >
                                <v-icon start size="15">mdi-rocket-launch-outline</v-icon>
                                실행 정의로 등록
                            </v-btn>
                        </div>
                    </template>
                </v-tooltip>
            </div>

            <!-- Pool 구분 (풀 2개 이상 도면) -->
            <div v-if="pools.length >= 2" class="execview__pools">
                <v-icon size="14">mdi-view-agenda-outline</v-icon>
                <span class="execview__pools-label">실행형 Pool:</span>
                <v-chip
                    v-for="p in pools"
                    :key="p.id"
                    size="x-small"
                    :variant="isExecPool(p.id) ? 'flat' : 'outlined'"
                    :color="isExecPool(p.id) ? 'teal' : 'grey'"
                >
                    <v-icon v-if="isExecPool(p.id)" start size="12">mdi-play-circle-outline</v-icon>
                    {{ p.name }} ({{ poolStat(p.id) }})
                </v-chip>
                <v-tooltip
                    v-if="!execPoolIdSet.size"
                    text="풀이 2개 이상인 도면입니다. As-Is/To-Be 캔버스에서 Pool 을 우클릭해 속성 패널의 '실행형 Pool' 토글로 지정하세요(여러 개 가능). 지정 후 재변환·재등록하면 그 풀들의 시작 이벤트 기준으로 변환·실행됩니다."
                    location="bottom"
                    max-width="340"
                >
                    <template #activator="{ props: tt }">
                        <v-chip v-bind="tt" size="x-small" variant="flat" color="warning">
                            <v-icon start size="12">mdi-alert</v-icon>
                            실행형 Pool 미지정
                        </v-chip>
                    </template>
                </v-tooltip>
                <span v-else class="text-caption text-medium-emphasis">
                    비실행 Pool 의 시작 이벤트는 변환·실행에서 제외됩니다 · 지정 변경은 As-Is/To-Be 의 Pool 속성 패널
                </span>
            </div>

            <!-- 캔버스 + 속성 패널 -->
            <div class="execview__main">
                <div class="execview__canvas">
                    <BpmnUengineViewer
                        v-if="sourceXml"
                        :key="'exec-' + renderKey"
                        :bpmn="sourceXml"
                        :diffActivities="typeMarkers"
                        :contextmenu-panel="true"
                        @elementClick="onCanvasElementClick"
                        @elementContextmenu="onCanvasElementContextmenu"
                    />
                    <div v-else class="execview__empty">원본 BPMN 을 표시할 수 없습니다</div>
                </div>

                <!-- 선택 요소 속성 패널 (조회 + 편집) -->
                <div v-if="selected" class="execview__panel">
                    <div class="execview__panel-head">
                        <v-chip size="x-small" variant="flat" :color="kindMeta.color">{{ kindMeta.label }}</v-chip>
                        <span class="execview__panel-id" :title="selected.id">{{ selected.id }}</span>
                        <v-spacer />
                        <v-btn icon size="x-small" variant="text" @click="closePanel">
                            <v-icon size="16">mdi-close</v-icon>
                        </v-btn>
                    </div>

                    <div v-if="selected.kind === 'unknown'" class="pa-4 text-body-2 text-medium-emphasis">
                        이 요소는 실행 정의에 포함되어 있지 않아 실행 시 무시됩니다.<br />
                        포함하려면 재변환하거나, 인접 요소의 시퀀스를 확인하세요.
                    </div>

                    <template v-else-if="draft">
                        <div class="execview__panel-body">
                            <v-alert
                                v-if="selected.kind === 'activity' && isOffDiagram(selected.id)"
                                type="info"
                                density="compact"
                                variant="tonal"
                                class="mb-2"
                            >
                                원본 도면에 없는 AI 추가 태스크입니다. 캔버스에는 표시되지 않지만 실행 시 수행됩니다.
                            </v-alert>
                            <!-- 액티비티 -->
                            <template v-if="selected.kind === 'activity'">
                                <v-text-field v-model="draft.name" label="이름" v-bind="fieldAttrs" />
                                <v-select v-model="draft.type" :items="ACT_TYPE_ITEMS" label="실행 타입" v-bind="fieldAttrs" />
                                <v-combobox v-model="draft.role" :items="roleNames" label="역할 (role)" v-bind="fieldAttrs" />
                                <v-autocomplete
                                    v-model="draft.assignee"
                                    :items="endpointItems"
                                    item-title="title"
                                    item-value="value"
                                    clearable
                                    label="담당 배정 (에이전트/사용자)"
                                    hint="역할(Lane) 바인딩으로 배정됩니다. 같은 역할을 쓰는 다른 태스크가 있으면 이 태스크 전용 역할을 만들어 분리 배정합니다. serviceTask 는 [에이전트] 계정만 실행됩니다."
                                    persistent-hint
                                    v-bind="fieldAttrs"
                                />
                                <v-text-field v-model="draft.tool" label="도구 (tool)" v-bind="fieldAttrs" />
                                <v-text-field v-model="draft.duration" label="기간 (duration, 일)" type="number" v-bind="fieldAttrs" />
                                <v-textarea v-model="draft.description" label="설명" rows="2" auto-grow v-bind="fieldAttrs" />
                                <v-textarea v-model="draft.instruction" label="수행 지침 (instruction)" rows="2" auto-grow v-bind="fieldAttrs" />
                                <v-combobox
                                    v-model="draft.inputData"
                                    label="Input 데이터"
                                    multiple
                                    chips
                                    :closable-chips="!readonly"
                                    v-bind="fieldAttrs"
                                />
                                <v-combobox
                                    v-model="draft.outputData"
                                    label="Output 데이터"
                                    multiple
                                    chips
                                    :closable-chips="!readonly"
                                    v-bind="fieldAttrs"
                                />
                                <v-combobox
                                    v-model="draft.checkpoints"
                                    label="체크포인트"
                                    multiple
                                    chips
                                    :closable-chips="!readonly"
                                    v-bind="fieldAttrs"
                                />
                                <v-textarea
                                    v-if="draft.type === 'scriptTask' || draft.pythonCode"
                                    v-model="draft.pythonCode"
                                    label="pythonCode (scriptTask)"
                                    rows="4"
                                    auto-grow
                                    class="execview__mono"
                                    v-bind="fieldAttrs"
                                />
                            </template>

                            <!-- 게이트웨이 -->
                            <template v-else-if="selected.kind === 'gateway'">
                                <v-text-field v-model="draft.name" label="이름" v-bind="fieldAttrs" />
                                <v-select v-model="draft.type" :items="GW_TYPE_ITEMS" label="타입" v-bind="fieldAttrs" />
                                <v-combobox v-model="draft.role" :items="roleNames" label="역할 (role)" v-bind="fieldAttrs" />
                                <v-textarea v-model="draft.description" label="설명" rows="2" auto-grow v-bind="fieldAttrs" />
                                <v-combobox
                                    v-model="draft.conditionData"
                                    label="분기 결정 필드 (conditionData)"
                                    multiple
                                    chips
                                    :closable-chips="!readonly"
                                    v-bind="fieldAttrs"
                                />
                            </template>

                            <!-- 이벤트 -->
                            <template v-else-if="selected.kind === 'event'">
                                <v-text-field v-model="draft.name" label="이름" v-bind="fieldAttrs" />
                                <v-select v-model="draft.type" :items="EV_TYPE_ITEMS" label="타입" v-bind="fieldAttrs" />
                                <v-combobox v-model="draft.role" :items="roleNames" label="역할 (role)" v-bind="fieldAttrs" />
                                <v-textarea v-model="draft.description" label="설명" rows="2" auto-grow v-bind="fieldAttrs" />
                            </template>

                            <!-- 시퀀스 -->
                            <template v-else-if="selected.kind === 'sequence'">
                                <div class="execview__seqpath">
                                    <span>{{ nodeName(draft.source) }}</span>
                                    <v-icon size="14">mdi-arrow-right</v-icon>
                                    <span>{{ nodeName(draft.target) }}</span>
                                </div>
                                <v-text-field v-model="draft.name" label="분기 라벨 (name)" v-bind="fieldAttrs" />
                                <v-textarea
                                    v-model="draft.conditionFunction"
                                    label="분기 조건 (conditionFunction)"
                                    rows="2"
                                    auto-grow
                                    class="execview__mono"
                                    hint="예: 승인여부 == '승인' — 배타 게이트웨이 분기는 이 조건으로 결정론 평가됩니다."
                                    persistent-hint
                                    v-bind="fieldAttrs"
                                />
                            </template>

                            <!-- 역할 -->
                            <template v-else-if="selected.kind === 'role'">
                                <v-text-field
                                    v-bind="fieldAttrs"
                                    :model-value="draft.name"
                                    label="이름"
                                    readonly
                                    hint="역할 이름은 액티비티 role 참조 키라 여기서 바꿀 수 없습니다."
                                    persistent-hint
                                />
                                <v-combobox
                                    v-model="draft.endpoint"
                                    :items="endpointItems"
                                    item-title="title"
                                    item-value="value"
                                    :return-object="false"
                                    label="담당자 endpoint (email/uuid)"
                                    hint="serviceTask 역할은 반드시 [에이전트] 계정을 선택하세요 — 아니면 실행 시 'Agent not found'로 실패합니다."
                                    persistent-hint
                                    v-bind="fieldAttrs"
                                />
                                <v-combobox
                                    v-model="draft.default"
                                    :items="endpointItems"
                                    item-title="title"
                                    item-value="value"
                                    :return-object="false"
                                    label="기본 담당자 (default)"
                                    v-bind="fieldAttrs"
                                />
                                <v-text-field v-model="draft.resolutionRule" label="배정 규칙 (resolutionRule)" v-bind="fieldAttrs" />
                            </template>

                            <!-- uengine properties bag (역할 제외 공통) -->
                            <v-textarea
                                v-if="selected.kind !== 'role'"
                                v-model="draft.propertiesText"
                                label="properties (JSON)"
                                rows="3"
                                auto-grow
                                class="execview__mono"
                                v-bind="fieldAttrs"
                            />

                            <v-alert v-if="draftError" type="error" density="compact" variant="tonal" class="mt-2">
                                {{ draftError }}
                            </v-alert>
                        </div>
                        <div class="execview__panel-foot">
                            <template v-if="!readonly">
                                <v-btn size="small" variant="flat" color="teal" @click="applyDraft">
                                    <v-icon start size="15">mdi-check</v-icon>
                                    적용
                                </v-btn>
                                <v-btn size="small" variant="text" @click="resetDraft">되돌리기</v-btn>
                                <span class="text-caption text-medium-emphasis ml-1">적용 후 "실행 정의로 등록"해야 실행에 반영됩니다.</span>
                            </template>
                            <span v-else class="text-caption text-medium-emphasis">조회 전용 — 편집 모드에서 수정할 수 있습니다.</span>
                        </div>
                    </template>
                </div>
            </div>

            <!-- 범례 + 통계 -->
            <div class="execview__legend">
                <span class="execview__legend-item"><span class="execview__legend-dot" style="background: #16a34a"></span>에이전트 자동 (serviceTask)</span>
                <span class="execview__legend-item"><span class="execview__legend-dot" style="background: #2563eb"></span>스크립트 자동 (scriptTask)</span>
                <span class="execview__legend-item"><span class="execview__legend-dot" style="background: #9e9e9e"></span>사람 수행 (userTask)</span>
                <span class="execview__legend-hint">캔버스 클릭 = 속성 패널 · 아래 목록 클릭 = 실행 정의 편집(타입·담당·분기 조건)</span>
                <v-spacer />
                <span class="execview__stat">
                    액티비티 {{ stats.activities }} (자동 {{ stats.automated }}) · 게이트웨이 {{ stats.gateways }} · 분기 조건
                    {{ stats.conditions }} · 역할 {{ stats.roles }}
                </span>
            </div>

            <!-- 하단 상세 패널 -->
            <div class="execview__detail">
                <div class="execview__tabs">
                    <button
                        v-for="tab in detailTabs"
                        :key="tab.key"
                        :class="{ active: detailTab === tab.key }"
                        @click="detailTab = detailTab === tab.key ? '' : tab.key"
                    >
                        <v-icon size="14">{{ tab.icon }}</v-icon>
                        {{ tab.label }}
                        <v-chip v-if="tab.count != null" size="x-small" variant="tonal" :color="tab.color || 'grey'">{{ tab.count }}</v-chip>
                    </button>
                </div>

                <div v-if="detailTab === 'validation'" class="execview__detail-body">
                    <div
                        v-if="!validation.errors.length && !validation.warnings.length && !assigneeIssues.length"
                        class="text-body-2 text-success pa-3"
                    >
                        <v-icon size="16" color="success">mdi-check-circle</v-icon>
                        엔진 계약 검증을 모두 통과했습니다.
                    </div>
                    <ul v-else class="execview__vlist">
                        <li v-for="(msg, i) in validation.errors" :key="'e' + i" class="execview__vitem execview__vitem--error">
                            <v-icon size="14" color="error">mdi-alert-circle</v-icon>
                            {{ msg }}
                        </li>
                        <li v-for="(msg, i) in validation.warnings" :key="'w' + i" class="execview__vitem execview__vitem--warn">
                            <v-icon size="14" color="warning">mdi-alert</v-icon>
                            {{ msg }}
                        </li>
                        <li v-for="(msg, i) in assigneeIssues" :key="'a' + i" class="execview__vitem execview__vitem--error">
                            <v-icon size="14" color="error">mdi-account-alert</v-icon>
                            {{ msg }}
                        </li>
                    </ul>
                </div>

                <div v-else-if="detailTab === 'activities'" class="execview__detail-body">
                    <table class="execview__table">
                        <thead>
                            <tr>
                                <th>액티비티</th>
                                <th>실행 타입</th>
                                <th>역할</th>
                                <th>수행 지침</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="a in definition.activities"
                                :key="a.id"
                                class="execview__row"
                                :class="{ 'execview__row--active': selected?.id === a.id }"
                                @click="selectById(a.id)"
                            >
                                <td>
                                    {{ a.name }}
                                    <v-chip v-if="isOffDiagram(a.id)" size="x-small" variant="tonal" color="deep-purple" class="ml-1">
                                        도면 외
                                    </v-chip>
                                </td>
                                <td>
                                    <v-chip size="x-small" variant="flat" :color="typeMeta(a.type).color">{{ typeMeta(a.type).label }}</v-chip>
                                </td>
                                <td>
                                    {{ a.role }}
                                    <div v-if="assigneeLabelForRole(a.role)" class="execview__assignee">
                                        {{ assigneeLabelForRole(a.role) }}
                                    </div>
                                </td>
                                <td class="execview__desc">{{ a.instruction || a.description }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-else-if="detailTab === 'conditions'" class="execview__detail-body">
                    <table class="execview__table">
                        <thead>
                            <tr>
                                <th>게이트웨이</th>
                                <th>분기</th>
                                <th>조건 (conditionFunction)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="c in branchConditions"
                                :key="c.seqId"
                                class="execview__row"
                                :class="{ 'execview__row--active': selected?.id === c.seqId }"
                                @click="selectById(c.seqId)"
                            >
                                <td>{{ c.gateway }}</td>
                                <td>{{ c.label }}</td>
                                <td><code>{{ c.condition }}</code></td>
                            </tr>
                            <tr v-if="!branchConditions.length">
                                <td colspan="3" class="text-center text-disabled py-3">분기 조건이 없습니다.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-else-if="detailTab === 'roles'" class="execview__detail-body">
                    <div class="execview__roles-toolbar">
                        <span class="text-caption text-medium-emphasis">
                            담당 계정이 목록에 없으면 새 에이전트를 만들어 바로 배정할 수 있습니다.
                        </span>
                        <v-spacer />
                        <v-btn v-if="isAdmin" size="x-small" variant="tonal" color="indigo" @click="openAgentDialog()">
                            <v-icon start size="14">mdi-robot-outline</v-icon>
                            담당자(에이전트) 생성
                        </v-btn>
                    </div>
                    <table class="execview__table">
                        <thead>
                            <tr>
                                <th>역할 (Lane)</th>
                                <th>담당 배정 (endpoint)</th>
                                <th>배정 상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="r in definition.roles"
                                :key="r.name"
                                class="execview__row"
                                :class="{ 'execview__row--active': selected?.kind === 'role' && selected?.id === r.name }"
                                @click="select('role', r.name)"
                            >
                                <td>
                                    {{ r.name }}
                                    <v-chip
                                        v-if="serviceRoleNames.has(r.name)"
                                        size="x-small"
                                        variant="tonal"
                                        color="green"
                                        class="ml-1"
                                    >
                                        자동 태스크
                                    </v-chip>
                                </td>
                                <td class="execview__assign-cell" @click.stop>
                                    <v-autocomplete
                                        v-if="!readonly"
                                        :model-value="r.endpoint || r.default || ''"
                                        :items="endpointItems"
                                        item-title="title"
                                        item-value="value"
                                        density="compact"
                                        variant="outlined"
                                        hide-details
                                        clearable
                                        placeholder="담당자/에이전트 선택"
                                        @update:model-value="(v) => assignRoleEndpoint(r.name, v)"
                                    />
                                    <span v-else>{{ r.endpoint || r.default || '—' }}</span>
                                </td>
                                <td>
                                    <v-chip size="x-small" variant="tonal" :color="roleStatus(r).color">
                                        {{ roleStatus(r).label }}
                                    </v-chip>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- 변환 중 오버레이 -->
        <div v-if="generating" class="execview__genoverlay">
            <v-progress-circular indeterminate size="44" width="4" color="teal" />
            <div class="mt-3 text-body-2">AI가 순서도를 실행 가능한 프로세스로 변환하는 중입니다...</div>
        </div>

        <!-- 담당자(에이전트) 생성 다이얼로그 -->
        <v-dialog v-model="agentDialog.open" width="460">
            <v-card>
                <v-card-title class="text-subtitle-1">
                    <v-icon start size="18" color="indigo">mdi-robot-outline</v-icon>
                    담당자(에이전트) 생성
                </v-card-title>
                <v-card-text class="pt-2">
                    <v-text-field v-model="agentDialog.name" label="이름 *" density="compact" variant="outlined" class="mb-2" hide-details="auto" />
                    <v-text-field
                        v-model="agentDialog.role"
                        label="역할 설명 (예: 자동화 처리 담당)"
                        density="compact"
                        variant="outlined"
                        class="mb-2"
                        hide-details="auto"
                    />
                    <v-textarea
                        v-model="agentDialog.goal"
                        label="목표 (goal)"
                        rows="2"
                        auto-grow
                        density="compact"
                        variant="outlined"
                        class="mb-2"
                        hide-details="auto"
                    />
                    <v-select
                        v-model="agentDialog.assignRole"
                        :items="roleNames"
                        label="생성 후 배정할 역할 (선택)"
                        clearable
                        :disabled="readonly"
                        density="compact"
                        variant="outlined"
                        class="mb-2"
                        hide-details="auto"
                    />
                    <v-alert type="info" density="compact" variant="tonal" class="mb-1">
                        users 테이블에 에이전트 계정(is_agent)으로 등록되며 조직도 에이전트 목록에도 나타납니다.
                        serviceTask 실행 담당으로 사용할 수 있습니다.
                    </v-alert>
                    <v-alert v-if="agentDialog.error" type="error" density="compact" variant="tonal">{{ agentDialog.error }}</v-alert>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="agentDialog.open = false">취소</v-btn>
                    <v-btn color="indigo" variant="flat" :loading="agentDialog.saving" @click="createAgent">생성</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';
import BackendFactory from '@/components/api/BackendFactory';
import { extractBpmnSkeleton, cleanStringArray, type ExecutableData } from '@/composables/blueprint/executableModel';

const props = defineProps<{
    executable: ExecutableData | null;
    /** 변환 원본 BPMN (마커 표시용 캔버스). */
    sourceXml: string;
    generating: boolean;
    applying: boolean;
    readonly?: boolean;
    isAdmin?: boolean;
    /** true 면 캔버스의 XML 노드 클릭 시 내장 패널 대신 openElementPanel 을 emit (순서도 우측 속성 패널 재사용). */
    useExternalPanel?: boolean;
}>();

const emit = defineEmits<{
    (e: 'generate'): void;
    (e: 'apply'): void;
    /** 속성 패널에서 수정한 definition 전체 — 부모가 studio.updateExecutableDefinition 으로 저장. */
    (e: 'updateDefinition', definition: any): void;
    /** 원본 XML에 있는 요소 클릭 — 기존 우측 속성 패널(ProcessHierarchyProperties)을 그대로 연다. */
    (e: 'openElementPanel', elementId: string): void;
}>();

const detailTab = ref('validation');

const definition = computed(() => props.executable?.definition || ({ activities: [], gateways: [], events: [], sequences: [], roles: [] } as any));
const hasDefinition = computed(() => !!props.executable?.definition);
const validation = computed(() => props.executable?.validation || { errors: [], warnings: [], checked_at: '' });
const hasErrors = computed(() => validation.value.errors.length > 0);

const SOURCE_LABEL: Record<string, string> = { asis: 'As-Is', tobe: 'To-Be', modularized: 'To-Be(모듈화)' };
const sourceLabel = computed(() => SOURCE_LABEL[props.executable?.source || 'asis'] || 'As-Is');

const validationColor = computed(() => (hasErrors.value ? 'error' : validation.value.warnings.length ? 'warning' : 'success'));
const validationLabel = computed(() => {
    if (hasErrors.value) return `오류 ${validation.value.errors.length} · 경고 ${validation.value.warnings.length}`;
    if (validation.value.warnings.length) return `경고 ${validation.value.warnings.length}`;
    return '검증 통과';
});

/** 원본 도면 스켈레톤 (노드·풀) — Pool 구분·도면 외 태스크 판별의 기준. */
const skeleton = computed(() => extractBpmnSkeleton(props.sourceXml || ''));

/**
 * 원본 도면(XML)에 존재하는 노드 id — AI가 엔진 계약 때문에 추가한 태스크
 * (예: "프로세스 자동 접수")는 여기 없어서 캔버스에 표시되지 않는다.
 * 실행은 definition 기준이므로 이런 태스크도 실제로 실행된다.
 */
const xmlNodeIds = computed<Set<string>>(() => {
    const s = skeleton.value;
    return new Set([...s.activities, ...s.gateways, ...s.events].map((n) => n.id));
});

/* -------------------- 실행형 Pool 구분 (풀 2개 이상 도면) -------------------- */

const pools = computed(() => skeleton.value.pools || []);
/** 지정된 실행형 Pool id 집합 (다중) — 구버전 단일 exec_pool_id 도 흡수. 표시는 조회 전용,
 *  지정·해제는 As-Is/To-Be 캔버스의 Pool 속성 패널(studio.toggleExecutablePool)에서 한다. */
const execPoolIdSet = computed<Set<string>>(() => {
    const e = props.executable;
    const ids = (e?.exec_pools || []).map((p) => p.id).filter(Boolean);
    if (!ids.length && e?.exec_pool_id) ids.push(e.exec_pool_id);
    return new Set(ids);
});
function isExecPool(poolId: string): boolean {
    return execPoolIdSet.value.has(poolId);
}
/** 각 풀의 액티비티/시작이벤트 수 — 어떤 풀이 실행 본류인지 판단 근거로 표시. */
function poolStat(poolId: string): string {
    const s = skeleton.value;
    const acts = s.activities.filter((n) => n.pool === poolId).length;
    const starts = s.events.filter((n) => n.pool === poolId && n.type === 'startEvent').length;
    return `태스크 ${acts} · 시작 ${starts}`;
}
const offDiagramActivityIds = computed<Set<string>>(() => {
    if (!xmlNodeIds.value.size) return new Set();
    return new Set(
        (definition.value.activities || []).filter((a: any) => !xmlNodeIds.value.has(a.id)).map((a: any) => a.id)
    );
});
function isOffDiagram(id: string): boolean {
    return offDiagramActivityIds.value.has(id);
}

/** Exec 뷰에서 수정한 뒤 아직 재등록하지 않은 상태. */
const needsReapply = computed(() => {
    const e = props.executable;
    if (!e?.applied_at || !e?.edited_at) return false;
    return new Date(e.edited_at).getTime() > new Date(e.applied_at).getTime();
});

/* -------------------- 담당자(endpoint) 실계정 검증 -------------------- */
// 엔진은 serviceTask 워크아이템의 담당자가 users.is_agent=true 계정이 아니면
// "Agent not found" 로 실패한다 — 등록 전에 endpoint 를 실제 계정과 대조해 경고한다.

const execBackend = BackendFactory.createBackend() as any;
const tenantUsers = ref<any[]>([]);
const usersLoaded = ref(false);

async function loadTenantUsers() {
    try {
        const list = await execBackend.getUserList({});
        tenantUsers.value = Array.isArray(list) ? list : [];
    } catch {
        tenantUsers.value = [];
    } finally {
        usersLoaded.value = true;
    }
}
watch(
    hasDefinition,
    (v) => {
        if (v && !usersLoaded.value) loadTenantUsers();
    },
    { immediate: true }
);

/** 역할 endpoint 선택 항목 — 테넌트 사용자·에이전트 (email 우선, 자유 입력도 허용). */
const endpointItems = computed(() =>
    tenantUsers.value.map((u: any) => ({
        title: `${u.username || u.email || u.id}${u.is_agent ? ' [에이전트]' : ''} — ${u.email || u.id}`,
        value: String(u.email || u.id)
    }))
);

/** email/uuid(소문자) → 계정 행. */
const accountByKey = computed<Map<string, any>>(() => {
    const map = new Map<string, any>();
    for (const u of tenantUsers.value) {
        if (u.email) map.set(String(u.email).toLowerCase(), u);
        if (u.id) map.set(String(u.id).toLowerCase(), u);
    }
    return map;
});
function resolveAccount(endpoint?: string): any | null {
    const ep = String(endpoint || '').trim().toLowerCase();
    return (ep && accountByKey.value.get(ep)) || null;
}

/** serviceTask(에이전트 자동)가 배정된 역할 이름 — 이 역할의 담당은 에이전트 계정이어야 한다. */
const serviceRoleNames = computed<Set<string>>(
    () => new Set((definition.value.activities || []).filter((a: any) => a.type === 'serviceTask').map((a: any) => a.role))
);

function roleEndpointOf(roleName?: string): string {
    const role = (definition.value.roles || []).find((r: any) => r.name === roleName);
    return role ? String(role.endpoint || role.default || '').trim() : '';
}

/** 역할 행 배정 상태 — 계정 존재·에이전트 필요 여부를 한눈에. */
function roleStatus(r: any): { label: string; color: string } {
    const ep = String(r.endpoint || r.default || '').trim();
    if (!ep) return { label: '미지정', color: 'warning' };
    if (!usersLoaded.value || !tenantUsers.value.length) return { label: ep, color: 'grey' };
    const acc = resolveAccount(ep);
    if (!acc) return { label: '계정 없음', color: 'error' };
    if (serviceRoleNames.value.has(r.name) && !acc.is_agent) return { label: '에이전트 필요', color: 'error' };
    return acc.is_agent ? { label: '에이전트', color: 'green' } : { label: '사용자', color: 'grey' };
}

/** 액티비티 목록에 표시할 담당 라벨 (역할 endpoint → 계정 이름). */
function assigneeLabelForRole(roleName?: string): string {
    const ep = roleEndpointOf(roleName);
    if (!ep) return '';
    const acc = resolveAccount(ep);
    return acc ? `${acc.username || acc.email || acc.id}${acc.is_agent ? ' [에이전트]' : ''}` : ep;
}

const assigneeIssues = computed<string[]>(() => {
    if (!usersLoaded.value || !hasDefinition.value || !tenantUsers.value.length) return [];
    const issues: string[] = [];
    for (const r of definition.value.roles || []) {
        const ep = String(r.endpoint || r.default || '').trim();
        if (!ep) continue; // endpoint 미지정은 기본 검증(warnings)이 담당
        const hit = resolveAccount(ep);
        if (!hit) {
            issues.push(
                `역할 "${r.name}"의 endpoint(${ep})가 이 테넌트의 사용자/에이전트 계정에 없습니다 — 실행 시 담당자 배정 실패("Agent not found") 위험이 있습니다.`
            );
        } else if (serviceRoleNames.value.has(r.name) && !hit.is_agent) {
            issues.push(
                `역할 "${r.name}"은 serviceTask(에이전트 자동) 담당인데 endpoint(${ep})가 에이전트 계정(is_agent)이 아닙니다 — 실행 시 "Agent not found"로 실패합니다. 에이전트 계정으로 바꾸세요.`
            );
        }
    }
    return issues;
});

/* -------------------- 담당자(에이전트) 생성 -------------------- */

const agentDialog = ref({ open: false, name: '', role: '', goal: '', assignRole: '', saving: false, error: '' });

function openAgentDialog(targetRole = '') {
    agentDialog.value = { open: true, name: '', role: '', goal: '', assignRole: targetRole, saving: false, error: '' };
}

/** users 테이블에 is_agent 계정 생성 (조직도 AgentCrudMixin 과 동일한 putAgent 경로). */
async function createAgent() {
    const d = agentDialog.value;
    const name = d.name.trim();
    if (!name) {
        d.error = '이름을 입력하세요.';
        return;
    }
    d.saving = true;
    d.error = '';
    try {
        const id =
            typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `agent-${Date.now()}`;
        await execBackend.putAgent({
            id,
            name,
            role: d.role.trim(),
            goal: d.goal.trim(),
            description: '',
            isAgent: true,
            type: 'agent'
        });
        await loadTenantUsers();
        if (d.assignRole && !props.readonly) assignRoleEndpoint(d.assignRole, id);
        d.open = false;
    } catch (e: any) {
        d.error = e?.message || '에이전트 생성에 실패했습니다.';
    } finally {
        d.saving = false;
    }
}

/** 역할(Lane) 단위 담당 배정 — 역할·담당자 탭 인라인 선택에서 즉시 반영. */
function assignRoleEndpoint(roleName: string, endpoint: string | null) {
    const def = JSON.parse(JSON.stringify(definition.value));
    const role = (def.roles || []).find((r: any) => r.name === roleName);
    if (!role) return;
    const ep = String(endpoint || '').trim();
    role.endpoint = ep || undefined;
    role.default = ep || undefined;
    emit('updateDefinition', def);
}

/**
 * 태스크 단위 담당 배정 — 엔진은 role_bindings(역할→endpoint)로만 배정하므로:
 *  1) 담당이 그대로면 아무것도 안 함
 *  2) 이 태스크만 쓰는 역할이면 그 역할의 endpoint 를 교체
 *  3) 같은 담당의 기존 역할이 있으면 그 역할로 갈아탐
 *  4) 아니면 전용 역할을 새로 만들어 배정 (역할 공유 태스크에 영향 없음)
 */
function applyActivityAssignee(def: any, actId: string, d: any) {
    const act = (def.activities || []).find((x: any) => x.id === actId);
    if (!act) return;
    const assignee = String(d.assignee || '').trim();
    if (!assignee) return;
    const roles: any[] = def.roles || (def.roles = []);
    const role = roles.find((r: any) => r.name === act.role);
    const current = role ? String(role.endpoint || role.default || '').trim() : '';
    if (assignee === current) return;

    const usedElsewhere = [
        ...(def.activities || []).filter((x: any) => x.id !== actId),
        ...(def.gateways || []),
        ...(def.events || [])
    ].some((x: any) => x.role && x.role === act.role);

    if (role && !usedElsewhere) {
        role.endpoint = assignee;
        role.default = assignee;
        return;
    }
    const sameEndpointRole = roles.find((r: any) => String(r.endpoint || r.default || '').trim() === assignee);
    if (sameEndpointRole) {
        act.role = sameEndpointRole.name;
        return;
    }
    const account = resolveAccount(assignee);
    const base = `${account?.username || assignee} 전담`;
    const names = new Set(roles.map((r: any) => r.name));
    let name = base;
    let i = 2;
    while (names.has(name)) name = `${base} ${i++}`;
    roles.push({ name, endpoint: assignee, default: assignee });
    act.role = name;
}

/** 실행 타입 → 캔버스 diff 마커 (added=초록/에이전트, split=파랑/스크립트). */
const typeMarkers = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const a of definition.value.activities || []) {
        if (a.type === 'serviceTask') out[a.id] = 'added';
        else if (a.type === 'scriptTask') out[a.id] = 'split';
    }
    return out;
});

// 마커 배치가 바뀔 때(타입 수정 포함)만 캔버스를 다시 그린다 — 필드 수정마다 줌이 풀리지 않게.
const markerSig = computed(() =>
    Object.entries(typeMarkers.value)
        .map(([k, v]) => `${k}:${v}`)
        .sort()
        .join('|')
);
const renderKey = computed(() => `${props.executable?.generated_at || ''}-${(props.sourceXml || '').length}-${markerSig.value}`);

const stats = computed(() => {
    const acts = definition.value.activities || [];
    return {
        activities: acts.length,
        automated: acts.filter((a: any) => a.type === 'serviceTask' || a.type === 'scriptTask').length,
        gateways: (definition.value.gateways || []).length,
        conditions: branchConditions.value.length,
        roles: (definition.value.roles || []).length
    };
});

const branchConditions = computed(() => {
    const gwById = new Map((definition.value.gateways || []).map((g: any) => [g.id, g]));
    const out: Array<{ seqId: string; gateway: string; label: string; condition: string }> = [];
    for (const s of definition.value.sequences || []) {
        let cf = '';
        try {
            cf = s.properties ? JSON.parse(s.properties)?.conditionFunction || '' : '';
        } catch {
            cf = '';
        }
        if (!cf && s.condition) cf = String(s.condition);
        if (!cf) continue;
        const g: any = gwById.get(s.source);
        out.push({ seqId: s.id, gateway: g?.name || s.source, label: s.name || s.target, condition: cf });
    }
    return out;
});

const TYPE_META: Record<string, { label: string; color: string }> = {
    userTask: { label: '사람', color: 'grey' },
    serviceTask: { label: '에이전트 자동', color: 'green' },
    scriptTask: { label: '스크립트 자동', color: 'blue' }
};
function typeMeta(t: string) {
    return TYPE_META[t] || { label: t, color: 'grey' };
}

const detailTabs = computed(() => [
    {
        key: 'validation',
        label: '검증',
        icon: 'mdi-shield-check-outline',
        count: validation.value.errors.length + validation.value.warnings.length + assigneeIssues.value.length,
        color:
            hasErrors.value || assigneeIssues.value.length
                ? 'error'
                : validation.value.warnings.length
                  ? 'warning'
                  : 'success'
    },
    { key: 'activities', label: '액티비티', icon: 'mdi-format-list-checks', count: stats.value.activities },
    { key: 'conditions', label: '분기 조건', icon: 'mdi-source-branch', count: stats.value.conditions },
    { key: 'roles', label: '역할·담당자', icon: 'mdi-account-group-outline', count: stats.value.roles }
]);

/* -------------------- 속성 패널 (조회 + 직접 수정) -------------------- */

// readonly(조회 전용)일 때는 모든 필드를 읽기 전용으로 — 값 확인은 가능, 수정은 편집 모드에서만.
const fieldAttrs = computed(() => ({
    density: 'compact' as const,
    variant: 'outlined' as const,
    'hide-details': 'auto' as const,
    class: 'mb-2',
    readonly: !!props.readonly
}));

const ACT_TYPE_ITEMS = [
    { title: '사람 수행 (userTask)', value: 'userTask' },
    { title: '에이전트 자동 (serviceTask)', value: 'serviceTask' },
    { title: '스크립트 자동 (scriptTask)', value: 'scriptTask' }
];
const GW_TYPE_ITEMS = [
    { title: '배타 분기 (exclusiveGateway)', value: 'exclusiveGateway' },
    { title: '병렬 (parallelGateway)', value: 'parallelGateway' },
    { title: '포괄 (inclusiveGateway)', value: 'inclusiveGateway' }
];
const EV_TYPE_ITEMS = [
    { title: '시작 (startEvent)', value: 'startEvent' },
    { title: '종료 (endEvent)', value: 'endEvent' }
];

const KIND_META: Record<string, { label: string; color: string }> = {
    activity: { label: '액티비티', color: 'teal' },
    gateway: { label: '게이트웨이', color: 'orange' },
    event: { label: '이벤트', color: 'deep-purple' },
    sequence: { label: '시퀀스 흐름', color: 'blue-grey' },
    role: { label: '역할', color: 'indigo' },
    unknown: { label: '실행 정의 미포함', color: 'grey' }
};

const selected = ref<{ kind: string; id: string } | null>(null);
const draft = ref<any>(null);
const draftError = ref('');

const kindMeta = computed(() => KIND_META[selected.value?.kind || 'unknown'] || KIND_META.unknown);
const roleNames = computed(() => (definition.value.roles || []).map((r: any) => r.name).filter(Boolean));

// 재변환되면 선택/드래프트가 옛 정의를 가리키므로 패널을 닫는다.
watch(
    () => props.executable?.generated_at,
    () => closePanel()
);

function closePanel() {
    selected.value = null;
    draft.value = null;
    draftError.value = '';
}

function findItem(kind: string, id: string): any {
    const d = definition.value;
    if (kind === 'activity') return (d.activities || []).find((x: any) => x.id === id);
    if (kind === 'gateway') return (d.gateways || []).find((x: any) => x.id === id);
    if (kind === 'event') return (d.events || []).find((x: any) => x.id === id);
    if (kind === 'sequence') return (d.sequences || []).find((x: any) => x.id === id);
    if (kind === 'role') return (d.roles || []).find((x: any) => x.name === id);
    return null;
}

function nodeName(id: string): string {
    for (const kind of ['activity', 'gateway', 'event']) {
        const item = findItem(kind, id);
        if (item) return item.name || id;
    }
    return id;
}

function prettyProps(propString?: string): string {
    if (!propString) return '';
    try {
        return JSON.stringify(JSON.parse(propString), null, 2);
    } catch {
        return String(propString);
    }
}

function buildDraft(kind: string, id: string): any {
    const item = findItem(kind, id);
    if (!item) return null;
    const c = JSON.parse(JSON.stringify(item));
    const out: any = { ...c };
    if (kind !== 'role') out.propertiesText = prettyProps(c.properties);
    if (kind === 'sequence') {
        let cf = '';
        try {
            cf = c.properties ? JSON.parse(c.properties)?.conditionFunction || '' : '';
        } catch {
            cf = '';
        }
        out.conditionFunction = cf || c.condition || '';
    }
    if (kind === 'activity') {
        // 객체 항목({name,...})·"[object Object]" 잔재를 문자열로 정규화해 편집 가능하게
        out.inputData = cleanStringArray(c.inputData);
        out.outputData = cleanStringArray(c.outputData);
        out.checkpoints = cleanStringArray(c.checkpoints);
        out.duration = c.duration != null ? c.duration : '';
        out.assignee = roleEndpointOf(c.role);
    }
    if (kind === 'gateway') out.conditionData = Array.isArray(c.conditionData) ? c.conditionData : [];
    return out;
}

function select(kind: string, id: string) {
    selected.value = { kind, id };
    draftError.value = '';
    draft.value = kind === 'unknown' ? null : buildDraft(kind, id);
    if (kind !== 'unknown' && !draft.value) selected.value = { kind: 'unknown', id };
}

function selectById(id: string) {
    for (const kind of ['activity', 'gateway', 'event', 'sequence']) {
        if (findItem(kind, id)) {
            select(kind, id);
            return;
        }
    }
    select('unknown', id);
}

const CANVAS_IGNORED_TYPES = ['bpmn:Process', 'bpmn:Collaboration', 'bpmn:Participant', 'bpmn:Lane', 'label'];
/**
 * 캔버스 클릭 라우팅 — 원본 XML에 있는 노드는 기존 우측 속성 패널을 그대로 사용한다.
 * 기존 패널이 다루지 못하는 것(시퀀스 conditionFunction, 도면 외 태스크)만 내장 패널로 연다.
 */
function onCanvasElementClick(element: any) {
    if (!element?.id) return;
    const type = String(element.type || '');
    if (CANVAS_IGNORED_TYPES.includes(type)) return;
    if (type === 'bpmn:SequenceFlow' || findItem('sequence', element.id)) {
        select('sequence', element.id);
        return;
    }
    if (props.useExternalPanel && xmlNodeIds.value.has(element.id)) {
        closePanel();
        emit('openElementPanel', element.id);
        return;
    }
    selectById(element.id);
}

/** 캔버스 우클릭 — 좌클릭과 동일 라우팅 (XML 노드 = 기존 속성 패널, 그 외 = 내장 패널). */
function onCanvasElementContextmenu(element: any) {
    if (!element?.id) return;
    onCanvasElementClick(element);
}

// 하단 액티비티/분기/역할 목록 행 클릭은 내장 패널 유지 — 기존 패널이 못 다루는
// 실행 정의 전용 편집(실행 타입 변환·태스크 단위 담당 배정·conditionFunction·도면 외 태스크)의 진입점.

function resetDraft() {
    if (!selected.value) return;
    select(selected.value.kind, selected.value.id);
}

/** properties 텍스트 → JSON 객체 (실패 시 null + 에러 세팅). 빈 문자열은 {} 로 본다. */
function parseDraftProps(): Record<string, any> | null {
    const text = String(draft.value?.propertiesText || '').trim();
    if (!text) return {};
    try {
        const v = JSON.parse(text);
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
        return v;
    } catch {
        draftError.value = 'properties 는 유효한 JSON 객체여야 합니다.';
        return null;
    }
}

function applyDraft() {
    if (!selected.value || !draft.value) return;
    draftError.value = '';
    const kind = selected.value.kind;
    const id = selected.value.id;
    const d = draft.value;

    const bag = kind === 'role' ? {} : parseDraftProps();
    if (bag === null) return;

    const def = JSON.parse(JSON.stringify(definition.value));
    const replaceIn = (arr: any[], match: (x: any) => boolean, build: (cur: any) => any): boolean => {
        const i = (arr || []).findIndex(match);
        if (i < 0) return false;
        arr[i] = build(arr[i]);
        return true;
    };

    let ok = false;
    if (kind === 'activity') {
        ok = replaceIn(def.activities, (x) => x.id === id, (cur) => ({
            ...cur,
            name: d.name || cur.name,
            type: d.type,
            role: d.role || '',
            tool: d.tool || '',
            duration: d.duration === '' || d.duration == null ? undefined : Number(d.duration),
            description: d.description || '',
            instruction: d.instruction || '',
            inputData: [...(d.inputData || [])],
            outputData: [...(d.outputData || [])],
            checkpoints: [...(d.checkpoints || [])],
            pythonCode: d.pythonCode || undefined,
            properties: JSON.stringify(bag)
        }));
        if (ok) applyActivityAssignee(def, id, d);
    } else if (kind === 'gateway') {
        ok = replaceIn(def.gateways, (x) => x.id === id, (cur) => ({
            ...cur,
            name: d.name || '',
            type: d.type,
            role: d.role || '',
            description: d.description || '',
            conditionData: (d.conditionData || []).length ? [...d.conditionData] : undefined,
            properties: JSON.stringify(bag)
        }));
    } else if (kind === 'event') {
        ok = replaceIn(def.events, (x) => x.id === id, (cur) => ({
            ...cur,
            name: d.name || '',
            type: d.type,
            role: d.role || '',
            description: d.description || '',
            properties: JSON.stringify(bag)
        }));
    } else if (kind === 'sequence') {
        // conditionFunction 편의 필드를 properties bag 에 병합 (비우면 키 삭제)
        const sbag: Record<string, any> = { ...(bag as Record<string, any>) };
        const cf = String(d.conditionFunction || '').trim();
        if (cf) sbag.conditionFunction = cf;
        else delete sbag.conditionFunction;
        ok = replaceIn(def.sequences, (x) => x.id === id, (cur) => ({
            ...cur,
            name: d.name || undefined,
            properties: Object.keys(sbag).length ? JSON.stringify(sbag) : undefined
        }));
    } else if (kind === 'role') {
        ok = replaceIn(def.roles, (x) => x.name === id, (cur) => ({
            ...cur,
            endpoint: d.endpoint || undefined,
            default: d.default || undefined,
            resolutionRule: d.resolutionRule || undefined
        }));
    }

    if (!ok) {
        draftError.value = '요소를 찾지 못했습니다. 재변환된 정의인지 확인해 주세요.';
        return;
    }
    emit('updateDefinition', def);
}
</script>

<style scoped>
.execview {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fff;
    position: relative;
}
.execview__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: #f7f7f9;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    flex: 0 0 auto;
    flex-wrap: wrap;
}
.execview__summary {
    font-size: 11.5px;
    color: rgba(0, 0, 0, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 34%;
}
.execview__main {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
}
.execview__canvas {
    flex: 1 1 auto;
    min-width: 0;
    position: relative;
    overflow: hidden;
}
.execview__canvas :deep(.vue-bpmn-diagram-container) {
    height: 100%;
    width: 100%;
}
.execview__panel {
    flex: 0 0 340px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid rgba(0, 0, 0, 0.08);
    background: #fff;
}
.execview__panel-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    background: #fafafb;
    flex: 0 0 auto;
}
.execview__panel-id {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
    font-family: monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
}
.execview__panel-body {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 12px;
}
.execview__panel-foot {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    background: #fafafb;
    flex-wrap: wrap;
}
.execview__mono :deep(textarea) {
    font-family: monospace;
    font-size: 12px;
}
.execview__seqpath {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.7);
    padding: 2px 0 10px;
    flex-wrap: wrap;
}
.execview__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(0, 0, 0, 0.4);
    font-size: 13px;
}
.execview__legend {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 6px 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    background: #fafafb;
    font-size: 11.5px;
    color: rgba(0, 0, 0, 0.6);
    flex: 0 0 auto;
}
.execview__legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
}
.execview__legend-hint {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.4);
}
.execview__legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    display: inline-block;
}
.execview__stat {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
}
.execview__detail {
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    background: #fff;
    max-height: 40%;
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
}
.execview__tabs {
    display: flex;
    gap: 2px;
    padding: 6px 10px 0;
    background: #f7f7f9;
}
.execview__tabs button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: none;
    background: transparent;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.55);
    border-radius: 7px 7px 0 0;
    cursor: pointer;
}
.execview__tabs button.active {
    background: #fff;
    color: rgb(var(--v-theme-primary));
    box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.06);
}
.execview__detail-body {
    overflow-y: auto;
    min-height: 0;
}
.execview__vlist {
    list-style: none;
    margin: 0;
    padding: 8px 12px;
}
.execview__vitem {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12.5px;
    padding: 4px 0;
    color: rgba(0, 0, 0, 0.75);
}
.execview__vitem--error {
    color: #b91c1c;
}
.execview__vitem--warn {
    color: #92400e;
}
.execview__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}
.execview__table th {
    text-align: left;
    padding: 6px 10px;
    background: #fafafb;
    color: rgba(0, 0, 0, 0.5);
    font-weight: 600;
    position: sticky;
    top: 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.execview__table td {
    padding: 6px 10px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.04);
    vertical-align: top;
}
.execview__row {
    cursor: pointer;
}
.execview__row:hover {
    background: rgba(0, 150, 136, 0.05);
}
.execview__row--active {
    background: rgba(0, 150, 136, 0.1);
}
.execview__desc {
    color: rgba(0, 0, 0, 0.6);
    max-width: 320px;
}
.execview__assignee {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
}
.execview__assign-cell {
    min-width: 260px;
    cursor: default;
}
.execview__roles-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    background: #fafafb;
}
.execview__pools {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    background: #f4fbfa;
    flex: 0 0 auto;
    flex-wrap: wrap;
    font-size: 12px;
}
.execview__pools-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.6);
}
.execview__pools--placeholder {
    flex-direction: column;
    background: transparent;
    border: 1px dashed rgba(0, 150, 136, 0.4);
    border-radius: 10px;
    padding: 12px 16px;
    margin-top: 16px;
}
.execview__pools-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.65);
    margin-bottom: 8px;
}
.execview__pools-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
}
.execview__placeholder {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
}
.execview__placeholder-title {
    font-size: 17px;
    font-weight: 700;
    margin-top: 14px;
    color: rgba(0, 0, 0, 0.8);
}
.execview__placeholder-desc {
    font-size: 13px;
    color: rgba(0, 0, 0, 0.55);
    margin-top: 8px;
    line-height: 1.6;
}
.execview__genoverlay {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(2px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 5;
}
</style>
