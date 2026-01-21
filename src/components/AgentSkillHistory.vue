<template>
    <div class="agent-skill-history">
        <div class="d-flex justify-start align-center pa-4">
            <h4 class="text-h5">스킬 변경 이력</h4>
            <p class="text-body-1 text-medium-emphasis ml-4">
                에이전트의 스킬 변경 내역을 확인할 수 있습니다.
            </p>
        </div>
        <div>
            <div v-if="filteredHistoryList.length === 0 && !isLoading" class="text-center py-8">
                <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-history</v-icon>
                <h6 class="text-h6 text-grey">수정 이력이 없습니다</h6>
                <p class="text-body-2 text-grey">스킬 수정 이력만 표시됩니다. (추가/삭제 제외)</p>
            </div>

            <div v-else-if="historyList.length === 0 && isLoading">
                <v-skeleton-loader type="card"></v-skeleton-loader>
            </div>
            
            <div v-else class="agent-skill-history-table">
                <v-data-table
                    :headers="headers"
                    :items="filteredHistoryList"
                    :items-per-page="itemsPerPage"
                    :page="page"
                    @update:page="page = $event"
                    @update:items-per-page="itemsPerPage = $event"
                    :hover="true"
                    expand-on-click
                    show-expand
                    :sort-by="[{ key: 'created_at', order: 'desc' }]"
                    class="skill-history-data-table"
                >
                    <!-- 스킬명 컬럼 -->
                    <template v-slot:item.knowledge_name="{ item }">
                        <div class="text-truncate" :title="item.knowledge_name || item.knowledge_id">
                            {{ item.knowledge_name || item.knowledge_id }}
                        </div>
                    </template>

                    <!-- 작업 컬럼 -->
                    <template v-slot:item.operation="{ item }">
                        <v-chip 
                            :color="getOperationColor(item.operation)" 
                            size="small" 
                            variant="flat"
                        >
                            {{ getOperationText(item.operation) }}
                        </v-chip>
                    </template>

                    <!-- 변경 내용 컬럼 (수정만 표시, JSON이면 "N개 파일 변경") -->
                    <template v-slot:item.change_summary="{ item }">
                        <div class="text-body-2">
                            {{ getChangeSummary(item) }}
                        </div>
                    </template>

                    <!-- 변경 일시 컬럼 -->
                    <template v-slot:item.created_at="{ item }">
                        <div class="text-caption d-flex flex-column">
                            <div>{{ formatDateOnly(item.created_at) }}</div>
                            <div class="text-medium-emphasis">{{ formatTimeOnly(item.created_at) }}</div>
                        </div>
                    </template>

                    <!-- Expand 영역 (수정 작업만 오므로 JSON 파일별 diff) -->
                    <template v-slot:expanded-row="{ columns, item }">
                        <td :colspan="columns.length">
                            <v-card elevation="10" class="px-4 py-2 expanded-row-content">
                                <div class="text-body-2 font-weight-medium mb-2">스킬명: {{ item.knowledge_name || item.knowledge_id }}</div>
                                <div class="d-flex align-center justify-space-between mb-2 flex-wrap ga-2">
                                    <span class="text-body-2 font-weight-medium">변경사항</span>
                                    <!-- 되돌리기 / 다시 적용: JSON 파일별 diff일 때만 -->
                                    <div v-if="getFileDiffPairs(item).length > 0" class="d-flex ga-2">
                                        <v-btn
                                            color="orange"
                                            variant="tonal"
                                            size="small"
                                            :loading="revertingItemKey === getItemKey(item)"
                                            :disabled="!!(revertingItemKey || reapplyingItemKey)"
                                            @click="revertToPrevious(item)"
                                        >
                                            <v-icon start size="small">mdi-undo</v-icon>
                                            변경 사항 되돌리기
                                        </v-btn>
                                        <v-btn
                                            color="primary"
                                            variant="tonal"
                                            size="small"
                                            :loading="reapplyingItemKey === getItemKey(item)"
                                            :disabled="!!(revertingItemKey || reapplyingItemKey)"
                                            @click="reapplyNew(item)"
                                        >
                                            <v-icon start size="small">mdi-redo</v-icon>
                                            다시 적용
                                        </v-btn>
                                    </div>
                                </div>
                                
                                <!-- UPDATE: JSON이면 파일별 접기/펼치기 diff, 아니면 기존 전체 diff -->
                                <div v-if="item.previous_content || item.new_content" class="mt-2">
                                    <!-- JSON 형식: 파일별 expansion panel -->
                                    <template v-if="getFileDiffPairs(item).length > 0">
                                        <v-expansion-panels variant="accordion" class="skill-history-file-diff-panels">
                                            <v-expansion-panel
                                                v-for="pair in getFileDiffPairs(item)"
                                                :key="pair.filePath"
                                                class="skill-history-file-panel"
                                            >
                                                <v-expansion-panel-title class="text-body-2 font-weight-medium">
                                                    <v-icon size="small" class="mr-2">mdi-file-document-outline</v-icon>
                                                    {{ pair.filePath }}
                                                </v-expansion-panel-title>
                                                <v-expansion-panel-text>
                                                    <vuediff
                                                        :prev="pair.prev"
                                                        :current="pair.current"
                                                        mode="split"
                                                        theme="light"
                                                        :language="getDiffLanguage(pair.filePath)"
                                                        class="skill-history-diff"
                                                    />
                                                </v-expansion-panel-text>
                                            </v-expansion-panel>
                                        </v-expansion-panels>
                                    </template>
                                    <!-- 일반 텍스트: 기존처럼 전체 diff -->
                                    <template v-else>
                                        <v-row class="ma-0 mb-2">
                                            <v-col cols="6" class="pa-0">
                                                <div class="text-caption text-medium-emphasis">이전 내용</div>
                                            </v-col>
                                            <v-col cols="6" class="pa-0">
                                                <div class="text-caption text-medium-emphasis">새 내용</div>
                                            </v-col>
                                        </v-row>
                                        <vuediff
                                            :prev="item.previous_content || ''"
                                            :current="item.new_content || ''"
                                            mode="split"
                                            theme="light"
                                            language="plaintext"
                                            class="skill-history-diff"
                                        />
                                    </template>
                                </div>
                                <div v-else class="mt-2 text-body-2 text-medium-emphasis">
                                    변경 내용이 없습니다.
                                </div>
                            </v-card>
                        </td>
                    </template>
                </v-data-table>
            </div>
        </div>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: 'AgentSkillHistory',
    props: {
        agentId: {
            type: String,
            default: null
        },
        skillName: {
            type: String,
            default: null
        },
        showHistory: {
            type: Boolean,
            default: true
        }
    },
    data() {
        return {
            historyList: [],
            isLoading: false,
            backend: null,
            page: 1,
            itemsPerPage: 10,
            revertingItemKey: null,
            reapplyingItemKey: null,
            headers: [
                { title: '스킬명', key: 'knowledge_name', sortable: true, width: '25%' },
                { title: '작업', key: 'operation', sortable: true, width: '10%' },
                { title: '변경 내용', key: 'change_summary', sortable: false, width: '50%' },
                { title: '변경 일시', key: 'created_at', sortable: true, width: '15%' }
            ]
        };
    },
    computed: {
        /** CREATE/DELETE 스킵, 수정(UPDATE)만 표시 */
        filteredHistoryList() {
            return (this.historyList || []).filter((it) => it.operation === 'UPDATE');
        }
    },
    watch: {
        agentId: {
            handler(newVal) {
                if (newVal && this.backend) {
                    this.loadHistory();
                }
            }
        },
        skillName: {
            handler() {
                if (this.agentId && this.backend) {
                    this.loadHistory();
                }
            }
        },
    },
    created() {
        this.backend = BackendFactory.createBackend();
    },
    async mounted() {
        if (this.agentId && this.backend) {
            await this.loadHistory();
        }
    },
    methods: {
        async loadHistory() {
            if (!this.agentId || !this.backend) return;
            
            this.isLoading = true;
            this.historyList = [];

            try {
                const history = await this.backend.getSkillHistory(this.agentId, this.skillName);
                this.historyList = history || [];
            } catch (error) {
                console.error('스킬 히스토리 로드 실패:', error);
                this.historyList = [];
            } finally {
                this.isLoading = false;
            }
        },

        getOperationColor(operation) {
            const colors = {
                'CREATE': 'success',
                'UPDATE': 'info',
                'DELETE': 'error'
            };
            return colors[operation] || 'default';
        },

        getOperationText(operation) {
            const texts = {
                'CREATE': '생성',
                'UPDATE': '수정',
                'DELETE': '삭제'
            };
            return texts[operation] || operation;
        },

        formatDate(dateString) {
            if (!dateString) return '-';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (error) {
                return dateString;
            }
        },

        formatDateOnly(dateString) {
            if (!dateString) return '-';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            } catch (error) {
                return dateString;
            }
        },

        formatTimeOnly(dateString) {
            if (!dateString) return '-';
            try {
                const date = new Date(dateString);
                return date.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (error) {
                return '';
            }
        },

        /** 이력 행의 변경 요약 문구 (JSON이면 "N개 파일 변경", 아니면 이전/새 요약) */
        getChangeSummary(item) {
            const pairs = this.getFileDiffPairs(item);
            if (pairs.length > 0) {
                return `${pairs.length}개 파일 변경`;
            }
            if (item.previous_content || item.new_content) {
                const parts = [];
                if (item.previous_content) {
                    const s = item.previous_content.length > 40 ? item.previous_content.substring(0, 40) + '...' : item.previous_content;
                    parts.push(`이전: ${s}`);
                }
                if (item.new_content) {
                    const s = item.new_content.length > 40 ? item.new_content.substring(0, 40) + '...' : item.new_content;
                    parts.push(`새: ${s}`);
                }
                return parts.join(' / ');
            }
            if (item.feedback_content) {
                return `피드백: ${item.feedback_content}`;
            }
            return '-';
        },

        /**
         * previous_content, new_content가 JSON(파일경로->내용)이면
         * [{ filePath, prev, current }] 반환. 그렇지 않으면 [].
         */
        getFileDiffPairs(item) {
            const prev = this._parseJsonFileContents(item?.previous_content);
            const curr = this._parseJsonFileContents(item?.new_content);
            if (!prev || !curr) return [];
            const keys = [...new Set([...Object.keys(prev), ...Object.keys(curr)])];
            return keys.map((filePath) => ({
                filePath,
                prev: String(prev[filePath] ?? ''),
                current: String(curr[filePath] ?? '')
            }));
        },

        /** 문자열이 { "path": "content", ... } 형태의 JSON 객체면 파싱, 아니면 null */
        _parseJsonFileContents(str) {
            if (str == null || typeof str !== 'string' || !str.trim().startsWith('{')) return null;
            try {
                const o = JSON.parse(str);
                if (o != null && typeof o === 'object' && !Array.isArray(o)) return o;
            } catch (_) { /* ignore */ }
            return null;
        },

        /** 파일 경로 확장자에 따른 vue-diff language */
        getDiffLanguage(filePath) {
            if (!filePath || typeof filePath !== 'string') return 'plaintext';
            const ext = filePath.split('.').pop()?.toLowerCase() || '';
            const map = { md: 'markdown', json: 'json', js: 'javascript', ts: 'typescript', tsx: 'typescript', css: 'css', xml: 'xml', py: 'plaintext' };
            return map[ext] ?? 'plaintext';
        },

        getItemKey(item) {
            return item?.id || [item?.knowledge_name || item?.knowledge_id, item?.created_at].filter(Boolean).join('::') || '';
        },

        /** 이전 내용(previous_content)으로 스킬 파일들 저장 */
        async revertToPrevious(item) {
            const skillName = this.skillName || item?.knowledge_name || item?.knowledge_id;
            if (!skillName) {
                this.$try({ context: this, action: () => {}, errorMsg: '되돌리기에 필요한 스킬명이 없습니다.' });
                return;
            }
            const pairs = this.getFileDiffPairs(item);
            if (!pairs.length) {
                this.$try({ context: this, action: () => {}, errorMsg: '파일별 되돌리기를 사용할 수 없는 형식입니다.' });
                return;
            }
            if (!window.confirm('이전 내용으로 모든 파일을 되돌리시겠습니까?')) return;

            const key = this.getItemKey(item);
            this.revertingItemKey = key;
            try {
                for (const p of pairs) {
                    await this.backend.putSkillFile(skillName, p.filePath, p.prev);
                }
                this.$try({ context: this, action: () => {}, successMsg: '이전 내용으로 되돌렸습니다.' });
                this.$emit('reverted');
            } catch (e) {
                this.$try({
                    context: this,
                    action: () => {},
                    errorMsg: (e && (e.message || e.detail)) || '되돌리기에 실패했습니다.'
                });
            } finally {
                this.revertingItemKey = null;
            }
        },

        /** 새 내용(new_content)으로 스킬 파일들 저장 */
        async reapplyNew(item) {
            const skillName = this.skillName || item?.knowledge_name || item?.knowledge_id;
            if (!skillName) {
                this.$try({ context: this, action: () => {}, errorMsg: '다시 적용에 필요한 스킬명이 없습니다.' });
                return;
            }
            const pairs = this.getFileDiffPairs(item);
            if (!pairs.length) {
                this.$try({ context: this, action: () => {}, errorMsg: '파일별 다시 적용을 사용할 수 없는 형식입니다.' });
                return;
            }
            if (!window.confirm('새 내용으로 모든 파일을 다시 적용하시겠습니까?')) return;

            const key = this.getItemKey(item);
            this.reapplyingItemKey = key;
            try {
                for (const p of pairs) {
                    await this.backend.putSkillFile(skillName, p.filePath, p.current);
                }
                this.$try({ context: this, action: () => {}, successMsg: '변경 사항을 다시 적용했습니다.' });
                this.$emit('reapplied');
            } catch (e) {
                this.$try({
                    context: this,
                    action: () => {},
                    errorMsg: (e && (e.message || e.detail)) || '다시 적용에 실패했습니다.'
                });
            } finally {
                this.reapplyingItemKey = null;
            }
        }
    }
};
</script>

