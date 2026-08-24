<template>
    <v-dialog
        :model-value="modelValue"
        max-width="680"
        :persistent="converting"
        scrollable
        @update:model-value="$emit('update:modelValue', $event)"
    >
        <v-card v-if="preview" class="ptn-preview">
            <v-card-title class="ptn-preview__title">
                <v-icon size="20" class="mr-2">mdi-call-split</v-icon>
                Call Activity 변환 미리보기
            </v-card-title>
            <v-card-subtitle class="ptn-preview__subtitle">
                블록 <strong>{{ preview.convertibleCount }}</strong>개가 Call Activity 로 변환됩니다. 변환 전 배정 결과를 확인하세요.
            </v-card-subtitle>

            <v-card-text class="ptn-preview__body">
                <!-- 블록별 멤버 -->
                <div v-for="block in preview.blocks" :key="block.id" class="ptn-preview__block" :class="{ 'ptn-preview__block--excluded': block.excluded }">
                    <div class="ptn-preview__block-head">
                        <span class="ptn-preview__dot" :style="{ background: colorOf(block) }"></span>
                        <span class="ptn-preview__block-name">{{ block.name }}</span>
                        <span v-if="block.etomProcessId" class="ptn-preview__etom">{{ block.etomProcessId }}</span>
                        <v-spacer />
                        <span v-if="block.excluded" class="ptn-preview__badge ptn-preview__badge--excluded">변환 제외</span>
                        <span v-else class="ptn-preview__count">{{ block.members.length }}개 노드</span>
                    </div>
                    <div v-if="block.members.length" class="ptn-preview__members">
                        <span v-for="m in block.members" :key="m.id" class="ptn-preview__member">{{ m.name }}</span>
                    </div>
                    <div v-else class="ptn-preview__empty-note">배정된 노드가 없어 이 블록은 변환에서 제외됩니다.</div>
                    <div v-if="block.missingIds.length" class="ptn-preview__missing">
                        도면에 없는 ID {{ block.missingIds.length }}건은 무시됩니다: {{ block.missingIds.join(', ') }}
                    </div>
                </div>

                <!-- 미배정 경고 -->
                <div v-if="preview.unassigned.length" class="ptn-preview__section ptn-preview__section--warn">
                    <div class="ptn-preview__section-head">
                        <v-icon size="16" color="warning">mdi-alert-outline</v-icon>
                        미배정 노드 {{ preview.unassigned.length }}개 — 원본 흐름에 그대로 남습니다
                    </div>
                    <div class="ptn-preview__members">
                        <span v-for="n in preview.unassigned" :key="n.id" class="ptn-preview__member ptn-preview__member--warn">{{ n.name }}</span>
                    </div>
                </div>

                <!-- 블록 간 교차 시퀀스 플로우 -->
                <div v-if="preview.crossFlows.length" class="ptn-preview__section">
                    <div class="ptn-preview__section-head">
                        <v-icon size="16">mdi-arrow-decision-outline</v-icon>
                        블록 간 연결 {{ preview.crossFlows.length }}건 — Call Activity 사이 흐름으로 재배선됩니다
                    </div>
                    <div v-for="flow in preview.crossFlows" :key="flow.flowId" class="ptn-preview__flow">
                        <span class="ptn-preview__flow-side">
                            <span class="ptn-preview__dot ptn-preview__dot--sm" :style="{ background: blockColorById(flow.fromBlockId) }"></span>
                            <span class="ptn-preview__flow-block">{{ blockNameById(flow.fromBlockId) }}</span>
                            <span class="ptn-preview__flow-node">{{ flow.fromNode.name }}</span>
                        </span>
                        <v-icon size="14" class="ptn-preview__flow-arrow">mdi-arrow-right</v-icon>
                        <span class="ptn-preview__flow-side">
                            <span class="ptn-preview__dot ptn-preview__dot--sm" :style="{ background: blockColorById(flow.toBlockId) }"></span>
                            <span class="ptn-preview__flow-block">{{ blockNameById(flow.toBlockId) }}</span>
                            <span class="ptn-preview__flow-node">{{ flow.toNode.name }}</span>
                        </span>
                    </div>
                </div>

                <div v-if="preview.convertibleCount === 0" class="ptn-preview__section ptn-preview__section--warn">
                    <div class="ptn-preview__section-head">
                        <v-icon size="16" color="warning">mdi-alert-outline</v-icon>
                        변환 가능한 블록이 없습니다. 편집으로 돌아가 노드를 배정하세요.
                    </div>
                </div>
            </v-card-text>

            <v-card-actions class="ptn-preview__actions">
                <v-spacer />
                <v-btn variant="text" :disabled="converting" @click="$emit('update:modelValue', false)">취소 (편집으로 돌아가기)</v-btn>
                <v-btn
                    color="primary"
                    variant="flat"
                    :loading="converting"
                    :disabled="converting || preview.convertibleCount === 0"
                    @click="$emit('confirm')"
                >
                    변환 진행
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { partitionColor } from '@/composables/blueprint/partitionEditing';

