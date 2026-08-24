<template>
    <v-dialog
        :model-value="modelValue"
        fullscreen
        transition="dialog-bottom-transition"
        :scrim="false"
        @update:model-value="onDialogToggle"
    >
        <div class="studio">
            <!-- App bar -->
            <div class="studio__bar">
                <div class="studio__bar-left">
                    <v-icon color="purple" class="mr-2">mdi-creation</v-icon>
                    <div>
                        <div class="studio__title">To-Be Blueprint Studio</div>
                        <div class="studio__subtitle">{{ processName }}</div>
                    </div>
                </div>

                <div class="studio__bar-center">
                    <div class="studio__viewtoggle">
                        <button v-if="hasAnContext" :class="{ active: viewMode === 'partition' }" @click="viewMode = 'partition'">
                            <v-icon size="15">mdi-vector-rectangle</v-icon> 파티셔닝
                        </button>
                        <button :class="{ active: viewMode === 'tobe' }" @click="viewMode = 'tobe'">
                            <v-icon size="15">mdi-vector-square</v-icon> To-Be
                        </button>
                        <button :class="{ active: viewMode === 'compare' }" @click="viewMode = 'compare'">
                            <v-icon size="15">mdi-compare-horizontal</v-icon> As-Is / To-Be 비교
                        </button>
                        <button v-if="canExec" :class="{ active: viewMode === 'executable' }" @click="viewMode = 'executable'">
                            <v-icon size="15">mdi-play-circle-outline</v-icon> 실행형
                        </button>
                    </div>
                </div>

                <div class="studio__bar-right">
                    <v-btn
                        :color="hasBlueprint ? 'purple' : 'primary'"
                        variant="flat"
                        size="small"
                        :loading="generatingBlueprint"
                        :disabled="readonly"
                        @click="onGenerate"
                    >
                        <v-icon start size="16">{{ hasBlueprint ? 'mdi-refresh' : 'mdi-auto-fix' }}</v-icon>
                        {{ hasBlueprint ? 'Blueprint 재생성하기' : 'Blueprint 생성하기' }}
                    </v-btn>
                    <v-menu v-if="!readonly">
                        <template #activator="{ props: mp }">
                            <v-btn v-bind="mp" icon variant="text" size="small"><v-icon size="18">mdi-dots-vertical</v-icon></v-btn>
                        </template>
                        <v-list density="compact">
                            <v-list-item @click="onSeedFromAsIs">
                                <template #prepend><v-icon size="18">mdi-content-copy</v-icon></template>
                                <v-list-item-title>As-Is 복사로 시작</v-list-item-title>
                            </v-list-item>
                            <v-list-item @click="studio.deriveMapping()">
                                <template #prepend><v-icon size="18">mdi-sitemap-outline</v-icon></template>
                                <v-list-item-title>변화 매핑 재도출</v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-menu>

                    <v-divider vertical class="mx-2" />

                    <v-btn variant="flat" color="success" size="small" :loading="saving" :disabled="readonly || !dirty" @click="onSave">
                        <v-icon start size="16">mdi-content-save</v-icon>
                        저장<span v-if="dirty"> *</span>
                    </v-btn>
                    <v-btn icon variant="text" size="small" @click="onClose"><v-icon>mdi-close</v-icon></v-btn>
                </div>
            </div>

            <!-- Body -->
            <div class="studio__body">
                <!-- Left: Issue backlog -->
                <div v-if="viewMode !== 'partition' && viewMode !== 'executable'" class="studio__left">
                    <IssueSolutionBoard
                        :issues="studio.issues.value"
                        :proposing-issue-id="studio.proposingIssueId.value"
                        :proposing-all="proposingAll"
                        :selected-count="studio.selectedCount.value"
                        :readonly="readonly"
                        @add-issue="(p) => studio.addIssue(p)"
                        @update-issue="(id, p) => studio.updateIssue(id, p)"
                        @remove-issue="(id) => studio.removeIssue(id)"
                        @add-solution="(iid, p) => studio.addSolution(iid, p)"
                        @update-solution="(iid, sid, p) => studio.updateSolution(iid, sid, p)"
                        @remove-solution="(iid, sid) => studio.removeSolution(iid, sid)"
                        @select-solution="(iid, sid) => studio.selectSolution(iid, sid)"
                        @propose="onPropose"
                        @propose-all="onProposeAll"
                    />
                </div>

                <!-- Center: canvas / compare -->
                <div class="studio__center">
                    <template v-if="viewMode === 'partition'">
                        <div class="studio__partition">
                            <AsIsPartitioningStage v-if="hasAnContext" embedded />
                        </div>
                    </template>
                    <template v-else-if="viewMode === 'compare'">
                        <AsIsToBeCompare
                            :as-is-xml="asIsXml"
                            :to-be-xml="studio.blueprintXml.value"
                            :task-map="studio.taskMap.value"
                            :executable="canExec ? studio.executable.value : null"
                            :executable-xml="executableSourceXml"
                            :readonly="readonly"
                            @update-mapping="(id, p) => studio.updateMapping(id, p)"
                            @rederive="studio.deriveMapping()"
                            @open-executable="viewMode = 'executable'"
                        />
                    </template>
                    <template v-else-if="viewMode === 'executable'">
                        <ExecutableProcessView
                            :executable="studio.executable.value"
                            :source-xml="executableSourceXml"
                            :generating="studio.generatingExecutable.value"
                            :applying="studio.applyingExecutable.value"
                            :readonly="readonly"
                            :is-admin="isAdmin"
                            @generate="onGenerateExecutable"
                            @apply="onApplyExecutable"
                            @updateDefinition="onUpdateExecutableDefinition"
                        />
                    </template>
                    <template v-else>
                        <div v-if="hasBlueprint" class="studio__canvas">
                            <div class="studio__canvas-bar">
                                <v-chip size="x-small" variant="flat" color="purple">To-Be</v-chip>
                                <span class="studio__canvas-title">차기 청사진</span>
                                <span v-if="studio.blueprintMeta.value.summary" class="studio__canvas-summary">
                                    {{ studio.blueprintMeta.value.summary }}
                                </span>
                                <v-spacer />
                                <span class="studio__canvas-stat">
                                    노드 {{ studio.blueprintMeta.value.node_count }} · 링크 {{ studio.blueprintMeta.value.link_count }}
                                </span>
                            </div>
                            <div class="studio__canvas-view">
                                <BpmnUengineViewer
                                    :key="'studio-tobe-' + studio.blueprintMeta.value.xml_hash"
                                    :bpmn="studio.blueprintXml.value"
                                    :diffActivities="toBeDiff"
                                />
                            </div>
                        </div>
                        <div v-else class="studio__placeholder">
                            <v-icon size="64" color="purple-lighten-2">mdi-creation</v-icon>
                            <div class="studio__placeholder-title">아직 생성된 To-Be 청사진이 없습니다</div>
                            <div class="studio__placeholder-desc">
                                좌측에서 이슈별 솔루션을 선택한 뒤, 최선의 BPMN 모델을 자동 생성하세요.<br />
                                선택한 솔루션이 없어도 As-Is를 기반으로 개선안을 생성합니다.
                            </div>
                            <v-btn
                                color="primary"
                                variant="flat"
                                size="large"
                                rounded="lg"
                                class="mt-6"
                                :loading="generatingBlueprint"
                                :disabled="readonly"
                                @click="onGenerate"
                            >
                                <v-icon start>mdi-auto-fix</v-icon>
                                Blueprint 생성하기
                            </v-btn>
                            <v-btn variant="text" size="small" class="mt-2" :disabled="readonly" @click="onSeedFromAsIs"
                                >또는 As-Is 복사로 시작</v-btn
                            >
                        </div>
                    </template>

                    <!-- generation overlay -->
                    <div v-if="generatingBlueprint" class="studio__genoverlay">
                        <v-progress-circular indeterminate size="44" width="4" color="purple" />
                        <div class="mt-3 text-body-2">AI가 최선의 To-Be BPMN을 설계하는 중입니다...</div>
                    </div>
                </div>

                <!-- Right: ROI -->
                <div v-if="viewMode !== 'partition' && viewMode !== 'executable'" class="studio__right">
                    <ToBeRoiPanel :issues="studio.issues.value" :roi="studio.roi.value" @update-rate="onUpdateRate" />
                </div>
            </div>
        </div>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, getCurrentInstance, inject } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';
