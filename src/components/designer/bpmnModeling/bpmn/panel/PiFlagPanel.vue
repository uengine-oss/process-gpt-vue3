<template>
    <div class="pi-flag-panel pb-8">
        <!-- 작성 폼 -->
        <div v-if="!isViewMode" class="pi-flag-form mb-4">
            <div v-if="isGroupMode" class="pi-flag-group-hint mb-2">
                <v-icon size="14" color="primary">mdi-vector-link</v-icon>
                {{
                    $t('piFlagPanel.groupHint', { count: targetElementIds.length }) ||
                    `${targetElementIds.length}개 작업에 묶음으로 등록됩니다.`
                }}
            </div>

            <!-- 상태 선택: 향후 과제 / 즉시 개선 -->
            <v-btn-toggle v-model="form.status" mandatory density="compact" variant="outlined" divided class="pi-flag-status-toggle mb-2">
                <v-btn value="open" size="small" :color="form.status === 'open' ? 'success' : undefined">
                    <v-icon start size="14">mdi-flag</v-icon>
                    {{ $t('piFlagPanel.statusOpen') || '향후 과제' }}
                </v-btn>
                <v-btn value="resolved" size="small" :color="form.status === 'resolved' ? 'error' : undefined">
                    <v-icon start size="14">mdi-flag</v-icon>
                    {{ $t('piFlagPanel.statusResolved') || '즉시 개선' }}
                </v-btn>
            </v-btn-toggle>

            <v-text-field
                v-model="form.type"
                :label="$t('piFlagPanel.type') || '유형 (선택사항)'"
                density="compact"
                variant="outlined"
                hide-details
                class="mb-2"
            ></v-text-field>

            <v-textarea
                v-model="form.description"
                :label="$t('piFlagPanel.description') || '내용'"
                density="compact"
                variant="outlined"
                rows="3"
                auto-grow
                hide-details
                class="mb-2"
            ></v-textarea>

            <div class="d-flex justify-end">
                <v-btn color="primary" size="small" variant="flat" :disabled="!form.description.trim()" @click="submitFlag">
                    <v-icon start size="16">mdi-flag-plus-outline</v-icon>
                    {{ $t('piFlagPanel.add') || 'PI Flag 등록' }}
                </v-btn>
            </div>
        </div>

        <!-- 빈 상태 -->
        <div v-if="comments.length === 0" class="text-center pa-3">
            <v-icon size="28" color="grey-lighten-2">mdi-flag-outline</v-icon>
            <div class="text-caption text-disabled mt-1">{{ $t('piFlagPanel.empty') || '등록된 PI Flag가 없습니다' }}</div>
        </div>

        <!-- 목록 -->
        <template v-else>
            <!-- 전체 접기/펼치기 헤더 -->
            <div class="pi-flag-list-header" @click="listCollapsed = !listCollapsed">
                <v-icon size="16" class="pi-flag-list-header__chevron">{{
                    listCollapsed ? 'mdi-chevron-right' : 'mdi-chevron-down'
                }}</v-icon>
                <span class="pi-flag-list-header__title">{{ $t('piFlagPanel.registered') || '등록된 PI Flag' }}</span>
                <span class="pi-flag-list-header__count">{{ comments.length }}</span>
            </div>

            <div v-show="!listCollapsed" class="pi-flag-comments">
                <template v-for="(comment, idx) in comments" :key="comment.id">
                    <div class="pi-flag-card__item">
                        <!-- 메타: 작성자 · 날짜 + 액션 -->
                        <div class="pi-flag-card__item-meta">
                            <span class="text-caption text-disabled">
                                {{ comment.authorName || $t('piFlagPanel.unknownAuthor') || '익명'
                                }}<span v-if="comment.createdAt"> · {{ formatDate(comment.createdAt) }}</span>
                            </span>
                            <div v-if="!isViewMode" class="d-flex align-center">
                                <v-tooltip :text="$t('piFlagPanel.changeStatus') || '상태 변경'" location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-bind="props" icon variant="text" size="x-small" @click="toggleStatus(comment)">
                                            <v-icon size="13">mdi-swap-horizontal</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-tooltip
                                    v-if="isGrouped(comment)"
                                    :text="$t('piFlagPanel.deleteGroup') || '묶음 전체 삭제'"
                                    location="bottom"
                                >
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            icon
                                            variant="text"
                                            size="x-small"
                                            color="error"
                                            @click="deleteGroup(comment)"
                                        >
                                            <v-icon size="13">mdi-delete-sweep-outline</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-tooltip :text="$t('piFlagPanel.delete') || '삭제'" location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            icon
                                            variant="text"
                                            size="x-small"
                                            color="error"
                                            @click="deleteComment(comment)"
                                        >
                                            <v-icon size="13">mdi-trash-can-outline</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                            </div>
                        </div>

                        <!-- 상태 -->
                        <div class="pi-flag-card__item-row">
                            <span class="pi-flag-card__item-label">{{ $t('piFlagPanel.statusLabel') || '상태' }}</span>
                            <span class="pi-flag-card__item-value">
                                <v-icon size="12" :color="comment.status === 'resolved' ? 'error' : 'success'" class="mr-1"
                                    >mdi-flag</v-icon
                                >
                                <span :class="comment.status === 'resolved' ? 'text-error' : 'text-success'">
                                    {{
                                        comment.status === 'resolved'
                                            ? $t('piFlagPanel.statusResolved') || '즉시 개선'
                                            : $t('piFlagPanel.statusOpen') || '향후 과제'
                                    }}
                                </span>
                            </span>
                        </div>

                        <!-- 유형 -->
                        <div class="pi-flag-card__item-row">
                            <span class="pi-flag-card__item-label">{{ $t('piFlagPanel.typeLabel') || '유형' }}</span>
                            <span class="pi-flag-card__item-value">{{ comment.type || '-' }}</span>
                        </div>

                        <!-- 사유 -->
                        <div class="pi-flag-card__item-row">
                            <span class="pi-flag-card__item-label">{{ $t('piFlagPanel.reasonLabel') || '사유' }}</span>
                            <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">{{ comment.description }}</span>
                        </div>

                        <!-- 묶음 -->
                        <div v-if="groupSiblings(comment).length > 0" class="pi-flag-card__item-row">
                            <span class="pi-flag-card__item-label">{{ $t('piFlagPanel.groupLabel') || '묶음' }}</span>
                            <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">
                                <v-chip
                                    v-for="sib in groupSiblings(comment)"
                                    :key="sib.id"
                                    size="x-small"
                                    variant="tonal"
                                    color="grey"
                                    class="mr-1 mb-1 sk-group-task-chip"
                                    @click.stop="focusSibling(sib.id)"
                                >
                                    <v-icon start size="10">mdi-link-variant</v-icon>
                                    {{ sib.name }}
                                </v-chip>
                            </span>
                        </div>
                    </div>
                    <v-divider v-if="idx < comments.length - 1" class="my-1" />
                </template>
            </div>
        </template>
    </div>
