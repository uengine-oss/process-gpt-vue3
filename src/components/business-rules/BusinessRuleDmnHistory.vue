<template>
    <div class="business-rule-dmn-history">
        <div class="d-flex justify-start align-center pa-4">
            <h4 class="text-h5">{{ $t('businessRuleDmnHistory.title') }}</h4>
            <p class="text-body-1 text-medium-emphasis ml-4">
                {{ $t('businessRuleDmnHistory.description') }}
            </p>
        </div>
        <div>
            <div v-if="historyList.length === 0 && !isLoading" class="text-center py-8">
                <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-history</v-icon>
                <h6 class="text-h6 text-grey">{{ $t('businessRuleDmnHistory.noHistory') }}</h6>
                <p class="text-body-2 text-grey">{{ $t('businessRuleDmnHistory.noHistoryDescription') }}</p>
            </div>

            <div v-else-if="historyList.length === 0 && isLoading">
                <v-skeleton-loader type="card"></v-skeleton-loader>
            </div>
            
            <div v-else class="business-rule-dmn-history-table">
                <v-data-table
                    :headers="headers"
                    :items="historyList"
                    :items-per-page="itemsPerPage"
                    :page="page"
                    @update:page="page = $event"
                    @update:items-per-page="itemsPerPage = $event"
                    :hover="true"
                    expand-on-click
                    show-expand
                    :sort-by="[{ key: 'created_at', order: 'desc' }]"
                    class="dmn-history-data-table"
                >
                    <!-- 규칙명 컬럼 -->
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

                    <!-- 변경 내용 컬럼 -->
                    <template v-slot:item.change_summary="{ item }">
                        <div class="text-body-2">
                            <div v-if="item.previous_content || item.new_content || item.feedback_content" class="d-flex flex-column ga-1">
                                <div v-if="item.previous_content" class="text-truncate" :title="item.previous_content">
                                    <span class="text-caption text-medium-emphasis">{{ $t('businessRuleDmnHistory.previous') }} </span>
                                    {{ item.previous_content.length > 50 ? item.previous_content.substring(0, 50) + '...' : item.previous_content }}
                                </div>
                                <div v-if="item.new_content" class="text-truncate" :title="item.new_content">
                                    <span class="text-caption text-medium-emphasis">{{ $t('businessRuleDmnHistory.new') }} </span>
                                    {{ item.new_content.length > 50 ? item.new_content.substring(0, 50) + '...' : item.new_content }}
                                </div>
                                <div v-if="item.feedback_content" class="text-truncate" :title="item.feedback_content">
                                    <span class="text-caption text-medium-emphasis">{{ $t('businessRuleDmnHistory.feedback') }} </span>
                                    {{ item.feedback_content }}
                                </div>
                            </div>
                            <span v-else class="text-medium-emphasis">-</span>
                        </div>
                    </template>

                    <!-- 변경자 컬럼 -->
                    <template v-slot:item.created_by="{ item }">
                        <div class="text-body-2">
                            {{ item.created_by || '-' }}
                        </div>
                    </template>

                    <!-- 변경 일시 컬럼 -->
                    <template v-slot:item.created_at="{ item }">
                        <div class="text-caption d-flex flex-column">
                            <div>{{ formatDateOnly(item.created_at) }}</div>
                            <div class="text-medium-emphasis">{{ formatTimeOnly(item.created_at) }}</div>
                        </div>
                    </template>

                    <!-- Expand 영역 -->
                    <template v-slot:expanded-row="{ columns, item }">
                        <td :colspan="columns.length">
                            <v-card elevation="10" class="px-4 py-2 expanded-row-content">
                                <!-- UPDATE 작업: 이전 내용과 새 내용 diff 표시 -->
                                <div v-if="item.operation === 'UPDATE' && item.previous_content && item.new_content">
                                    <!-- 사용자 친화적인 DMN 변경사항 표시 -->
                                    <div v-if="parseDmnXml(item.previous_content) && parseDmnXml(item.new_content)">
                                        <dmn-diff-view 
                                            :previous="parseDmnXml(item.previous_content)" 
                                            :current="parseDmnXml(item.new_content)"
                                        />
                                    </div>
                                    <!-- XML 파싱 실패 시 원본 XML 표시 -->
                                    <div v-else>
                                        <v-tabs :model-value="getXmlViewTab(item)" @update:model-value="setXmlViewTab(item, $event)" class="mb-2">
                                            <v-tab value="structured">{{ $t('businessRuleDmnHistory.structuredChanges') }}</v-tab>
                                            <v-tab value="raw">{{ $t('businessRuleDmnHistory.rawXml') }}</v-tab>
                                        </v-tabs>
                                        <v-window :model-value="getXmlViewTab(item)">
                                            <v-window-item value="structured">
                                                <div class="text-body-2 text-medium-emphasis pa-2">
                                                    {{ $t('businessRuleDmnHistory.xmlParseFailed') }}
                                                </div>
                                            </v-window-item>
                                            <v-window-item value="raw">
                                                <v-row class="ma-0">
                                                    <v-col cols="6" class="pa-2">
                                                        <div class="text-caption text-medium-emphasis mb-1">{{ $t('businessRuleDmnHistory.previousContent') }}</div>
                                                        <div class="change-content-box">
                                                            <pre class="change-content-text">{{ item.previous_content }}</pre>
                                                        </div>
                                                    </v-col>
                                                    <v-col cols="6" class="pa-2">
                                                        <div class="text-caption text-medium-emphasis mb-1">{{ $t('businessRuleDmnHistory.newContent') }}</div>
                                                        <div class="change-content-box">
                                                            <pre class="change-content-text">{{ item.new_content }}</pre>
                                                        </div>
                                                    </v-col>
                                                </v-row>
                                            </v-window-item>
                                        </v-window>
                                    </div>
                                </div>
                                
                                <!-- CREATE 작업: 새 내용만 표시 -->
                                <div v-else-if="item.operation === 'CREATE' && item.new_content">
                                    <!-- 사용자 친화적인 DMN 표시 -->
                                    <div v-if="parseDmnXml(item.new_content)">
                                        <dmn-structure-view :dmn="parseDmnXml(item.new_content)" />
                                    </div>
                                    <!-- XML 파싱 실패 시 원본 XML 표시 -->
                                    <div v-else>
                                        <div class="text-caption text-medium-emphasis mb-1">{{ $t('businessRuleDmnHistory.newContent') }}</div>
                                        <div class="change-content-box">
                                            <pre class="change-content-text">{{ item.new_content }}</pre>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- DELETE 작업: 이전 내용만 표시 -->
                                <div v-else-if="item.operation === 'DELETE' && item.previous_content">
                                    <!-- 사용자 친화적인 DMN 표시 -->
                                    <div v-if="parseDmnXml(item.previous_content)">
                                        <dmn-structure-view :dmn="parseDmnXml(item.previous_content)" />
                                    </div>
                                    <!-- XML 파싱 실패 시 원본 XML 표시 -->
                                    <div v-else>
                                        <div class="text-caption text-medium-emphasis mb-1">{{ $t('businessRuleDmnHistory.previousContent') }}</div>
                                        <div class="change-content-box">
                                            <pre class="change-content-text">{{ item.previous_content }}</pre>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- 내용이 없는 경우 -->
                                <div v-else class="mt-2 text-body-2 text-medium-emphasis">
                                    {{ $t('businessRuleDmnHistory.noChangeContent') }}
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
import { parseDmnXml } from '@/utils/dmnParser';
import DmnDiffView from '@/components/dmn/DmnDiffView.vue';
import DmnStructureView from '@/components/dmn/DmnStructureView.vue';