import IssueSolutionBoard from './IssueSolutionBoard.vue';
import ToBeRoiPanel from './ToBeRoiPanel.vue';
import AsIsToBeCompare from './AsIsToBeCompare.vue';
import ExecutableProcessView from './ExecutableProcessView.vue';
import AsIsPartitioningStage from '@/views/an-transformation-studio/stages/AsIsPartitioningStage.vue';
import { useBlueprintStudio } from '@/composables/blueprint/useBlueprintStudio';
import { AN_STUDIO_KEY, type AnStudio } from '@/composables/anStudio/useAnStudio';
import { toBeMarkers } from '@/utils/asisTobeTaskMap';
import { canUseExecFeatures } from '@/utils/execFeatureGate';

const props = defineProps<{
    modelValue: boolean;
    processDefinition: any;
    asIsXml: string;
    defId: string;
    readonly?: boolean;
    /** 실행 정의 등록(실행형 뷰) 권한 — 관리자 전용. */
    isAdmin?: boolean;
    /** 열릴 때 표시할 뷰. partition 은 페이지가 AN_STUDIO_KEY 를 provide 할 때만 유효. */
    initialView?: 'tobe' | 'compare' | 'partition' | 'executable';
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void;
    (e: 'saved'): void;
}>();

const instance = getCurrentInstance();
function toast(type: 'success' | 'error' | 'info' | 'warning', msg: string) {
    const t: any = instance?.appContext?.config?.globalProperties?.$toast;
    if (t && typeof t[type] === 'function') t[type](msg);
    else console[type === 'error' ? 'error' : 'log'](`[BlueprintStudio] ${msg}`);
}

