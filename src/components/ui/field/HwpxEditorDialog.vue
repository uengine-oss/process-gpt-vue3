<template>
    <v-dialog v-model="open" max-width="1100" scrollable>
        <v-card class="hwpx-editor-dialog">
            <HwpxViewer
                ref="viewer"
                :htmlUrl="currentHtmlUrl"
                :ext="'.hwpx'"
                :readOnly="readOnly"
                @close="open = false"
                @page-edit-request="handlePageEdit"
                @download="handleDownload"
            />
        </v-card>
    </v-dialog>
</template>

<script>
// 기존 HWPX 뷰어/편집 UI(HwpxViewer)를 재사용해 폼(FileField) 안에서 미리보기·편집을 제공하는 얇은 래퍼.
// 편집/저장 배선은 채팅(ChatRoomPage)과 동일하게 office-mcp(edit_hwpx_page_html / save_hwpx_from_html)를
// JSON-RPC로 직접 호출한다. hwpx_url(file_url)로 원본을 받아 편집을 반영하고 결과 URL을 돌려받는다.
import HwpxViewer from '@/components/HwpxViewer.vue';

export default {
    name: 'HwpxEditorDialog',
    components: { HwpxViewer },
    props: {
        modelValue: { type: Boolean, default: false },
        htmlUrl: { type: String, default: '' },
        fileUrl: { type: String, default: '' },
        name: { type: String, default: 'document.hwpx' },
        readOnly: { type: Boolean, default: false }
    },
    emits: ['update:modelValue', 'updated'],
    data() {
        return {
            currentHtmlUrl: this.htmlUrl,
            currentFileUrl: this.fileUrl,
            downloadLoading: false
        };
    },
    computed: {
        open: {
            get() {
                return this.modelValue;
            },
            set(v) {
                this.$emit('update:modelValue', v);
            }
        }
    },
    watch: {
        htmlUrl(v) {
            this.currentHtmlUrl = v;
        },
        fileUrl(v) {
            this.currentFileUrl = v;
        }
    },
    methods: {
        resolveOfficeMcpUrl() {
            const raw = (import.meta.env.PROCESS_GPT_OFFICE_MCP_URL || '').toString().trim();
            if (!raw) return 'http://127.0.0.1:1192/mcp';
            return raw.endsWith('/') ? `${raw}mcp` : raw;
        },
        parseToolOutput(text) {
            if (text && typeof text === 'object') return text;
            if (typeof text !== 'string') return null;
            try {
                return JSON.parse(text);
            } catch (e) {
                return null;
            }
        },
        parseMcpToolResult(result) {
            if (!result) return null;
            const res = result.result || result.data || result;
            if (typeof res === 'string') {
                const parsed = this.parseToolOutput(res);
                return parsed && typeof parsed === 'object' ? parsed : null;
            }
            const content = Array.isArray(res?.content) ? res.content : [];
            for (const item of content) {
                if (!item) continue;
                const text = item.text || item.data || item.json || '';
                if (!text) continue;
                const parsed = this.parseToolOutput(text);
                if (parsed && typeof parsed === 'object') return parsed;
            }
            if (res && typeof res === 'object') return res;
            return null;
        },
        async callOfficeMcp(name, args) {
            const baseUrl = this.resolveOfficeMcpUrl();
            const payload = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: { name, arguments: args }
            };
            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`HWPX MCP error: ${response.status}`);
            const data = await response.json();
            return this.parseMcpToolResult(data);
        },
        viewerCall(method, ...args) {
            const v = this.$refs.viewer;
            if (v && typeof v[method] === 'function') return v[method](...args);
            return undefined;
        },
        async handlePageEdit(payload) {
            const pageNumber = Number(payload?.pageNumber || 0);
            const instruction = (payload?.instruction || '').toString().trim();
            const contextText = (payload?.contextText || '').toString().trim();
            if (!pageNumber || !instruction) return;
            if (!this.currentFileUrl) {
                this.viewerCall('showEditNotice', 'HWPX 파일 정보가 없어 수정할 수 없습니다.', 'error');
                return;
            }
            const finalInstruction = contextText ? `${instruction}\n\n선택 영역: ${contextText}` : instruction;
            try {
                const output = await this.callOfficeMcp('edit_hwpx_page_html', {
                    hwpx_url: this.currentFileUrl,
                    page_number: pageNumber,
                    instruction: finalInstruction
                });
                const edits = Array.isArray(output?.edits) ? output.edits : [];
                const editedHtml = output?.edited_page_html || output?.editedPageHtml || '';
                const applied = edits.length
                    ? this.viewerCall('applyPageEdits', pageNumber, edits)
                    : this.viewerCall('applyPageEdit', pageNumber, editedHtml);
                if (applied) {
                    if (edits.length) {
                        const ids = edits.map((e) => e?.id).filter(Boolean);
                        this.viewerCall('highlightEdits', ids, pageNumber);
                    }
                    this.viewerCall('showEditNotice', `${pageNumber}페이지 수정 완료`, 'success');
                } else {
                    this.viewerCall('showEditNotice', '페이지 수정에 실패했습니다.', 'error');
                }
            } catch (e) {
                this.viewerCall('showEditNotice', '페이지 수정 중 오류가 발생했습니다.', 'error');
            }
        },
        async handleDownload(payload) {
            if (this.downloadLoading) return;
            const html = payload?.html || '';
            if (!html) return;
            if (!this.currentFileUrl) return;
            this.downloadLoading = true;
            try {
                const result = await this.callOfficeMcp('save_hwpx_from_html', {
                    hwpx_url: this.currentFileUrl,
                    edited_html: html
                });
                const fileUrl = result?.file_url || result?.fileUrl || '';
                const fileName = result?.file_name || result?.fileName || this.name || 'output.hwpx';
                const newHtmlUrl = result?.html_url || result?.htmlUrl || '';
                if (fileUrl) {
                    this.currentFileUrl = fileUrl;
                    if (newHtmlUrl) this.currentHtmlUrl = newHtmlUrl;
                    // 편집본으로 폼 값도 갱신되도록 부모에 알림(재저장 시 편집본 반영).
                    this.$emit('updated', { fileUrl, htmlUrl: newHtmlUrl || this.currentHtmlUrl, name: fileName });
                    this.triggerDownload(fileUrl, fileName);
                }
            } catch (e) {
                console.warn('[HwpxEditorDialog] HWPX 저장/다운로드 실패:', e);
            } finally {
                this.downloadLoading = false;
            }
        },
        triggerDownload(url, filename) {
            try {
                const link = document.createElement('a');
                link.href = url;
                link.download = filename || 'output.hwpx';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (e) {
                try {
                    window.open(url, '_blank');
                } catch (e2) {}
            }
        }
    }
};
</script>

<style scoped>
.hwpx-editor-dialog {
    height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
</style>
