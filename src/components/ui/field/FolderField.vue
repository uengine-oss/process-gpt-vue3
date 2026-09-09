<template>
    <div class="form-folder-field">
        <div class="folder-label">{{ localAlias || localName || '폴더' }}</div>

        <v-card v-if="!isReadonly" class="folder-drop" elevation="0" hover @click="openPicker">
            <div class="text-center">
                <v-icon size="36" color="grey">mdi-folder-upload-outline</v-icon>
                <div class="text-body-2 text-grey-darken-1 mt-1">폴더 선택</div>
                <div class="text-caption text-grey">폴더째 올리면 에이전트가 원본 그대로 열어봅니다</div>
            </div>
        </v-card>

        <input ref="picker" type="file" webkitdirectory directory multiple class="d-none" @change="onPick" />

        <v-progress-linear v-if="uploading" :model-value="progress" color="primary" height="8" rounded class="mt-2" />
        <div v-if="uploading" class="text-caption text-primary mt-1">{{ sent }} / {{ total }} 파일 업로드 중…</div>

        <div v-if="summary" class="folder-summary mt-2">
            <v-icon size="16" color="primary">mdi-folder-outline</v-icon>
            <span class="folder-summary-name">{{ summary.root }}</span>
            <span class="text-caption text-grey">파일 {{ summary.files }}개</span>
            <v-btn v-if="!isReadonly" size="x-small" variant="text" color="error" @click="clear">비우기</v-btn>
        </div>

        <div v-if="errorMessage" class="text-caption text-error mt-1">{{ errorMessage }}</div>
    </div>
</template>

<script>
/**
 * 폴더 그대로 codex 워크스페이스에 올리는 폼 필드.
 *
 * 지식베이스(파싱·청킹·임베딩)를 타지 않는다. 채팅의 폴더 업로드와 같은 경로를 쓰되,
 * 대화 대신 이 필드가 만든 키로 올린다 — 폼 값이 그 키를 들고 다니므로 다음 단계의
 * 에이전트가 같은 워크스페이스를 그대로 열 수 있다.
 */
import codexSessionFolderService from '@/services/CodexSessionFolderService';
import { getTenantId } from '@/utils/tenant';

export default {
    name: 'FolderField',
    props: {
        modelValue: { type: [Object, String], default: null },
        name: { type: String, default: '' },
        alias: { type: String, default: '' },
        readonly: { type: [Boolean, String], default: false },
        disabled: { type: [Boolean, String], default: false }
    },
    emits: ['update:modelValue'],
    data() {
        return {
            uploading: false,
            sent: 0,
            total: 0,
            errorMessage: '',
            value: this.normalize(this.modelValue)
        };
    },
    computed: {
        localName() {
            return this.name;
        },
        localAlias() {
            return this.alias;
        },
        isReadonly() {
            return this.readonly === true || this.readonly === 'true' || this.disabled === true || this.disabled === 'true';
        },
        progress() {
            return this.total ? Math.round((this.sent / this.total) * 100) : 0;
        },
        summary() {
            return this.value && this.value.files ? this.value : null;
        }
    },
    watch: {
        modelValue(next) {
            this.value = this.normalize(next);
        }
    },
    methods: {
        normalize(raw) {
            if (!raw) return null;
            if (typeof raw === 'string') {
                try {
                    return JSON.parse(raw);
                } catch (e) {
                    return null;
                }
            }
            return raw;
        },
        openPicker() {
            this.errorMessage = '';
            this.$refs.picker?.click();
        },
        async onPick(event) {
            const files = Array.from(event.target.files || []);
            if (!files.length) return;
            // 폴더 키는 이 필드가 만든다. proc_inst_id 를 기다리지 않아도 되고,
            // 폼 값이 키를 들고 다녀서 다음 단계가 같은 워크스페이스를 연다.
            const conversationId = this.value?.conversationId || crypto.randomUUID();
            const tenantId = getTenantId();
            if (!tenantId) {
                this.errorMessage = '테넌트 정보를 찾을 수 없어 폴더를 올리지 못했습니다.';
                return;
            }

            this.uploading = true;
            this.sent = 0;
            this.total = files.length;
            try {
                const result = await codexSessionFolderService.upload(files, { tenantId, conversationId }, (p) => {
                    this.sent = p.sent;
                });
                const root = (files[0].webkitRelativePath || files[0].name || '').split('/')[0] || 'folder';
                const next = {
                    kind: 'codex-folder',
                    conversationId,
                    root,
                    files: result.sent || files.length,
                    bytes: result.bytes || 0,
                    uploadedAt: new Date().toISOString()
                };
                this.value = next;
                this.$emit('update:modelValue', next);
            } catch (error) {
                this.errorMessage = error?.message || '폴더 업로드에 실패했습니다.';
            } finally {
                this.uploading = false;
                event.target.value = '';
            }
        },
        async clear() {
            const current = this.value;
            this.value = null;
            this.$emit('update:modelValue', null);
            if (current?.conversationId) {
                // 서버 정리는 베스트 에포트 — 실패해도 폼 값은 이미 비워졌다.
                await codexSessionFolderService.clear(getTenantId(), current.conversationId).catch(() => false);
            }
        }
    }
};
</script>

<style scoped>
.form-folder-field {
    margin-bottom: 16px;
}
.folder-label {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 6px;
}
.folder-drop {
    border: 1px dashed rgba(0, 0, 0, 0.22);
    border-radius: 8px;
    padding: 18px;
    cursor: pointer;
}
.folder-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    padding: 8px 12px;
}
.folder-summary-name {
    font-weight: 600;
    font-size: 0.875rem;
}
</style>
