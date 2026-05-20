<template>
    <div class="ktn-node">
        <div
            class="ktn-folder-row"
            :style="{ paddingLeft: `${8 + depth * 16}px` }"
            @click="$emit('toggle-folder', node.path)"
        >
            <v-icon size="14" class="ktn-caret">{{ isOpen ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
            <v-checkbox
                :modelValue="folderState.checked"
                :indeterminate="folderState.indeterminate"
                @update:modelValue="(v) => $emit('toggle-folder-select', { node, select: !!v })"
                @click.stop
                density="compact"
                hide-details
                color="primary"
                class="ktn-checkbox"
            />
            <v-icon size="16" :color="isOpen ? '#FFA726' : '#8D8D8D'">
                {{ isOpen ? 'mdi-folder-open' : 'mdi-folder' }}
            </v-icon>
            <span class="ktn-folder-name">{{ node.name }}</span>
            <span class="ktn-folder-count">{{ node.descendantCount }}</span>
        </div>

        <div v-if="isOpen" class="ktn-children">
            <KnowledgeTreeNode
                v-for="child in node.children"
                :key="child.path"
                :node="child"
                :depth="depth + 1"
                :expanded="expanded"
                :selectedKeysSet="selectedKeysSet"
                @toggle-folder="(p) => $emit('toggle-folder', p)"
                @toggle-file="(f) => $emit('toggle-file', f)"
                @toggle-folder-select="(p) => $emit('toggle-folder-select', p)"
                @open-file="(f) => $emit('open-file', f)"
            />
            <div
                v-for="f in node.files"
                :key="f.key"
                class="ktn-file-row"
                :class="{ 'is-selected': selectedKeysSet.has(f.key) }"
                :style="{ paddingLeft: `${8 + (depth + 1) * 16 + 14}px` }"
                @click="$emit('toggle-file', f)"
            >
                <v-checkbox
                    :modelValue="selectedKeysSet.has(f.key)"
                    @update:modelValue="$emit('toggle-file', f)"
                    @click.stop
                    density="compact"
                    hide-details
                    color="primary"
                    class="ktn-checkbox"
                />
                <v-icon size="16" :color="iconOf(f.name).color">{{ iconOf(f.name).icon }}</v-icon>
                <span class="ktn-file-name">{{ f.name }}</span>
                <span
                    v-if="f.docRole && f.docRole !== 'content'"
                    class="ktn-role-badge"
                    :class="`is-${f.docRole}`"
                >
                    {{ roleShort(f.docRole) }}
                </span>
                <span v-if="f.indexStatus && f.indexStatus !== 'indexed'" class="ktn-status-badge" :class="`is-${f.indexStatus}`">
                    {{ statusLabel(f.indexStatus) }}
                </span>
                <v-tooltip :text="f.sourceType === 'drive' ? 'Drive에서 보기' : '다운로드'" location="top">
                    <template v-slot:activator="{ props }">
                        <v-btn
                            v-bind="props"
                            icon
                            variant="text"
                            size="x-small"
                            class="ktn-file-action"
                            @click.stop="$emit('open-file', f)"
                        >
                            <v-icon size="14">
                                {{ f.sourceType === 'drive' ? 'mdi-open-in-new' : 'mdi-download-outline' }}
                            </v-icon>
                        </v-btn>
                    </template>
                </v-tooltip>
            </div>
        </div>
    </div>
</template>

<script>
import { mimeIcon } from '@/utils/fileIcon';

function extToMime(name) {
    const ext = (name || '').split('.').pop()?.toLowerCase() || '';
    const map = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        hwp: 'application/x-hwp',
        hwpx: 'application/vnd.hancom.hwpx',
        md: 'text/markdown',
        txt: 'text/plain'
    };
    return map[ext] || '';
}

function collectFilesUnder(node) {
    const out = [...node.files];
    for (const c of node.children) out.push(...collectFilesUnder(c));
    return out;
}

export default {
    name: 'KnowledgeTreeNode',
    props: {
        node: { type: Object, required: true },
        depth: { type: Number, default: 0 },
        expanded: { type: Set, required: true },
        selectedKeysSet: { type: Set, required: true }
    },
    emits: ['toggle-folder', 'toggle-file', 'toggle-folder-select', 'open-file'],
    computed: {
        isOpen() {
            return this.expanded.has(this.node.path);
        },
        folderState() {
            const all = collectFilesUnder(this.node);
            if (all.length === 0) return { checked: false, indeterminate: false };
            const sel = all.filter((f) => this.selectedKeysSet.has(f.key)).length;
            return {
                checked: sel === all.length,
                indeterminate: sel > 0 && sel < all.length
            };
        }
    },
    methods: {
        iconOf(name) {
            return mimeIcon(extToMime(name));
        },
        statusLabel(s) {
            return {
                pending: '대기',
                processing: '처리중',
                failed: '실패',
                excluded: '제외'
            }[s] || '';
        },
        roleShort(r) {
            return { glossary: '사전', template: '양식', reference: '참조' }[r] || '';
        }
    }
};
</script>

<style scoped>
.ktn-folder-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
}

.ktn-folder-row:hover {
    background: rgba(0, 0, 0, 0.04);
}

.ktn-caret {
    flex: 0 0 auto;
    color: rgba(0, 0, 0, 0.45);
}

.ktn-checkbox {
    flex: 0 0 auto;
}

.ktn-checkbox :deep(.v-selection-control) {
    min-height: 22px;
}

.ktn-folder-name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.85);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ktn-folder-count {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
    background: rgba(0, 0, 0, 0.05);
    border-radius: 10px;
    padding: 1px 7px;
}

.ktn-file-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid transparent;
}

.ktn-file-row:hover {
    background: rgba(var(--v-theme-primary), 0.04);
}

.ktn-file-row.is-selected {
    background: rgba(var(--v-theme-primary), 0.08);
    border-color: rgba(var(--v-theme-primary), 0.2);
}

.ktn-file-name {
    flex: 1;
    font-size: 13px;
    color: rgba(0, 0, 0, 0.8);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ktn-status-badge {
    flex: 0 0 auto;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    font-weight: 500;
}

.ktn-status-badge.is-pending {
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.55);
}

.ktn-status-badge.is-processing {
    background: rgba(33, 150, 243, 0.12);
    color: #1976d2;
}

.ktn-status-badge.is-failed {
    background: rgba(244, 67, 54, 0.12);
    color: #c62828;
}

.ktn-status-badge.is-excluded {
    background: rgba(158, 158, 158, 0.18);
    color: #616161;
}

/* doc_role badge — 트리 모드 파일 행에서 역할 시각화 */
.ktn-role-badge {
    flex: 0 0 auto;
    font-size: 10px;
    padding: 1px 7px;
    border-radius: 8px;
    font-weight: 500;
}

.ktn-role-badge.is-glossary  { background: rgba(123, 31, 162, 0.12); color: #7b1fa2; }
.ktn-role-badge.is-template  { background: rgba(239, 108, 0, 0.12);  color: #ef6c00; }
.ktn-role-badge.is-reference { background: rgba(56, 142, 60, 0.12);  color: #388e3c; }
.ktn-role-badge.is-dataset   { background: rgba(0, 137, 123, 0.12);  color: #00897b; }

.ktn-file-action {
    flex: 0 0 auto;
    opacity: 0;
    transition: opacity 0.12s;
}

.ktn-file-row:hover .ktn-file-action,
.ktn-file-row.is-selected .ktn-file-action {
    opacity: 1;
}
</style>