export default {
    name: 'BusinessRuleDmnHistory',
    components: {
        DmnDiffView,
        DmnStructureView
    },
    props: {
        ruleId: {
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
            xmlViewTabs: {} // 각 아이템별 탭 상태 관리
        };
    },
    computed: {
        headers() {
            return [
                { title: this.$t('businessRuleDmnHistory.businessRule'), key: 'knowledge_name', sortable: true, width: '20%' },
                { title: this.$t('businessRuleDmnHistory.operation'), key: 'operation', sortable: true, width: '10%' },
                { title: this.$t('businessRuleDmnHistory.changeContent'), key: 'change_summary', sortable: false, width: '40%' },
                { title: this.$t('businessRuleDmnHistory.changer'), key: 'created_by', sortable: true, width: '15%' },
                { title: this.$t('businessRuleDmnHistory.changeDate'), key: 'created_at', sortable: true, width: '15%' }
            ];
        }
    },
    watch: {
        ruleId: {
            handler() {
                if (this.backend) {
                    this.loadHistory();
                }
            }
        },
    },
    created() {
        this.backend = BackendFactory.createBackend();
    },
    async mounted() {
        if (this.ruleId && this.backend) {
            await this.loadHistory();
        }
    },
    methods: {
        async loadHistory() {
            if (!this.ruleId || !this.backend) return;
            
            this.isLoading = true;
            this.historyList = [];

            try {
                // UEngine 모드: ruleId만으로 조회
                const history = await this.backend.getDmnHistory(this.ruleId, this.ruleId);
                this.historyList = history || [];
            } catch (error) {
                console.error('비즈니스 규칙 히스토리 로드 실패:', error);
                this.historyList = [];
            } finally {
                this.isLoading = false;
            }
        },

        getOperationColor(operation) {
            const colors = {
                'CREATE': 'success',
                'UPDATE': 'info',
                'DELETE': 'error',
                'MOVE': 'warning'
            };
            return colors[operation] || 'default';
        },

        getOperationText(operation) {
            const texts = {
                'CREATE': this.$t('businessRuleDmnHistory.operationCreate'),
                'UPDATE': this.$t('businessRuleDmnHistory.operationUpdate'),
                'DELETE': this.$t('businessRuleDmnHistory.operationDelete'),
                'MOVE': this.$t('businessRuleDmnHistory.operationMove')
            };
            return texts[operation] || operation;
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

        getXmlViewTab(item) {
            const key = this.getItemKey(item);
            return this.xmlViewTabs[key] || 'structured';
        },

        setXmlViewTab(item, value) {
            const key = this.getItemKey(item);
            this.xmlViewTabs[key] = value;
        },

        getItemKey(item) {
            // 고유 키 생성: id, knowledge_id, created_at 조합
            return item.id || item.knowledge_id || item.created_at || JSON.stringify(item);
        },

        parseDmnXml(xmlString) {
            return parseDmnXml(xmlString);
        }

    }
};
</script>

<style scoped>
.business-rule-dmn-history {
    height: 100%;
    width: 100%;
}

.business-rule-dmn-history-table {
    width: 100%;
}

.dmn-history-data-table {
    width: 100%;
}

.dmn-history-data-table :deep(.v-data-table__wrapper) {
    width: 100%;
}

.dmn-history-data-table :deep(table) {
    width: 100%;
    table-layout: fixed;
}

.dmn-history-data-table :deep(th),
.dmn-history-data-table :deep(td) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.dmn-history-data-table :deep(.text-truncate) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

.dmn-history-diff {
    max-height: 500px;
    overflow-y: auto;
}

.dmn-diff-view,
.dmn-structure-view {
    width: 100%;
}

.dmn-info-box {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 4px;
    padding: 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
}

.dmn-list-box {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 4px;
    padding: 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    max-height: 300px;
    overflow-y: auto;
}

.dmn-item {
    padding: 8px;
    background-color: rgba(var(--v-theme-background), 1);
    border-radius: 4px;
    border-left: 3px solid rgba(var(--v-theme-primary), 0.3);
}

.dmn-rules-box {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 4px;
    padding: 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    max-height: 400px;
    overflow-y: auto;
}

.dmn-rule-item {
    padding: 12px;
    background-color: rgba(var(--v-theme-background), 1);
    border-radius: 4px;
    border-left: 3px solid rgba(var(--v-theme-primary), 0.3);
}

.dmn-added {
    background-color: rgba(76, 175, 80, 0.1) !important;
    border-left-color: rgba(76, 175, 80, 0.5) !important;
}

.dmn-modified {
    background-color: rgba(255, 152, 0, 0.1) !important;
    border-left-color: rgba(255, 152, 0, 0.5) !important;
}

.dmn-removed {
    background-color: rgba(244, 67, 54, 0.1) !important;
    border-left-color: rgba(244, 67, 54, 0.5) !important;
    text-decoration: line-through;
    opacity: 0.7;
}
</style>
