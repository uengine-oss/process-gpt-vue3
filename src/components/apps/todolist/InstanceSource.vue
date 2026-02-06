<template>
    <div
        @drop="onDrop" 
        @dragover="onDragOver" 
        @dragleave="onDragLeave"
    >
        <div class="d-flex flex-column ga-2">
            <!-- 새 파일 추가 카드 -->
            <v-card 
                class="add-file-card d-flex align-center justify-center text-gray"
                :class="{ 'drag-over': isDragOver }"
                elevation="2"
                hover
                @click="openFileDialog"
            >
                <div class="text-center">
                    <v-icon size="48" color="grey" class="add-file-icon">mdi-plus</v-icon>
                    <p class="text-body-1 text-grey add-file-text">{{ $t('InstanceSource.addFile') }}</p>
                    <p class="text-caption text-grey-darken-1">{{ $t('InstanceSource.dragAndDrop') }}</p>
                </div>
            </v-card>

            <!-- 첨부된 파일 카드 목록 -->
            <v-card
                v-for="(item, index) in sourceList"
                :key="item.id || index"
                class="source-card"
                :class="{ 'error-border': item.isError }"
                elevation="2"
                hover
            >
                <!-- 업로드 중 로딩 표시 -->
                <template v-if="!item.isProcess && !item.isError">
                    <div class="source-loading-overlay">
                        <div class="source-progress-container">
                            <div class="source-file-name-uploading">{{ item.name }}</div>
                            <v-progress-linear
                                :model-value="item.uploadProgress || 0"
                                color="primary"
                                height="8"
                                rounded
                                class="mt-2 progress-wave-animation"
                            ></v-progress-linear>
                            <div class="d-flex justify-space-between align-center mt-1">
                                <span class="text-primary text-caption">{{ $t('InstanceSource.uploading') }}</span>
                                <span class="text-primary text-caption font-weight-bold">{{ item.uploadProgress || 0 }}%</span>
                            </div>
                        </div>
                    </div>
                </template>

                <template v-else>
                    <!-- 상단: 파일명 + 상태 칩 -->
                    <div class="d-flex align-start ga-2">
                        <div class="source-file-name flex-grow-1">{{ item.name }}</div>
                        <v-chip
                            :color="item.isProcess ? 'success' : 'error'"
                            size="x-small"
                            variant="tonal"
                        >
                            {{ item.isProcess ? $t('InstanceSource.complete') : $t('InstanceSource.failed') }}
                        </v-chip>
                    </div>

                    <v-spacer />

                    <!-- 하단: 액션 버튼 -->
                    <div class="d-flex justify-end">
                        <v-btn
                            variant="text"
                            density="compact"
                            icon
                            @click="deleteFile(item)"
                        >
                            <v-icon size="16" color="error">mdi-delete-outline</v-icon>
                        </v-btn>
                        <v-btn style="padding-top:2px;"
                            v-if="item.isProcess && !item.isError"
                            variant="text"
                            density="compact"
                            icon
                            @click="downloadFile(item)"
                        >
                            <v-icon size="16" color="primary">mdi-download</v-icon>
                        </v-btn>
                    </div>
                </template>
            </v-card>
        </div>

        <!-- 파일 선택 다이얼로그 -->
        <input
            ref="fileInput"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
            style="display: none"
            @change="onFileSelect"
        >

    </div>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    props: {
        instance: {
            type: Object,
            default: () => {}
        },
        isStarted: {
            type: Boolean,
            default: false
        },
        processDefinitionId: {
            type: String,
            default: ''
        },
        instId: {
            type: String,
            default: ''
        }
    },
    data: () => ({
        sourceList: [],
        isDragOver: false,
        selectedFile: null,
    }),
    mounted() {
        this.init();
    },
    computed: {
        id() {
            if (this.instance && this.instance.instId) {
                return this.instance.instId;
            } else if (this.instId) {
                return this.instId;
            } else {
                return null;
            }
        },
        isMobile() {
            return window.innerWidth <= 768;
        }
    },
    watch: {
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
                    this.sourceList = [];
                    this.init();
                }
            }
        },
    },
    methods: {
        async init() {
            await this.getSourceList();
        },

        async getSourceList() {
            if (this.id) {
                const instId = this.id;
                const list = await backend.getInstanceSource(instId);
                this.sourceList = list.map(item => ({
                    id: item.id,
                    name: item.file_name,
                    path: item.file_path,
                    type: item.file_name.split('.').pop(),
                    isProcess: item.is_process,
                    isError: false
                }));
            }
        },

        openFileDialog() {
            this.$refs.fileInput.click();
        },

        onFileSelect(event) {
            const files = Array.from(event.target.files);
            this.uploadFiles(files);
            event.target.value = ''; // 입력 초기화
        },

        onDrop(event) {
            event.preventDefault();
            this.isDragOver = false;
            const files = Array.from(event.dataTransfer.files);
            this.uploadFiles(files);
        },

        onDragOver(event) {
            event.preventDefault();
            this.isDragOver = true;
        },

        onDragLeave(event) {
            event.preventDefault();
            this.isDragOver = false;
        },

        uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        },

        async uploadFiles(files) {
            var me = this;
            for (const file of files) {
                if (me.validateFile(file)) {
                    const instId = me.id;
                    const fileId = this.uuid();
                    const sourceItem = {
                        id: fileId,
                        name: file.name,
                        path: '',
                        type: file.name.split('.').pop(),
                        isProcess: false,
                        isError: false,
                        uploadProgress: 0
                    };
                    this.sourceList.push(sourceItem);
                    const defId = me.instance && me.instance.defId ? me.instance.defId : me.processDefinitionId;

                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');

                    const options = {
                        folder_path: `${defId}/${year}/${month}/${day}/${instId}/source/`,
                        proc_inst_id: instId,
                        file_id: fileId
                    };

                    const onProgress = (percent) => {
                        me.sourceList.forEach(item => {
                            if (item.id === fileId) {
                                // 업로드 진행률을 0~95%로 매핑 (서버 처리 대기 구간 확보)
                                item.uploadProgress = Math.round(percent * 0.95);
                            }
                        });
                    };

                    const response = await backend.uploadFile(file.name, file, options, onProgress);
                    if (response.error) {
                        me.$try({
                            action: () => {
                                throw new Error(response.message);
                            },
                            onFail: () => {
                                me.sourceList.forEach(item => {
                                    if (item.id === fileId) {
                                        item.isError = true;
                                    }
                                });
                            },
                            errorMsg: `${file.name} 파일 업로드에 실패했습니다. ${response.message}`
                        })
                    } else {
                        // 서버 응답 완료 시 100%로 설정 후 완료 카드로 전환
                        me.sourceList.forEach(item => {
                            if (item.id === fileId) {
                                item.uploadProgress = 100;
                            }
                        });
                        await new Promise(resolve => setTimeout(resolve, 300));
                        me.$try({
                            action: () => {
                                me.sourceList.forEach(item => {
                                    if (item.id === fileId) {
                                        item.isProcess = true;
                                    }
                                });
                            },
                            successMsg: `${file.name} 파일이 업로드되었습니다.`,
                        })
                    }
                    
                }
            }
        },

        validateFile(file) {
            var me = this;
            const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.csv', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
            const fileExtension = this.getFileExtension(file.name);
            
            if (!allowedTypes.includes(fileExtension)) {
                me.$try({
                    action: () => {
                        throw new Error(`${file.name}은 지원되지 않는 파일 형식입니다.`);
                    },
                    errorMsg: `${file.name}은 지원되지 않는 파일 형식입니다.`
                })
                return false;
            }

            if (file.size > 50 * 1024 * 1024) { // 50MB 제한
                me.$try({
                    action: () => {
                        throw new Error(`${file.name} 파일이 너무 큽니다. (최대 50MB)`);
                    },
                    errorMsg: `${file.name} 파일이 너무 큽니다. (최대 50MB)`
                })
                return false;
            }

            return true;
        },

        getFileExtension(filename) {
            return filename.toLowerCase().substring(filename.lastIndexOf('.'));
        },

        getFileIcon(fileType) {
            const iconMap = {
                '.pdf': 'mdi-file-pdf-box',
                '.doc': 'mdi-file-word-box',
                '.docx': 'mdi-file-word-box',
                '.txt': 'mdi-file-document',
                '.csv': 'mdi-file-delimited',
                '.xls': 'mdi-file-excel-box',
                '.xlsx': 'mdi-file-excel-box',
                '.ppt': 'mdi-file-powerpoint-box',
                '.pptx': 'mdi-file-powerpoint-box',
                '.jpg': 'mdi-file-image',
                '.jpeg': 'mdi-file-image',
                '.png': 'mdi-file-image',
                '.gif': 'mdi-file-image',
                '.webp': 'mdi-file-image',
                '.bmp': 'mdi-file-image',
                '.tiff': 'mdi-file-image'
            };
            return iconMap[fileType] || 'mdi-file-document';
        },

        getFileColor(fileType) {
            const colorMap = {
                '.pdf': 'red',
                '.doc': 'blue',
                '.docx': 'blue',
                '.txt': 'grey',
                '.csv': 'green',
                '.xls': 'green',
                '.xlsx': 'green',
                '.ppt': 'blue',
                '.pptx': 'blue',
                '.jpg': 'purple',
                '.jpeg': 'purple',
                '.png': 'purple',
                '.gif': 'purple',
                '.webp': 'purple',
                '.bmp': 'purple',
                '.tiff': 'purple'
            };
            return colorMap[fileType] || 'grey';
        },

        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        formatDate(date) {
            if (!date) return '-';
            return new Date(date).toLocaleString('ko-KR');
        },

        downloadFile(file) {
            window.open(file.path, '_blank');
        },

        async deleteFile(file) {
            var me = this;
            if (!file.isError) {
                const result = await backend.deleteInstanceSource(file);
                if (result.error) {
                    me.$try({
                        action: () => {
                            throw new Error(result.error.message);
                        },
                        errorMsg: result.error.message
                    })
                    return;
                }
            }
            me.$try({
                action: () => {
                    me.sourceList = me.sourceList.filter(item => item.id !== file.id);
                },
                successMsg: `${file.name} 파일이 삭제되었습니다.`
            })
        },
    },
}
</script>

