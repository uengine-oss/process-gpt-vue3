<template>
    <div class="pt">
        <div class="pt__header">
            <div class="pt__title">
                <v-icon size="20" class="mr-2">mdi-file-search-outline</v-icon>
                파싱 테스트 <span class="pt__sub">문서를 올리면 저장 없이 파서가 뽑는 텍스트(마크다운)를 보여줍니다</span>
            </div>
            <div class="pt__header-tools">
                <v-checkbox
                    v-model="includeChunks"
                    label="청크 경계도 보기"
                    density="compact"
                    hide-details
                    color="primary"
                    class="pt__chk"
                />
                <v-btn v-if="result" variant="text" size="small" @click="reset">
                    <v-icon size="16" start>mdi-close</v-icon>초기화
                </v-btn>
            </div>
        </div>

        <div class="pt__body">
            <!-- 드롭존 -->
            <div
                v-if="!result && !loading"
                class="pt__drop"
                :class="{ 'pt__drop--over': dragOver }"
                @dragover.prevent="dragOver = true"
                @dragleave.prevent="dragOver = false"
                @drop.prevent="onDrop"
                @click="$refs.fileInput.click()"
            >
                <v-icon size="48" color="primary">mdi-cloud-upload-outline</v-icon>
                <div class="pt__drop-title">문서를 여기로 끌어다 놓거나 클릭해서 선택</div>
                <div class="pt__drop-hint">pdf · docx · pptx · hwp · hwpx · xlsx · txt</div>
                <input ref="fileInput" type="file" hidden @change="onPick" />
            </div>

            <div v-if="loading" class="pt__loading">
                <v-progress-circular indeterminate size="32" width="3" color="primary" />
                <div class="mt-3">{{ loadingName }} 파싱 중…</div>
            </div>

            <div v-if="errorMsg && !loading" class="pt__error">
                <v-icon color="error" class="mr-2">mdi-alert-circle-outline</v-icon>{{ errorMsg }}
                <div class="mt-3"><v-btn size="small" variant="tonal" @click="reset">다시 시도</v-btn></div>
            </div>

            <ParsedPagesView
                v-if="result && !loading"
                :pages="result.pages || []"
                :chunks="result.chunks || null"
                :file-name="result.file_name"
                class="pt__viewer"
            />
        </div>
    </div>
</template>

<script>
import axios from 'axios';
import ParsedPagesView from '@/components/knowledge/ParsedPagesView.vue';

export default {
    name: 'ParseTestPage',
    components: { ParsedPagesView },
    data() {
        return {
            includeChunks: false,
            dragOver: false,
            loading: false,
            loadingName: '',
            errorMsg: '',
            result: null
        };
    },
    methods: {
        onDrop(e) {
            this.dragOver = false;
            const f = e.dataTransfer?.files?.[0];
            if (f) this.upload(f);
        },
        onPick(e) {
            const f = e.target.files?.[0];
            if (f) this.upload(f);
            e.target.value = '';
        },
        reset() {
            this.result = null;
            this.errorMsg = '';
            this.loadingName = '';
        },
        async upload(file) {
            this.result = null;
            this.errorMsg = '';
            this.loading = true;
            this.loadingName = file.name;
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('tenant_id', window.$tenantName || '');
                fd.append('include_chunks', this.includeChunks ? 'true' : 'false');
                const { data } = await axios.post('/memento/parse/preview', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                this.result = data;
            } catch (e) {
                this.errorMsg = e?.response?.data?.detail || e?.message || '파싱 실패';
            } finally {
                this.loading = false;
            }
        }
    }
};
</script>

<style scoped>
.pt {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: rgb(var(--v-theme-surface));
}

.pt__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    flex-shrink: 0;
    gap: 16px;
    flex-wrap: wrap;
}

.pt__title {
    display: flex;
    align-items: center;
    font-size: 16px;
    font-weight: 600;
}

.pt__sub {
    font-size: 12px;
    font-weight: 400;
    color: rgba(var(--v-theme-on-surface), 0.5);
    margin-left: 12px;
}

.pt__header-tools {
    display: flex;
    align-items: center;
    gap: 8px;
}

.pt__chk :deep(.v-label) {
    font-size: 13px;
}

.pt__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 20px;
    overflow: hidden;
}

.pt__drop {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border: 2px dashed rgba(var(--v-theme-primary), 0.4);
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}

.pt__drop--over {
    background: rgba(var(--v-theme-primary), 0.06);
    border-color: rgb(var(--v-theme-primary));
}

.pt__drop-title {
    font-size: 15px;
    font-weight: 500;
}

.pt__drop-hint {
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.5);
}

.pt__loading,
.pt__error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: rgba(var(--v-theme-on-surface), 0.7);
}

.pt__viewer {
    flex: 1;
    min-height: 0;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    border-radius: 10px;
    overflow: hidden;
}
</style>
