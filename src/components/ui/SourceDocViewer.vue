<template>
    <!--
      출처 원문 뷰어 — 칩 클릭 시 바로 열린다.
      지식베이스 "파싱 결과 미리보기"와 동일하게 /memento/parse/stored(=document_pages, RAG가 읽는 페이지 본문)를
      가져와 ParsedPagesView 로 페이지별 렌더한다. (페이지별 렌더라 표가 페이지 경계를 안 넘어 깨지지 않는다.)
      인용된 페이지(source.page)로 자동 이동한다.
    -->
    <v-dialog v-model="isOpen" max-width="1000" height="86vh" scrollable>
        <v-card v-if="source" class="source-doc-viewer d-flex flex-column" style="height: 86vh">
            <v-card-title class="d-flex align-center py-2" style="gap: 6px">
                <v-icon size="18" class="mr-1">mdi-file-search-outline</v-icon>
                <span class="text-subtitle-1 text-truncate">{{ source.file_name || '원문 보기' }}</span>
                <v-chip v-if="pageLabel" size="x-small" variant="tonal" color="primary" class="ml-1">p.{{ pageLabel }}</v-chip>
                <v-spacer />
                <v-btn
                    v-if="source.source_ref || source.file_id"
                    variant="text"
                    size="small"
                    prepend-icon="mdi-download"
                    @click="$emit('download', source)"
                    >원본 다운로드</v-btn
                >
                <v-btn icon variant="text" size="small" @click="isOpen = false">
                    <v-icon size="18">mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <v-divider />
            <ParsedPagesView
                :pages="pages"
                :file-name="source.file_name || ''"
                :loading="loading"
                :error="error"
                :focus-page="focusPage"
                style="flex: 1 1 auto; min-height: 0"
            />
        </v-card>
    </v-dialog>
</template>

<script>
import axios from 'axios';
import ParsedPagesView from '@/components/knowledge/ParsedPagesView.vue';

export default {
    name: 'SourceDocViewer',
    components: { ParsedPagesView },
    props: {
        modelValue: { type: Boolean, default: false },
        source: { type: Object, default: null }
    },
    emits: ['update:modelValue', 'download'],
    data() {
        return {
            loading: false,
            error: '',
            pages: []
        };
    },
    computed: {
        isOpen: {
            get() {
                return this.modelValue;
            },
            set(v) {
                this.$emit('update:modelValue', v);
            }
        },
        pageLabel() {
            const s = this.source;
            if (!s) return '';
            return s.page_label || (s.page != null ? String(s.page) : '');
        },
        // 인용된 페이지 번호(있으면) — ParsedPagesView 가 그 페이지로 자동 이동한다.
        focusPage() {
            const s = this.source;
            return s && s.page != null ? s.page : null;
        }
    },
    watch: {
        modelValue(open) {
            if (open && this.source) {
                this.load();
            }
        }
    },
    methods: {
        async load() {
            const ref = (this.source && (this.source.source_ref || this.source.file_id)) || '';
            const tenantId = (typeof window !== 'undefined' && window.$tenantName) || '';
            this.pages = [];
            this.error = '';
            if (!ref || !tenantId) {
                this.error = '원문을 불러올 파일 정보가 없습니다.';
                return;
            }
            this.loading = true;
            try {
                const { data } = await axios.get('/memento/parse/stored', {
                    params: { tenant_id: tenantId, source_ref: ref }
                });
                this.pages = (data && data.pages) || [];
                if (!this.pages.length) {
                    this.error = '저장된 페이지 본문이 없습니다. (인덱싱 방식에 따라 페이지 본문이 없을 수 있어요)';
                }
            } catch (e) {
                console.error('[SourceDocViewer] parse/stored load failed', e);
                this.error = (e && e.response && e.response.data && e.response.data.detail) || '원문을 불러오지 못했습니다.';
            } finally {
                this.loading = false;
            }
        }
    }
};
</script>