<style scoped>
.error-border {
    border: 2px solid #f44336 !important;
    border-radius: 8px;
}

.source-card {
    min-height: 90px;
    min-width: 280px;
    padding: 8px;
    display: flex;
    flex-direction: column;
}

.source-card:hover {
    transform: translateY(-2px);
}

.source-loading-overlay {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
}

.source-progress-container {
    width: 100%;
}

.source-file-name-uploading {
    font-size: 12px;
    font-weight: 500;
    word-break: break-all;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

.source-file-name {
    font-size: 12px;
    font-weight: 500;
    word-break: break-all;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

.add-file-card {
    min-width: 280px;
    padding: 12px;
    border: 2px dashed #9e9e9e;
    border-radius: 8px;
    cursor: pointer;
}

.add-file-card:hover {
    border-color: rgb(var(--v-theme-primary)) !important;
    background-color: rgb(var(--v-theme-primary), 0.1) !important;
}

.add-file-card:hover .add-file-icon {
    color: rgb(var(--v-theme-primary)) !important;
}

.add-file-card:hover .add-file-text {
    color: rgb(var(--v-theme-primary)) !important;
}

/* 드래그앤드롭 스타일 */
.add-file-card.drag-over {
    border-color: rgb(var(--v-theme-primary)) !important;
    background-color: rgba(var(--v-theme-primary), 0.15) !important;
}

.add-file-card.drag-over .add-file-icon {
    color: rgb(var(--v-theme-primary)) !important;
}

.add-file-card.drag-over .add-file-text {
    color: rgb(var(--v-theme-primary)) !important;
}
</style>