const backend = BackendFactory.createBackend() as any;

// 순서도 페이지가 AN_STUDIO_KEY 를 provide 하면 그 studio 를 공유(단일 persist 소스),
// 없으면 기존처럼 자체 인스턴스를 생성한다(스탠드얼론 호환).
const an = inject<AnStudio | null>(AN_STUDIO_KEY, null);
const ownStudio = an
    ? null
    : useBlueprintStudio({
          backend,
          defId: () => props.defId,
          getProcessDefinition: () => props.processDefinition,
          getAsIsXml: () => props.asIsXml,
          getActor: () => props.processDefinition?.owner?.name || props.processDefinition?.owner
      });
const studio = an ? an.studio : ownStudio!;
const hasAnContext = computed(() => !!an);

const viewMode = ref<'tobe' | 'compare' | 'partition' | 'executable'>('tobe');
// 실행형 뷰는 관리자 전용 — 권한 claims 가 비동기 로드되므로 computed 로 추적
const canExec = computed(() => canUseExecFeatures());
const proposingAll = ref(false);

const processName = computed(() => props.processDefinition?.name || props.defId || '프로세스');
const hasBlueprint = computed(() => studio.hasBlueprint.value);
const generatingBlueprint = computed(() => studio.generatingBlueprint.value);
const saving = computed(() => studio.saving.value);
const dirty = computed(() => studio.dirty.value);
const toBeDiff = computed(() => toBeMarkers(studio.taskMap.value));

