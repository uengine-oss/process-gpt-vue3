<template>
    <!-- 편집기가 다룰 수 없는 구조: 고치지 않고 그대로 보존한다 -->
    <div v-if="block.kind === 'raw'" class="fd-raw">
        <div class="fd-row-bar">
            <v-icon v-if="!nested" class="fd-row-handle" size="16">mdi-drag</v-icon>
            <span class="fd-row-title">편집기에서 바꿀 수 없는 구조 — 그대로 보존됩니다</span>
            <v-spacer />
            <v-btn icon size="x-small" variant="text" title="삭제" @click="designer.removeBlock(section, block, parentList)">
                <v-icon size="16">mdi-delete-outline</v-icon>
            </v-btn>
        </div>
        <div class="fd-raw-fields">{{ designer.rawSummary(block) }}</div>
    </div>

    <div v-else class="fd-row" :class="{ 'is-multi': block.multi, 'is-nested': nested }">
        <div class="fd-row-bar">
            <v-icon v-if="!nested" class="fd-row-handle" size="16">mdi-drag</v-icon>
            <span class="fd-row-title">{{ block.alias || block.name || '제목 없는 행' }}</span>
            <v-chip v-if="block.multi" size="x-small" color="primary" variant="tonal">여러 건 입력</v-chip>
            <v-spacer />
            <v-btn icon size="x-small" variant="text" title="행 설정" @click="designer.openRowSetting(block)">
                <v-icon size="16">mdi-cog-outline</v-icon>
            </v-btn>
            <v-btn icon size="x-small" variant="text" title="행 삭제" @click="designer.removeBlock(section, block, parentList)">
                <v-icon size="16">mdi-delete-outline</v-icon>
            </v-btn>
        </div>

        <div v-for="line in block.lines" :key="line.id" class="fd-line">
            <template v-for="item in line.items" :key="item.id">
                <div v-if="item.kind === 'col'" class="fd-col" :style="{ flexBasis: (item.span / 12) * 100 + '%' }">
                    <!-- vuedraggable 항목은 루트 요소가 하나여야 한다 — 슬롯 안에는 주석도 두지 않는다(노드로 센다) -->
                    <draggable v-model="item.items" item-key="id" group="fields" class="fd-drop" ghost-class="fd-ghost">
                        <template #item="{ element: field }">
                            <div class="fd-item">
                                <div v-if="field.kind === 'field'" class="fd-field" @dblclick="designer.openFieldSetting(field)">
                                    <div class="fd-field-tools">
                                        <v-btn
                                            icon
                                            size="x-small"
                                            variant="flat"
                                            title="설정"
                                            @click.stop="designer.openFieldSetting(field)"
                                        >
                                            <v-icon size="14">mdi-pencil</v-icon>
                                        </v-btn>
                                        <v-btn
                                            icon
                                            size="x-small"
                                            variant="flat"
                                            title="복제"
                                            @click.stop="designer.duplicateField(item, field)"
                                        >
                                            <v-icon size="14">mdi-content-copy</v-icon>
                                        </v-btn>
                                        <v-btn
                                            icon
                                            size="x-small"
                                            variant="flat"
                                            title="삭제"
                                            @click.stop="designer.removeField(item, field)"
                                        >
                                            <v-icon size="14">mdi-delete-outline</v-icon>
                                        </v-btn>
                                    </div>
                                    <div v-if="field.tag === 'code-field'" class="fd-code">
                                        <v-icon size="14">mdi-code-braces</v-icon>
                                        {{ field.attrs.alias || field.attrs.name }}
                                    </div>
                                    <!-- 실행 화면과 같은 필드 컴포넌트로 그린다. 입력은 막는다.
                                         스크립트 필드는 설정 다이얼로그용으로만 숨겨서 띄운다 -->
                                    <div v-show="field.tag !== 'code-field'" class="fd-field-view">
                                        <DynamicComponent
                                            :key="field.id + ':' + (designer.versions[field.id] || 0)"
                                            :ref="(vm) => designer.setFieldRef(field.id, vm)"
                                            :content="designer.renderHtml(field)"
                                            :vueRenderUUID="field.id"
                                        />
                                    </div>
                                </div>
                                <!-- 중첩 레이아웃: 칸 안의 섹션. 안쪽 행도 같은 방식으로 편집한다 -->
                                <div v-else-if="field.kind === 'section'" class="fd-nested">
                                    <FormBlockView
                                        v-for="inner in field.blocks"
                                        :key="inner.id"
                                        :block="inner"
                                        :section="field"
                                        :parentList="item.items"
                                        nested
                                    />
                                </div>
                                <div v-else class="fd-chip is-raw" title="편집기에서 바꿀 수 없는 요소 — 그대로 보존됩니다">
                                    보존된 요소
                                </div>
                            </div>
                        </template>
                    </draggable>
                </div>
                <!-- 칸 밖에 놓인 필드(주로 code-field) -->
                <div v-else-if="item.kind === 'field'" class="fd-chip is-loose" @click="designer.openFieldSetting(item)">
                    <v-icon size="14">{{ item.tag === 'code-field' ? 'mdi-code-braces' : 'mdi-form-textbox' }}</v-icon>
                    {{ item.attrs.alias || item.attrs.name || item.tag }}
                    <DynamicComponent
                        v-show="false"
                        :key="item.id + ':' + (designer.versions[item.id] || 0)"
                        :ref="(vm) => designer.setFieldRef(item.id, vm)"
                        :content="designer.renderHtml(item)"
                        :vueRenderUUID="item.id"
                    />
                </div>
                <div v-else class="fd-chip is-raw" title="편집기에서 바꿀 수 없는 요소 — 그대로 보존됩니다">보존된 요소</div>
            </template>
        </div>
    </div>