</template>

<script>
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: 'pi-flag-panel',
    props: {
        // 현재 패널이 열려있는 BPMN 요소
        element: { type: Object, required: true },
        // 패널이 관리하는 uengineProperties (comments 동기화용)
        uengineProperties: { type: Object, default: () => ({}) },
        isViewMode: { type: Boolean, default: false },
        // 묶음 등록 대상 요소 id 목록 (깃발 아이콘 다중선택 진입 시 전달). 비어있으면 단일.
        groupTargetIds: { type: Array, default: () => [] }
    },
    emits: ['update:uengineProperties'],
    data() {
        return {
            comments: [],
            currentUser: null,
            listCollapsed: false,
            form: {
                status: 'open',
                type: '',
                description: ''
            }
        };
    },
    computed: {
        modeler() {
            return useBpmnStore().getModeler;
        },
        // 묶음 대상: groupTargetIds 가 2개 이상이면 묶음, 아니면 현재 요소 단일
        targetElementIds() {
            const ids = Array.isArray(this.groupTargetIds) ? this.groupTargetIds.filter(Boolean) : [];
            if (ids.length > 1) return ids;
            return this.element?.id ? [this.element.id] : [];
        },
        isGroupMode() {
            return this.targetElementIds.length > 1;
        }
    },
    watch: {
        'element.id'() {
            this.loadComments();
        }
    },
    async created() {
        try {
            const backend = BackendFactory.createBackend();
            this.currentUser = await backend.getUserInfo();
        } catch (e) {
            this.currentUser = null;
        }
        this.loadComments();
    },
    methods: {
        // ---- 확장 읽기/쓰기 (values[0] 가정 금지: $type 으로 find) ----
        readCommentsOf(elementOrBo) {
            const bo = elementOrBo?.businessObject || elementOrBo;
            const propsEl = bo?.extensionElements?.values?.find((v) => v.$type === 'uengine:Properties');
            if (!propsEl?.json) return [];
            try {
                const parsed = JSON.parse(propsEl.json);
                return Array.isArray(parsed.comments) ? parsed.comments : [];
            } catch (e) {
                return [];
            }
        },
        // 모델러로 즉시 저장 — BpmnPropertyPanel.save 와 동일하게 extensionElements 재구성 (variables 보존)
        writeCommentsToElement(elementId, comments) {
            const modeler = this.modeler;
            if (!modeler) return;
            const elementRegistry = modeler.get('elementRegistry');
            const modeling = modeler.get('modeling');
            const bpmnFactory = modeler.get('bpmnFactory');

            const el = elementRegistry.get(elementId);
            if (!el) return;
            const bo = el.businessObject;

            const ext = bo.extensionElements;
            const others = (ext?.values || []).filter((v) => v.$type !== 'uengine:Properties');
            const existingProps = (ext?.values || []).find((v) => v.$type === 'uengine:Properties');

            let json = {};
            try {
                json = existingProps?.json ? JSON.parse(existingProps.json) : {};
            } catch (e) {
                json = {};
            }
            json.comments = comments;

            const variables = existingProps?.variables || [];
            const uengineProps = bpmnFactory.create('uengine:Properties', {
                json: JSON.stringify(json),
                variables
            });
            const newExt = bpmnFactory.create('bpmn:ExtensionElements', {
                values: [...others, uengineProps]
            });
            modeling.updateProperties(el, { extensionElements: newExt });
        },
        loadComments() {
            this.comments = this.readCommentsOf(this.element);
        },
        // 현재 요소의 comments 를 패널 uengineProperties 에 동기화 (저장 시 덮어쓰기 방지)
        syncToPanel() {
            this.$emit('update:uengineProperties', { ...(this.uengineProperties || {}), comments: this.comments });
        },
        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        },
        submitFlag() {
            const desc = this.form.description.trim();
            if (!desc) return;

            const comment = {
                id: this.generateId(),
                status: this.form.status === 'resolved' ? 'resolved' : 'open',
                type: this.form.type.trim(),
                description: desc,
                authorId: this.currentUser?.id || this.currentUser?.uid || '',
                authorName: this.currentUser?.username || this.currentUser?.email || '',
                createdAt: new Date().toISOString()
            };

            const targets = this.targetElementIds;
            if (targets.length > 1) {
                comment.groupId = comment.id;
                comment.groupedElementIds = [...targets];
            }

            // 대상 요소마다 동일 comment 복제 저장
            targets.forEach((id) => {
                const existing = this.readCommentsOf(this.modeler?.get('elementRegistry').get(id));
                this.writeCommentsToElement(id, [...existing, comment]);
            });

            this.form.status = 'open';
            this.form.type = '';
            this.form.description = '';
            this.loadComments();
            this.syncToPanel();
        },
        // ---- 묶음 판정 ----
        groupMembers(groupKey) {
            const modeler = this.modeler;
            if (!modeler || !groupKey) return [];
            const elementRegistry = modeler.get('elementRegistry');
            const members = [];
            elementRegistry.getAll().forEach((el) => {
                const has = this.readCommentsOf(el).some((c) => (c.groupId || c.id) === groupKey);
                if (has) members.push(el.id);
            });
            return members;
        },
        isGrouped(comment) {
            const key = comment?.groupId || comment?.id;
            return this.groupMembers(key).length >= 2;
        },
        groupSize(comment) {
            const key = comment?.groupId || comment?.id;
            return this.groupMembers(key).length;
        },
        // ---- 상태 토글 ----
        toggleStatus(comment) {
            const next = comment.status === 'resolved' ? 'open' : 'resolved';
            const key = comment.groupId || comment.id;
            if (this.isGrouped(comment)) {
                // 묶음 전체 상태 동기화
                this.groupMembers(key).forEach((id) => {
                    const updated = this.readCommentsOf(this.modeler.get('elementRegistry').get(id)).map((c) =>
                        (c.groupId || c.id) === key ? { ...c, status: next } : c
                    );
                    this.writeCommentsToElement(id, updated);
                });
            } else {
                const updated = this.comments.map((c) => (c.id === comment.id ? { ...c, status: next } : c));
                this.writeCommentsToElement(this.element.id, updated);
            }
            this.loadComments();
            this.syncToPanel();
        },
        // ---- 삭제 ----
        deleteComment(comment) {
            // 현재 요소에서만 제거 (묶음이면 이 요소만 빠짐)
            const updated = this.comments.filter((c) => c.id !== comment.id);
            this.writeCommentsToElement(this.element.id, updated);
            this.loadComments();
            this.syncToPanel();
        },
        deleteGroup(comment) {
            const key = comment.groupId || comment.id;
            this.groupMembers(key).forEach((id) => {
                const updated = this.readCommentsOf(this.modeler.get('elementRegistry').get(id)).filter((c) => (c.groupId || c.id) !== key);
                this.writeCommentsToElement(id, updated);
            });
            this.loadComments();
            this.syncToPanel();
        },
        // ---- 묶음 연관 task (현재 요소 제외) ----
        groupSiblings(comment) {
            const key = comment?.groupId || comment?.id;
            if (!key) return [];
            const modeler = this.modeler;
            if (!modeler) return [];
            const reg = modeler.get('elementRegistry');
            return this.groupMembers(key)
                .filter((id) => id !== this.element?.id)
                .map((id) => {
                    const el = reg.get(id);
                    return { id, name: el?.businessObject?.name || id };
                });
        },
        focusSibling(id) {
            const modeler = this.modeler;
            if (!modeler) return;
            try {
                const el = modeler.get('elementRegistry').get(id);
                if (el) modeler.get('selection').select(el);
            } catch (e) {}
        },
        formatDate(iso) {
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
.pi-flag-group-hint {
    font-size: 12px;
    color: #1976d2;
    display: flex;
    align-items: center;
    gap: 4px;
}

/* PI Flag 목록 (pi-system 디자인 인용) */
.pi-flag-list-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 4px;
    cursor: pointer;
    user-select: none;
}

.pi-flag-list-header__title {
    font-size: 12px;
    font-weight: 600;
    color: #212121;
}

.pi-flag-list-header__count {
    margin-left: auto;
    font-size: 11px;
    font-weight: 700;
    color: #616161;
    background: #eceff1;
    border-radius: 9px;
    min-width: 18px;
    text-align: center;
    padding: 1px 6px;
}

.pi-flag-comments {
    display: flex;
    flex-direction: column;
}

.pi-flag-card__item {
    min-height: 26px;
    padding: 6px 4px;
    display: block;
}

.pi-flag-card__item-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
}

.pi-flag-card__item-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: #212121;
}

.pi-flag-card__item-row + .pi-flag-card__item-row {
    margin-top: 2px;
}

.pi-flag-card__item-label {
    flex: 0 0 36px;
    color: #757575;
    font-weight: 600;
}

.pi-flag-card__item-value {
    flex: 1;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
}

.pi-flag-card__item-value--multiline {
    display: block;
    white-space: pre-wrap;
    word-break: break-word;
}

.sk-group-task-chip {
    cursor: pointer;
}
</style>