watch(
    () => props.modelValue,
    (open) => {
        if (open) {
            // 공유 인스턴스(an.studio)는 페이지에서 이미 load 되어 있고, 재호출 시
            // 자동저장 대기 중인 변경분을 덮어쓸 수 있으므로 자체 인스턴스일 때만 load.
            if (!an) studio.load();
            viewMode.value =
                props.initialView && (props.initialView !== 'partition' || an) && (props.initialView !== 'executable' || canExec.value)
                    ? props.initialView
                    : 'tobe';
            // 진입 시 청사진이 없으면 자동으로 최선의 To-Be BPMN을 생성해 표출 (요구사항)
            // 단, 파티셔닝 확인 목적으로 연 경우에는 생성하지 않는다.
            if (
                viewMode.value !== 'partition' &&
                viewMode.value !== 'executable' &&
                !studio.hasBlueprint.value &&
                !props.readonly &&
                props.asIsXml &&
                !studio.generatingBlueprint.value
            ) {
                onGenerate();
            }
        }
    },
    { immediate: true }
);

async function onGenerate() {
    try {
        await studio.generateBlueprint();
        toast('success', 'To-Be 블루프린트를 생성했습니다.');
        viewMode.value = 'tobe';
    } catch (e: any) {
        toast('error', e?.message || 'To-Be 생성에 실패했습니다. As-Is 복사로 시작할 수 있습니다.');
    }
}

function onSeedFromAsIs() {
    studio.seedBlueprintFromAsIs();
    toast('info', 'As-Is를 복사하여 To-Be 시작점을 만들었습니다.');
}

/* -------------------- 실행형 변환 -------------------- */

// 실행형 캔버스에 표시할 원본 XML — 변환 결과가 있으면 그 변환의 원본을, 없으면 다음 변환에 쓰일 원본을 따른다.
const executableSourceXml = computed(() => {
    const src = studio.executable.value?.source || studio.executableSource().source;
    if (src === 'modularized' && studio.modularizedBpmn.value) return studio.modularizedBpmn.value;
    if (src === 'tobe' && studio.blueprintXml.value) return studio.blueprintXml.value;
    return props.asIsXml;
});

async function onGenerateExecutable() {
    try {
        const result = await studio.generateExecutable();
        if (result.validation.errors.length) {
            toast('warning', `실행형 변환 완료 — 검증 오류 ${result.validation.errors.length}건. 재변환 시 AI에 피드백됩니다.`);
        } else {
            toast('success', '실행형 프로세스로 변환했습니다.');
        }
    } catch (e: any) {
        toast('error', e?.message || '실행형 변환에 실패했습니다.');
    }
}

/** 속성 패널에서 직접 수정한 definition 저장 (tobe.executable autosave — 실행 반영은 재등록 필요). */
function onUpdateExecutableDefinition(definition: any) {
    try {
        const validation = studio.updateExecutableDefinition(definition);
        if (validation?.errors?.length) {
            toast('warning', `수정을 저장했습니다 — 검증 오류 ${validation.errors.length}건. 오류 해결 후 등록할 수 있습니다.`);
        } else {
            toast('success', '수정을 저장했습니다. "실행 정의로 등록"을 눌러야 실행에 반영됩니다.');
        }
    } catch (e: any) {
        toast('error', e?.message || '실행 정의 수정에 실패했습니다.');
    }
}

async function onApplyExecutable() {
    if (!props.isAdmin) {
        toast('warning', '실행 정의 등록은 관리자만 가능합니다.');
        return;
    }
    try {
        const result: any = await studio.applyExecutable();
        const n = result?.generatedFormCount || 0;
        toast(
            'success',
            n
                ? `실행 정의로 등록했습니다 (userTask 폼 ${n}개 자동 생성·연결). 순서도의 실행 버튼으로 인스턴스를 시작할 수 있습니다.`
                : '실행 정의로 등록했습니다. 순서도의 실행 버튼으로 인스턴스를 시작할 수 있습니다.'
        );
    } catch (e: any) {
        toast('error', e?.message || '실행 정의 등록에 실패했습니다.');
    }
}

