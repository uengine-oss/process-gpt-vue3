<template>
    <div class="form-designer">
        <!-- 팔레트: 폼 왼쪽의 좁은 세로 줄. 폼의 세로 공간을 쓰지 않는다(이름은 툴팁) -->
        <aside class="fd-rail" :class="{ 'is-disabled': previewing }">
            <v-menu location="end top">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" icon size="small" variant="tonal" color="primary" aria-label="행 추가">
                        <v-icon size="18">mdi-table-row-plus-after</v-icon>
                        <v-tooltip activator="parent" location="end">행 추가</v-tooltip>
                    </v-btn>
                </template>
                <v-list density="compact">
                    <v-list-item v-for="template in rowTemplates" :key="template.label" @click="addRow(template.spans)">
                        <div class="fd-template">
                            <span v-for="(span, i) in template.spans" :key="i" :style="{ flex: span }"></span>
                        </div>
                        <v-list-item-title class="text-caption">{{ template.label }}</v-list-item-title>
                    </v-list-item>
                </v-list>
            </v-menu>

            <div class="fd-rail-divider"></div>

            <draggable
                class="fd-palette"
                :list="palette"
                :group="{ name: 'fields', pull: 'clone', put: false }"
                :clone="newFieldFromPalette"
                :sort="false"
                item-key="tag"
            >
                <template #item="{ element }">
                    <div class="fd-rail-item" :aria-label="element.label" @click="appendField(element)">
                        <v-icon size="18">{{ element.icon }}</v-icon>
                        <v-tooltip activator="parent" location="end">{{ element.label }} — 끌어다 놓거나 누르세요</v-tooltip>
                    </div>
                </template>
            </draggable>
        </aside>

        <div class="fd-canvas" :class="{ 'is-ai-preview': previewing }">
            <div v-if="previewing" class="fd-ai-banner">
                <v-progress-circular indeterminate size="14" width="2" color="primary" />
                AI가 폼을 작성하고 있습니다 — 다 받으면 반영됩니다
            </div>
            <div v-if="!form.sections.length" class="fd-empty">왼쪽에서 행을 추가하고 필드를 끌어다 놓으세요.</div>

            <div class="fd-sections">
                <div v-for="section in form.sections" :key="section.id" class="fd-section">
                    <draggable
                        v-model="section.blocks"
                        item-key="id"
                        group="blocks"
                        handle=".fd-row-handle"
                        class="fd-blocks"
                        @end="pruneSections"
                    >
                        <template #item="{ element: block }">
                            <div class="fd-block">
                                <FormBlockView :block="block" :section="section" :class="{ 'is-ai-writing': aiChanged[block.id] }" />
                            </div>
                        </template>
                    </draggable>
                </div>
            </div>
        </div>

        <!-- 설정 다이얼로그는 지금 것을 그대로 쓴다(필드가 가진 settingInfos·validCheck) -->
        <v-dialog v-model="fieldDialog.open" max-width="640">
            <form-definition-panel
                v-if="fieldDialog.open"
                :componentRef="fieldDialog.componentRef"
                @onSave="saveFieldSetting"
                @onClose="fieldDialog.open = false"
            />
        </v-dialog>
        <v-dialog v-model="rowDialog.open" max-width="640">
            <container-setting-panel
                v-if="rowDialog.open"
                sectionId=""
                :containerProps="rowDialog.props"
                @onSave="saveRowSetting"
                @onClose="rowDialog.open = false"
            />
        </v-dialog>
    </div>
</template>

<script>
import draggable from 'vuedraggable';
import FormBlockView from './FormBlockView.vue';
import FormDefinitionPanel from '@/components/designer/modeling/FormDefinitionPanel.vue';
import ContainerSettingPanel from '@/components/designer/modeling/ContainerSettingPanel.vue';
import {
    parseForm,
    serializeForm,
    canonicalForm,
    rebaseForm,
    fieldHtml,
    createRow,
    createField,
    cloneField,
    allFields,
    reuseUnchanged,
    uid
} from '@/utils/formModel';
import { FIELD_PALETTE, ROW_TEMPLATES } from './fieldRegistry';