/**
 * 파티션 → Call Activity 변환 미리보기 다이얼로그 (specs/011 US2).
 * 계약: specs/011-partition-edit-ux/contracts/component-events.md
 * preview 는 computeCommitPreview 결과(CommitPreview)를 그대로 받는다.
 */
export default {
    name: 'PartitionCommitPreviewDialog',
    props: {
        modelValue: { type: Boolean, default: false },
        preview: { type: Object, default: null },
        converting: { type: Boolean, default: false }
    },
    emits: ['update:modelValue', 'confirm'],
    computed: {
        blockById() {
            const map = {};
            (this.preview?.blocks || []).forEach((b) => {
                map[b.id] = b;
            });
            return map;
        }
    },
    methods: {
        colorOf(block) {
            return partitionColor(block?.colorIdx);
        },
        blockNameById(blockId) {
            if (!blockId) return '미배정';
            return this.blockById[blockId]?.name || blockId;
        },
        blockColorById(blockId) {
            if (!blockId) return '#94a3b8';
            const block = this.blockById[blockId];
            return block ? partitionColor(block.colorIdx) : '#94a3b8';
        }
    }
};
</script>

<style scoped>
.ptn-preview__title {
    display: flex;
    align-items: center;
    font-size: 16px;
    font-weight: 700;
}

.ptn-preview__subtitle {
    white-space: normal;
    padding-bottom: 8px;
}

.ptn-preview__body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 8px;
}

.ptn-preview__block {
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 10px;
    padding: 8px 12px;
}

.ptn-preview__block--excluded {
    background: rgba(0, 0, 0, 0.03);
    opacity: 0.75;
}

.ptn-preview__block-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 26px;
}

.ptn-preview__dot {
    flex-shrink: 0;
    width: 11px;
    height: 11px;
    border-radius: 50%;
}

.ptn-preview__dot--sm {
    width: 8px;
    height: 8px;
}

.ptn-preview__block-name {
    font-size: 13.5px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.82);
}

.ptn-preview__etom {
    flex-shrink: 0;
    padding: 0 6px;
    border-radius: 5px;
    background: rgba(var(--v-theme-primary), 0.08);
    color: rgb(var(--v-theme-primary));
    font-size: 11px;
    font-weight: 600;
}

.ptn-preview__count {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.55);
}

.ptn-preview__badge {
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
}

.ptn-preview__badge--excluded {
    background: rgba(0, 0, 0, 0.08);
    color: rgba(0, 0, 0, 0.55);
}

.ptn-preview__members {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
    margin-top: 6px;
}

.ptn-preview__member {
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.05);
    color: rgba(0, 0, 0, 0.7);
    font-size: 12px;
}

.ptn-preview__member--warn {
    background: rgba(255, 168, 0, 0.12);
    color: #8a5a00;
}

.ptn-preview__empty-note {
    margin-top: 4px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.5);
    font-style: italic;
}

.ptn-preview__missing {
    margin-top: 6px;
    font-size: 11.5px;
    color: rgba(0, 0, 0, 0.5);
}

.ptn-preview__section {
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 10px;
    padding: 8px 12px;
}

.ptn-preview__section--warn {
    border-color: rgba(255, 168, 0, 0.45);
    background: rgba(255, 168, 0, 0.05);
}

.ptn-preview__section-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.75);
}

.ptn-preview__flow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 12px;
}

.ptn-preview__flow-side {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
}

.ptn-preview__flow-block {
    font-weight: 700;
    color: rgba(0, 0, 0, 0.72);
    flex-shrink: 0;
}

.ptn-preview__flow-node {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(0, 0, 0, 0.55);
}

.ptn-preview__flow-arrow {
    flex-shrink: 0;
    color: rgba(0, 0, 0, 0.4);
}

.ptn-preview__actions {
    padding: 8px 16px 14px;
}
</style>