async function onPropose(issueId: string, opts: { replace: boolean }) {
    try {
        await studio.proposeForIssue(issueId, opts);
        toast('success', 'AI 솔루션 옵션을 제안했습니다.');
    } catch (e: any) {
        toast('error', e?.message || 'AI 솔루션 제안에 실패했습니다.');
    }
}

async function onProposeAll() {
    proposingAll.value = true;
    try {
        await studio.proposeForAllEmpty();
        toast('success', '솔루션이 없는 이슈에 AI 제안을 추가했습니다.');
    } catch (e: any) {
        toast('error', e?.message || 'AI 일괄 제안에 실패했습니다.');
    } finally {
        proposingAll.value = false;
    }
}

function onUpdateRate(rate: number) {
    studio.roi.value.annual_cost_per_fte = rate;
    studio.recomputeBaseline();
}

async function onSave() {
    try {
        await studio.persist();
        toast('success', 'To-Be 블루프린트를 저장했습니다.');
        emit('saved');
    } catch (e: any) {
        toast('error', e?.message || '저장에 실패했습니다.');
    }
}

async function onClose() {
    if (dirty.value && !props.readonly) {
        try {
            await studio.persist();
        } catch {
            /* 저장 실패해도 닫기는 진행 */
        }
    }
    emit('update:modelValue', false);
}

function onDialogToggle(v: boolean) {
    if (!v) onClose();
}

// 공유 인스턴스의 라이프사이클은 페이지(provide 주체)가 관리한다.
onBeforeUnmount(() => {
    if (ownStudio) ownStudio.dispose();
});
</script>

<style scoped>
.studio {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f1f1f4;
}
.studio__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    background: #fff;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    gap: 12px;
    flex: 0 0 auto;
}
.studio__bar-left {
    display: flex;
    align-items: center;
    min-width: 0;
}
.studio__title {
    font-size: 15px;
    font-weight: 800;
    line-height: 1.1;
}
.studio__subtitle {
    font-size: 11.5px;
    color: rgba(0, 0, 0, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 320px;
}
.studio__bar-center {
    flex: 1 1 auto;
    display: flex;
    justify-content: center;
}
.studio__viewtoggle {
    display: inline-flex;
    background: #f0f0f3;
    border-radius: 9px;
    padding: 3px;
}
.studio__viewtoggle button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: none;
    background: transparent;
    padding: 5px 14px;
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.55);
    border-radius: 7px;
    cursor: pointer;
    transition: all 0.18s ease;
}
.studio__viewtoggle button.active {
    background: #fff;
    color: rgb(var(--v-theme-primary));
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.studio__bar-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
}
.studio__body {
    flex: 1 1 auto;
    display: flex;
    min-height: 0;
}
.studio__left {
    flex: 0 0 340px;
    width: 340px;
    min-width: 0;
}
.studio__center {
    flex: 1 1 auto;
    min-width: 0;
    position: relative;
    background: #fff;
    display: flex;
    flex-direction: column;
}
.studio__right {
    flex: 0 0 320px;
    width: 320px;
}
.studio__partition {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    background: #f1f1f4;
}
.studio__canvas {
    display: flex;
    flex-direction: column;
    height: 100%;
}
.studio__canvas-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: #f7f7f9;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.studio__canvas-title {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
    font-weight: 600;
}
.studio__canvas-summary {
    font-size: 11.5px;
    color: rgba(0, 0, 0, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 50%;
}
.studio__canvas-stat {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
}
.studio__canvas-view {
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
}
.studio__canvas-view :deep(.vue-bpmn-diagram-container) {
    height: 100%;
    width: 100%;
}
.studio__placeholder {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
}
.studio__placeholder-title {
    font-size: 17px;
    font-weight: 700;
    margin-top: 14px;
    color: rgba(0, 0, 0, 0.8);
}
.studio__placeholder-desc {
    font-size: 13px;
    color: rgba(0, 0, 0, 0.55);
    margin-top: 8px;
    line-height: 1.6;
}
.studio__genoverlay {
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