<style scoped>
.agent-skill-history {
    height: 100%;
    width: 100%;
}

.agent-skill-history-table {
    width: 100%;
}

.skill-history-data-table {
    width: 100%;
}

.skill-history-data-table :deep(.v-data-table__wrapper) {
    width: 100%;
}

.skill-history-data-table :deep(table) {
    width: 100%;
    table-layout: fixed;
}

.skill-history-data-table :deep(th),
.skill-history-data-table :deep(td) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.skill-history-data-table :deep(.text-truncate) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.skill-history-expanded-row-list .v-list-item {
    padding: 0px 0px 8px 0px;
}

.expanded-row-content {
    background-color: rgb(var(--v-theme-primary), 0.1) !important;
}

.expanded-row-content > div > div.v-list {
    background-color: transparent;
}

.skill-history-diff {
    max-height: 500px;
    overflow-y: auto;
}

.skill-history-file-diff-panels {
    background: transparent;
}

.skill-history-file-diff-panels :deep(.v-expansion-panel) {
    background: rgba(var(--v-theme-surface), 0.6);
}

.skill-history-file-panel :deep(.v-expansion-panel-text__wrapper) {
    padding: 8px 0;
}

.change-content-box {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 4px;
    padding: 12px;
    max-height: 400px;
    overflow-y: auto;
}

.change-content-text {
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    margin: 0;
}
</style>