</template>

<script>
import draggable from 'vuedraggable';
import DynamicComponent from '@/components/designer/DynamicComponent.vue';

/**
 * 폼 편집기의 행 하나(또는 보존 블록). 칸 안에 섹션이 있으면 자기 자신으로 다시 그린다.
 * 편집 동작은 FormDesigner가 맡는다(provide: designer).
 */
export default {
    name: 'FormBlockView',
    components: { draggable, DynamicComponent },
    inject: ['designer'],
    props: {
        block: { type: Object, required: true },
        // 이 블록을 담은 섹션(최상위 섹션 또는 칸 안의 섹션)
        section: { type: Object, required: true },
        // 칸 안의 섹션일 때, 그 섹션을 담은 칸의 목록(비면 섹션째 지운다)
        parentList: { type: Array, default: null },
        nested: { type: Boolean, default: false }
    }
};
</script>

<style scoped>
.fd-row,
.fd-raw {
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    padding: 4px 8px 8px;
}
.fd-row.is-multi {
    border-color: rgba(var(--v-theme-primary), 0.5);
}
.fd-row.is-nested {
    border-style: dashed;
    margin-bottom: 6px;
}
.fd-raw {
    border-style: dashed;
}
.fd-raw-fields {
    font-size: 12px;
    opacity: 0.75;
}
.fd-row-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
}
.fd-row-handle {
    cursor: grab;
    opacity: 0.6;
}
.fd-row-title {
    font-size: 13px;
    font-weight: 600;
}
.fd-line {
    display: flex;
    flex-wrap: wrap; /* 칸 합이 12를 넘는 행은 실행 화면처럼 다음 줄로 넘어간다 */
    margin: 0 -4px;
}
.fd-col {
    padding: 0 4px;
    min-width: 0;
}
/* 좁은 칸에서는 열을 세로로 쌓는다(저장되는 칸 너비 spans 는 그대로) */
@container fd (max-width: 420px) {
    .fd-col {
        flex: 0 0 100% !important;
        max-width: 100%;
    }
}
.fd-drop {
    min-height: 44px;
    height: 100%;
    border-radius: 6px;
    border: 1px dashed transparent;
}
.fd-row:hover > .fd-line .fd-drop {
    border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
.fd-field {
    position: relative;
    border-radius: 6px;
    padding: 2px;
}
.fd-field:hover {
    outline: 1px solid rgb(var(--v-theme-primary));
}
.fd-field-view {
    pointer-events: none; /* 편집 중에는 입력을 막는다 */
}
.fd-field-tools {
    position: absolute;
    top: -10px;
    right: 4px;
    z-index: 1;
    display: none;
    gap: 2px;
}
.fd-field:hover .fd-field-tools {
    display: flex;
}
.fd-code {
    font-size: 12px;
    padding: 6px 8px;
    border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 6px;
}
.fd-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 12px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 999px;
    user-select: none;
    background: rgb(var(--v-theme-surface));
}
.fd-chip.is-raw {
    border-style: dashed;
    opacity: 0.7;
}
.fd-chip.is-loose {
    cursor: pointer;
    margin: 2px 4px;
}
.fd-ghost {
    opacity: 0.4;
}
</style>
