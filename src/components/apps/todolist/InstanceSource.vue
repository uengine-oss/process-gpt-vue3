<template>
    <div class="w-100 h-100"
        @drop="onDrop" 
        @dragover="onDragOver" 
        @dragleave="onDragLeave"
    >
       <v-row class="ma-0 pa-0">
            <!-- 새 파일 추가 카드 -->
            <v-col cols="12" 
                :lg="isMobile || isStarted ? 12 : 4" 
                :md="isMobile || isStarted ? 12 : 6" 
                :sm="isMobile || isStarted ? 12 : 6" 
                class="pa-2"
            >
                <v-card 
                    class="add-file-card d-flex align-center justify-center text-gray"
                    :class="{ 'drag-over': isDragOver }"
                    elevation="2"
                    hover
                    @click="openFileDialog"
                >
                    <div class="text-center">
                        <v-icon size="48" color="grey" class="add-file-icon">mdi-plus</v-icon>
                        <p class="text-body-1 text-grey add-file-text">파일 추가</p>
                        <p class="text-caption text-grey-darken-1">클릭하거나 파일을 드래그하세요</p>
                    </div>
                </v-card>
            </v-col>
            <v-col
                v-for="(item, index) in sourceList"
                :key="item.id || index"
                cols="12"
                :lg="isMobile || isStarted ? 12 : 4"
                :md="isMobile || isStarted ? 12 : 6"
                :sm="isMobile || isStarted ? 12 : 6"
                class="pa-2"
            >
                <v-card
                    class="source-card"
                    :class="{ 'uploading-border': !item.isProcess }"
                    elevation="2"
                    hover
                >
                    <v-card-title class="d-flex align-center justify-space-between pa-4 pb-2">
                        <div class="d-flex align-center">
                            <v-icon
                                :icon="getFileIcon(item.type)"
                                :color="getFileColor(item.type)"
                                class="mr-3"
                            ></v-icon>
                            <span class="text-truncate">{{ item.name }}</span>
                        </div>
                        <v-menu>
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    icon="mdi-dots-vertical"
                                    variant="text"
                                    size="small"
                                    v-bind="props"
                                    :disabled="!item.isProcess"
                                ></v-btn>
                            </template>
                            <v-list>
                                <v-list-item
                                    prepend-icon="mdi-download"
                                    title="다운로드"
                                    @click="downloadFile(item)"
                                ></v-list-item>
                                <v-list-item
                                    prepend-icon="mdi-delete"
                                    title="삭제"
                                    @click="deleteFile(item)"
                                    color="error"
                                ></v-list-item>
                            </v-list>
                        </v-menu>
                    </v-card-title>
                    
                    <v-card-text class="pa-4 pt-0">
                        <div class="file-info">
                            <div class="d-flex justify-end">
                                <v-chip
                                    :color="item.isProcess ? 'success' : 'warning'"
                                    size="small"
                                    variant="tonal"
                                >
                                    {{ item.isProcess ? '업로드 완료' : '업로드 중' }}
                                </v-chip>
                            </div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <!-- 파일 선택 다이얼로그 -->
        <input
            ref="fileInput"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
            style="display: none"
            @change="onFileSelect"
        >

        <!-- 스낵바 -->
        <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
            {{ snackbar.message }}
            <template v-slot:actions>
                <v-btn variant="text" @click="snackbar.show = false">닫기</v-btn>
            </template>
        </v-snackbar>
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
        }
    },
    data: () => ({
        sourceList: [],
        isDragOver: false,
        selectedFile: null,
        snackbar: {
            show: false,
            message: '',
            color: 'success'
        }
    }),
    mounted() {
        this.init();
    },
    computed: {
        id() {
            if (this.$route.params.instId) {
                return this.$route.params.instId.replace(/_DOT_/g, '.');
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
            if (this.isStarted) {
                this.sourceList = [];
            } else {
                await this.getSourceList();
            }
        },

        async getSourceList() {
            if (this.instance && this.instance.instId) {
                const list = await backend.getInstanceSource(this.instance.instId);
                this.sourceList = list.map(item => ({
                    id: item.id,
                    name: item.file_name,
                    path: item.file_path,
                    type: item.file_name.split('.').pop(),
                    isProcess: item.is_process
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
                    const fileId = this.uuid();
                    if (me.isStarted) {
                        if (me.processDefinitionId) {
                            const result = await backend.putInstanceSource({
                                id: fileId,
                                file_name: file.name
                            });
                            this.sourceList.push({
                                id: fileId,
                                name: file.name,
                                path: '',
                                type: me.getFileExtension(file.name),
                                isProcess: false
                            });

                            if (result.error) {
                                me.showSnackbar(result.error.message, 'error');
                                return;
                            }

                            const today = new Date();
                            const year = today.getFullYear();
                            const month = String(today.getMonth() + 1).padStart(2, '0');
                            const day = String(today.getDate()).padStart(2, '0');

                            const options = {
                                folder_path: `${me.processDefinitionId}/${year}/${month}/${day}/_new/source/`,
                                file_id: fileId
                            };

                            backend.uploadFile(file.name, file, 'drive', options).then(async (response) => {
                                const item = this.sourceList.find(item => item.id === fileId);
                                item.path = response.download_url;
                                item.isProcess = true;
                                const result = await backend.putInstanceSource({
                                    id: fileId,
                                    is_process: true,
                                    file_path: response.download_url
                                });
                            });
                        }
                    } else {
                        const result = await backend.putInstanceSource({
                            id: fileId,
                            proc_inst_id: me.instance.instId,
                            file_name: file.name
                        });
                        await this.getSourceList();

                        if (result.error) {
                            me.showSnackbar(result.error.message, 'error');
                            return;
                        }

                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');

                        const options = {
                            folder_path: `${me.instance.defId}/${year}/${month}/${day}/${me.instance.instId}/source/`,
                            proc_inst_id: me.instance.instId,
                            file_id: fileId
                        };

                        backend.uploadFile(file.name, file, 'drive', options).then(async (response) => {
                            await this.getSourceList();
                            me.showSnackbar(`${file.name} 파일이 업로드되었습니다.`, 'success');
                        });
                    }
                }
            }
        },

        validateFile(file) {
            const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.csv', '.xls', '.xlsx'];
            const fileExtension = this.getFileExtension(file.name);
            
            if (!allowedTypes.includes(fileExtension)) {
                this.showSnackbar(`${file.name}은 지원되지 않는 파일 형식입니다.`, 'error');
                return false;
            }

            if (file.size > 50 * 1024 * 1024) { // 50MB 제한
                this.showSnackbar(`${file.name} 파일이 너무 큽니다. (최대 50MB)`, 'error');
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
                '.xlsx': 'mdi-file-excel-box'
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
                '.xlsx': 'green'
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
            const result = await backend.deleteInstanceSource(file);
            if (result.error) {
                this.showSnackbar(result.error.message, 'error');
                return;
            }
            this.sourceList = this.sourceList.filter(item => item.id !== file.id);
            this.showSnackbar(`${file.name} 파일이 삭제되었습니다.`, 'success');
        },

        showSnackbar(message, color = 'success') {
            this.snackbar = {
                show: true,
                message,
                color
            };
        }
    },
}
</script>

<style scoped>
.uploading-border {
    border: 2px dashed #ff9800 !important;
    border-radius: 8px;
    position: relative;
}

.source-card {
    transition: all 0.3s ease;
    position: relative;
}

.source-card:hover {
    transform: translateY(-2px);
}

.add-file-card {
    min-height: 105px;
    border: 2px dashed #9e9e9e;
    border-radius: 12px;
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

.file-info {
    font-size: 0.875rem;
}

.text-truncate {
    max-width: 200px;
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

