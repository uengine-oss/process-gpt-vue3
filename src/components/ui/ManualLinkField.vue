<template>
    <div class="manual-link-field">
        <template v-if="!disabled">
            <div class="manual-link-form mb-2">
                <v-text-field
                    v-model="newName"
                    placeholder="이름 (예: 작업 매뉴얼)"
                    density="compact"
                    variant="outlined"
                    hide-details
                    @keyup.enter="addLink"
                />
                <v-text-field
                    v-model="newUrl"
                    :placeholder="$t('manualLink.urlPlaceholder')"
                    density="compact"
                    variant="outlined"
                    hide-details
                    @keyup.enter="addLink"
                />
                <v-btn icon size="small" variant="text" :disabled="!newUrl.trim()" :title="$t('manualLink.addUrl')" @click="addLink">
                    <v-icon size="18" color="black">mdi-plus</v-icon>
                </v-btn>
            </div>
        </template>

        <div v-if="normalizedLinks.length > 0">
            <div v-for="(link, idx) in normalizedLinks" :key="idx" class="manual-link-row">
                <template v-if="editingIdx === idx">
                    <v-text-field
                        v-model="editName"
                        placeholder="이름"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="manual-link-row__input"
                        @keyup.enter="confirmEdit"
                    />
                    <v-text-field
                        v-model="editUrl"
                        placeholder="URL"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="manual-link-row__input"
                        @keyup.enter="confirmEdit"
                    />
                    <v-icon size="16" color="primary" class="manual-link-row__btn" @click.stop="confirmEdit">mdi-check</v-icon>
                </template>
                <template v-else>
                    <a
                        class="manual-link-row__text manual-link-row__link"
                        :href="normalizedHref(link.url)"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {{ getChipLabel(link) }}
                    </a>
                    <v-icon v-if="!disabled" size="14" class="manual-link-row__btn" @click.stop="startEdit(idx)">
                        mdi-pencil-outline
                    </v-icon>
                    <v-icon v-if="!disabled" size="14" color="error" class="manual-link-row__btn" @click.stop="askRemove(idx)">
                        mdi-trash-can-outline
                    </v-icon>
                </template>
            </div>
        </div>
        <div v-else class="text-caption text-medium-emphasis">
            {{ $t('manualLink.noLinks') }}
        </div>

        <v-dialog v-model="deleteDialog" max-width="420" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pa-4 pb-2">
                    <v-icon size="18" color="error" class="mr-2">mdi-alert-circle-outline</v-icon>
                    링크 삭제
                </v-card-title>
                <v-card-text class="pa-4">
                    <div class="text-body-2">
                        선택한 링크<template v-if="deleteTarget"> "{{ getChipLabel(deleteTarget) }}"</template>를 삭제하시겠습니까?
                    </div>
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn variant="text" class="text-none" @click="cancelRemove">취소</v-btn>
                    <v-btn variant="flat" color="error" class="text-none" @click="confirmRemove">
                        <v-icon start size="14">mdi-delete-outline</v-icon>
                        삭제
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue';

interface ManualLink {
    name: string;
    url: string;
}

function normalizeOne(item: any): ManualLink | null {
    if (item == null) return null;
    if (typeof item === 'string') {
        const url = item.trim();
        return url ? { name: '', url } : null;
    }
    if (typeof item === 'object') {
        const url = String(item.url ?? '').trim();
        if (!url) return null;
        const name = String(item.name ?? item.displayName ?? '').trim();
        return { name, url };
    }
    return null;
}

export default defineComponent({
    name: 'ManualLinkField',
    props: {
        modelValue: {
            type: Array as () => any[],
            default: () => []
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        const newName = ref('');
        const newUrl = ref('');

        const normalizedLinks = computed<ManualLink[]>(() => {
            return (props.modelValue || []).map(normalizeOne).filter(Boolean) as ManualLink[];
        });

        const addLink = () => {
            const url = newUrl.value.trim();
            if (!url) return;
            const name = newName.value.trim();
            const updated = [...normalizedLinks.value, { name, url }];
            emit('update:modelValue', updated);
            newName.value = '';
            newUrl.value = '';
        };

        const removeLink = (idx: number) => {
            const updated = [...normalizedLinks.value];
            updated.splice(idx, 1);
            emit('update:modelValue', updated);
        };

        const editingIdx = ref(-1);
        const editName = ref('');
        const editUrl = ref('');
        const startEdit = (idx: number) => {
            const link = normalizedLinks.value[idx];
            if (!link) return;
            editingIdx.value = idx;
            editName.value = link.name;
            editUrl.value = link.url;
        };
        const confirmEdit = () => {
            const url = editUrl.value.trim();
            if (!url) {
                editingIdx.value = -1;
                return;
            }
            const name = editName.value.trim();
            const updated = normalizedLinks.value.map((link, idx) => (idx === editingIdx.value ? { name, url } : link));
            emit('update:modelValue', updated);
            editingIdx.value = -1;
        };

        const deleteDialog = ref(false);
        const deleteIdx = ref(-1);
        const deleteTarget = computed<ManualLink | null>(() => {
            if (deleteIdx.value < 0) return null;
            return normalizedLinks.value[deleteIdx.value] || null;
        });
        const askRemove = (idx: number) => {
            deleteIdx.value = idx;
            deleteDialog.value = true;
        };
        const cancelRemove = () => {
            deleteDialog.value = false;
            deleteIdx.value = -1;
        };
        const confirmRemove = () => {
            if (deleteIdx.value >= 0) removeLink(deleteIdx.value);
            editingIdx.value = -1;
            cancelRemove();
        };

        const normalizedHref = (url: string) => {
            if (!url) return '';
            return /^https?:\/\//i.test(url) ? url : 'https://' + url;
        };

        const getDisplayUrl = (url: string): string => {
            try {
                const u = new URL(url.startsWith('http') ? url : 'https://' + url);
                const path = u.pathname === '/' ? '' : u.pathname;
                const display = u.hostname + path;
                return display.length > 40 ? display.substring(0, 37) + '...' : display;
            } catch {
                return url.length > 40 ? url.substring(0, 37) + '...' : url;
            }
        };

        const getChipLabel = (link: ManualLink): string => {
            return link.name || getDisplayUrl(link.url);
        };

        return {
            newName,
            newUrl,
            normalizedLinks,
            addLink,
            removeLink,
            normalizedHref,
            getChipLabel,
            deleteDialog,
            deleteTarget,
            askRemove,
            cancelRemove,
            confirmRemove,
            editingIdx,
            editName,
            editUrl,
            startEdit,
            confirmEdit
        };
    }
});
</script>

<style scoped>
.manual-link-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) 40px;
    gap: 8px;
    align-items: center;
}

.manual-link-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    line-height: 1.6;
    color: #212121;
}

.manual-link-row__text {
    flex: 1;
    min-width: 0;
    word-break: break-word;
}

.manual-link-row__link {
    color: inherit;
    text-decoration: none;
    cursor: pointer;
}

.manual-link-row__link:hover {
    color: rgb(var(--v-theme-primary));
    text-decoration: none;
}

.manual-link-row__input {
    flex: 1;
    min-width: 0;
}

.manual-link-row__btn {
    cursor: pointer;
    opacity: 0.7;
}

.manual-link-row__btn:hover {
    opacity: 1;
}

@media (max-width: 600px) {
    .manual-link-form {
        grid-template-columns: minmax(0, 1fr) 40px;
    }

    .manual-link-form .v-text-field:first-child {
        grid-column: 1 / -1;
    }
}
</style>