/**
 * 폼 편집기 — KEditor(Mashup.vue) 대신.
 *
 * 저장 형식은 그대로다. 읽은 HTML을 모델로 바꿔 편집하고, 저장할 때는 고친 행만 새로 쓴다
 * (utils/formModel.js). 아무것도 안 고쳤으면 읽은 문자열 그대로 내보낸다.
 */
export default {
    name: 'FormDesigner',
    components: { draggable, FormBlockView, FormDefinitionPanel, ContainerSettingPanel },
    // 행 컴포넌트(FormBlockView, 중첩 포함)가 편집 동작을 쓴다
    provide() {
        return { designer: this };
    },
    props: {
        // 처음 읽을 폼 HTML(저장 형식). 바뀌면 새로 읽는다
        source: { type: String, default: '' }
    },
    emits: ['update:modelValue'],
    data() {
        return {
            form: parseForm(this.source),
            palette: FIELD_PALETTE,
            rowTemplates: ROW_TEMPLATES,
            versions: {},
            // AI 응답을 받는 중 미리보기(확정 전). 미리보기 동안 편집본은 바뀌지 않는다
            previewing: false,
            aiChanged: {},
            fieldDialog: { open: false, field: null, componentRef: null },
            rowDialog: { open: false, row: null, props: null }
        };
    },
    watch: {
        source(newVal) {
            if (newVal !== serializeForm(this.form)) this.form = parseForm(newVal);
        },
        form: {
            deep: true,
            handler() {
                if (this.previewing) return; // 미리보기는 내보내지 않는다
                const html = serializeForm(this.form);
                if (html !== this.lastEmitted) {
                    this.lastEmitted = html;
                    this.$emit('update:modelValue', html);
                }
            }
        }
    },
    created() {
        // 렌더링 중에 채우므로 반응형으로 두지 않는다(갱신 루프 방지)
        this.fieldRefs = {};
        this.lastEmitted = serializeForm(this.form);
    },
    methods: {
        // ---- 바깥(FormDefinition)에서 쓰는 것 -------------------------------
        /** 확정된 폼 — 미리보기 중이면 미리보기 전의 폼 */
        committed() {
            return this.previewing ? this.committedForm : this.form;
        },
        getFormHtml() {
            return serializeForm(this.committed());
        },
        /** AI에게 주는 기존 폼. 프롬프트가 설명하는 형식(row-layout + 바인딩) 그대로다 */
        getAIInput() {
            return canonicalForm(this.committed());
        },
        /** AI가 돌려준 폼(확정). 바뀌지 않은 행은 원래 HTML로 저장된다 */
        applyAIResult(html) {
            const body = String(html || '')
                .replace(/^\s*<body[^>]*>/i, '')
                .replace(/<\/body>\s*$/i, '');
            const base = this.committed();
            this.endPreview();
            this.form = rebaseForm(parseForm(body), base);
        },
        /**
         * AI가 쓰는 중인 폼을 그린다(실시간). 바뀌지 않은 행은 같은 객체를 써서 다시 그려지지 않고,
         * 작성 중인 행만 새로 그려지며 강조된다. 확정(applyAIResult)·취소(cancelPreview) 전까지 편집본은 그대로다.
         */
        previewAIResult(html) {
            if (!this.previewing) {
                this.committedForm = this.form;
                this.previewing = true;
            }
            try {
                const next = parseForm(html);
                const changed = reuseUnchanged(next, this.form);
                this.aiChanged = Object.fromEntries([...changed].map((id) => [id, true]));
                this.form = next;
                // 작성 중인 행이 보이게 따라간다
                this.$nextTick(() => {
                    const rows = this.$el.querySelectorAll('.is-ai-writing');
                    if (rows.length) rows[rows.length - 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                });
            } catch (error) {
                console.warn('[FormDesigner] 미리보기 실패(다음 조각에서 다시 그린다):', error);
            }
        },
        /** 미리보기를 버리고 원래 폼으로 (멈춤·오류·JSON 아님) */
        cancelPreview() {
            if (!this.previewing) return;
            const base = this.committedForm;
            this.endPreview();
            this.form = base;
        },
        endPreview() {
            this.previewing = false;
            this.committedForm = null;
            this.aiChanged = {};
        },
        isDirty() {
            return serializeForm(this.committed()) !== this.committed().source;
        },

        // ---- 행 ---------------------------------------------------------
        addRow(spans) {
            // 섹션 하나에 행 하나(AI 프롬프트 규칙과 같다)
            this.form.sections.push({ id: uid('section'), wrapped: true, blocks: [createRow(this.form, spans)] });
        },
        /** 행을 다른 섹션으로 옮겨 비게 된 섹션은 지운다 */
        pruneSections() {
            this.form.sections = this.form.sections.filter((section) => section.blocks.length > 0);
        },
        /** parentList: 칸 안의 섹션이면 그 섹션을 담은 칸의 목록 — 섹션이 비면 칸에서도 뺀다 */
        removeBlock(section, block, parentList = null) {
            if (!confirm('이 행을 삭제할까요?')) return;
            section.blocks.splice(section.blocks.indexOf(block), 1);
            if (section.blocks.length) return;
            if (parentList) parentList.splice(parentList.indexOf(section), 1);
            else this.form.sections.splice(this.form.sections.indexOf(section), 1);
        },
        openRowSetting(row) {
            this.rowDialog = { open: true, row, props: { name: row.name, alias: row.alias, isMultiDataMode: row.multi } };
        },
        saveRowSetting(_, props) {
            const row = this.rowDialog.row;
            const hasCode = row.lines.some((line) =>
                line.items.some((item) => item.tag === 'code-field' || (item.items || []).some((f) => f.tag === 'code-field'))
            );
            // 기존 변환기(keditorContentHTMLToDynamicFormHTML)가 막던 조합
            if (props.isMultiDataMode && hasCode) {
                alert('여러 건 입력 행 안에는 스크립트(code-field)를 둘 수 없습니다.');
                return;
            }
            row.name = props.name;
            row.alias = props.alias;
            row.multi = Boolean(props.isMultiDataMode);
            this.rowDialog.open = false;
        },

        // ---- 필드 -------------------------------------------------------
        newFieldFromPalette(item) {
            return createField(this.form, item.tag, item.defaults, this.pendingNames());
        },
        /** 팔레트를 누르면 비어 있는 첫 칸에, 없으면 새 행에 넣는다 */
        appendField(item) {
            let target = null;
            for (const section of this.form.sections) {
                for (const block of section.blocks) {
                    if (block.kind !== 'row') continue;
                    for (const line of block.lines) {
                        target = target || line.items.find((col) => col.kind === 'col' && col.items.length === 0);
                    }
                }
            }
            if (!target) {
                this.addRow([12]);
                const last = this.form.sections[this.form.sections.length - 1].blocks[0];
                target = last.lines[0].items[0];
            }
            target.items.push(createField(this.form, item.tag, item.defaults));
        },
        duplicateField(col, field) {
            col.items.splice(col.items.indexOf(field) + 1, 0, cloneField(this.form, field));
        },
        removeField(col, field) {
            col.items.splice(col.items.indexOf(field), 1);
        },
        pendingNames() {
            return allFields(this.form).map((f) => f.attrs.name);
        },

        openFieldSetting(field) {
            const componentRef = this.fieldRefs[field.id]?.componentRef;
            if (!componentRef || !componentRef.settingInfos || !componentRef.settingInfos.length) {
                alert('해당 입력 요소에 대해서 추가적으로 세팅할 수 있는 항목이 없습니다.');
                return;
            }
            componentRef.settingInfos.forEach((info) => {
                if (info.addOns && info.addOns.includes('inputableNameItems')) {
                    info.settingValue = allFields(this.form)
                        .filter((f) => f.tag !== 'code-field' && f.attrs.name)
                        .map((f) => f.attrs.name);
                }
            });
            this.fieldDialog = { open: true, field, componentRef };
        },
        /** FormDefinitionPanel이 넘긴 값을 Mashup.kEditorContentToHtml과 같은 규칙으로 속성에 쓴다 */
        saveFieldSetting(componentRef, componentProps) {
            const field = this.fieldDialog.field;
            const prevName = field.attrs.name;
            componentRef.settingInfos.forEach((info) => {
                componentRef[info.dataToUse] = componentProps[info.dataToUse];
                const value = componentRef[info.dataToUse];
                if (value === undefined) return;
                if (info.settingType === 'items') {
                    field.attrs[info.htmlAttribute] = JSON.stringify(value);
                } else if (info.addOns && info.addOns.includes('savedAsInnerText')) {
                    field.inner = info.addOns.includes('encodedAsBase64') ? decodeURIComponent(atob(value)) : String(value);
                    delete field.attrs[info.htmlAttribute];
                } else {
                    field.attrs[info.htmlAttribute] = value === null ? '' : String(value);
                }
            });
            if (field.attrs.name !== prevName) field.bindKey = null; // 이름을 바꾸면 바인딩도 이름을 따른다
            this.versions = { ...this.versions, [field.id]: (this.versions[field.id] || 0) + 1 };
            this.fieldDialog.open = false;
        },

        // ---- 렌더링 -----------------------------------------------------
        renderHtml(field) {
            const html = fieldHtml(field);
            if (field.tag !== 'code-field') return html;
            // CodeField는 스크립트를 encoded_code 속성으로 받는다(Mashup이 읽을 때 하던 변환)
            const text = new DOMParser().parseFromString(field.inner || '', 'text/html').body.textContent || '';
            return html.replace('<code-field', `<code-field encoded_code="${btoa(encodeURIComponent(text))}"`);
        },
        setFieldRef(id, vm) {
            if (vm) this.fieldRefs[id] = vm;
        },
        rawSummary(block) {
            const doc = new DOMParser().parseFromString(block.html, 'text/html');
            const names = Array.from(doc.querySelectorAll('*'))
                .filter((el) => el.tagName.toLowerCase().endsWith('-field'))
                .map((el) => el.getAttribute('alias') || el.getAttribute('name'));
            return names.length ? `필드: ${names.join(', ')}` : '';
        }
    }
};
</script>

<style scoped>
.form-designer {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr); /* 팔레트 줄 · 폼 — 서로 겹치지 않는다 */
    gap: 8px;
    padding: 4px 8px 16px 2px;
}
.fd-rail {
    position: sticky; /* 폼을 내려도 팔레트는 제자리에 */
    top: 0;
    align-self: start;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 0;
    max-height: calc(100vh - 280px);
    overflow-y: auto;
    border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: rgb(var(--v-theme-surface));
}
.fd-rail.is-disabled {
    pointer-events: none;
    opacity: 0.4;
}
.fd-rail-divider {
    width: 20px;
    margin: 4px 0;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.fd-palette {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.fd-rail-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    cursor: grab;
    user-select: none;
}
.fd-rail-item:hover {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
}
.fd-canvas {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
}
.fd-ai-banner {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    font-size: 12px;
    border-radius: 6px;
    background: rgba(var(--v-theme-primary), 0.08);
    color: rgb(var(--v-theme-primary));
}
/* 미리보기 중에는 편집하지 않는다 — 미리보기는 원래 폼과 객체를 공유하므로 끌어다 놓기도 막는다 */
.fd-canvas.is-ai-preview .fd-sections {
    pointer-events: none;
}
.fd-canvas.is-ai-preview :deep(.fd-field-tools),
.fd-canvas.is-ai-preview :deep(.fd-row-bar .v-btn) {
    visibility: hidden;
}
.fd-canvas :deep(.is-ai-writing) {
    outline: 2px solid rgba(var(--v-theme-primary), 0.6);
    border-radius: 8px;
    animation: fd-ai-pulse 1.2s ease-in-out infinite;
}
@keyframes fd-ai-pulse {
    50% {
        outline-color: rgba(var(--v-theme-primary), 0.2);
    }
}
.fd-template {
    display: flex;
    gap: 2px;
    width: 72px;
    height: 10px;
    margin-bottom: 2px;
}
.fd-template span {
    background: rgba(var(--v-theme-primary), 0.35);
    border-radius: 2px;
}
.fd-empty {
    padding: 24px;
    text-align: center;
    font-size: 13px;
    opacity: 0.7;
    border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
}
.fd-sections,
.fd-blocks {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
</style>
