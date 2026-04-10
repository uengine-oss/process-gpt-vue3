<template>
    <div class="form-file-field">
        <v-file-input
            v-if="!localDisabled && (!localReadonly || allowReadonlyUpload)"
            :label="localAlias && localAlias.length > 0 ? localAlias : localName"
            v-model="selectedFiles"
            :variant="localReadonly ? 'filled' : 'outlined'"
            :hide-details="hideDetails"
            :density="density"
            @change="handleFileChange"
        ></v-file-input>
        <div v-if="selectedFiles && selectedFiles.length > 0 && imgBaseUrl && imgBaseUrl.includes('data:image/')">
            <p style="margin-top: -10px; margin-bottom: 10px">
                * 해상도가 낮거나 이미지가 너무 작은 경우 GPT 모델이 인식하지 못할 수 있습니다.
            </p>
            <img :src="imgBaseUrl" alt="Selected Image" style="width: 350px; max-height: auto" />
        </div>
        <div v-if="localReadonly || localDisabled">
            <div v-for="file in selectedFiles" :key="file.name">
                <div class="file-link-card d-flex align-center" @click="downloadFile(file)">
                    <div class="file-link-icon">
                        <v-icon size="18">mdi-file-download-outline</v-icon>
                    </div>
                    <div class="file-link-text">
                        <div class="file-link-name">{{ file.originalFileName || file.name || file.path }}</div>
                        <div class="file-link-sub">다운로드</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { commonSettingInfos } from './CommonSettingInfos.vue';
import BackendFactory from '@/components/api/BackendFactory';

export default {
    props: {
        // UI 관련 설정 props 시작
        hideDetails: {
            type: Boolean,
            default: false
        },
        density: {
            type: String,
            default: 'compact'
        },
        // UI 관련 설정 props 끝
        modelValue: {
            type: Object,
            default: () => ({
                path: null,
                name: ''
            })
        },
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        disabled: String,
        readonly: String
        ,
        allowReadonlyUpload: {
            type: Boolean,
            default: true
        }
    },

    data() {
        return {
            localName: '',
            localAlias: '',
            localDisabled: false,
            localReadonly: false,
            selectedFiles: [],
            imgBaseUrl: null,

            settingInfos: [
                commonSettingInfos['localName'],
                commonSettingInfos['localAlias'],
                commonSettingInfos['localDisabled'],
                commonSettingInfos['localReadonly']
            ],

            backend: null
        };
    },

    watch: {
        selectedFiles(val) {
            if (!this.selectedFiles || this.selectedFiles.length <= 0) {
                this.$emit('update:modelValue', { path: null, name: null });
                return;
            }

            if (Array.isArray(this.selectedFiles) && this.selectedFiles.length > 0) {
                this.selectedFiles.forEach((file) => {
                    if (file instanceof File) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            // this.$emit('update:modelValue', e.target.result)
                            this.imgBaseUrl = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        },
        modelValue: {
            deep: true,
            async handler(newVal) {
                await this.applyModelValue(newVal);
            }
        }
    },

    created() {
        this.localName = this.name ?? 'name';
        this.localAlias = this.alias ?? '';
        this.localDisabled = this.disabled === 'true';
        this.localReadonly = this.readonly === 'true';

        // this.$emit('update:modelValue', "")
        this.backend = BackendFactory.createBackend();
    },

    async mounted() {
        // EventBus 이벤트 리스너 등록
        if (this.EventBus) {
            this.EventBus.on('browser-use-files-generated', this.handleGeneratedFiles);
            console.log('[FileField] EventBus 리스너 등록 완료');
        }
        await this.applyModelValue(this.modelValue);
    },

    beforeUnmount() {
        // EventBus 이벤트 리스너 해제
        if (this.EventBus) {
            this.EventBus.off('browser-use-files-generated', this.handleGeneratedFiles);
            console.log('[FileField] EventBus 리스너 해제 완료');
        }
    },

    methods: {
        isRemoteUrl(path) {
            return typeof path === 'string' && /^https?:\/\//i.test(path);
        },
        async fetchFileFromUrl(url, fileName) {
            try {
                const response = await fetch(url);
                if (!response.ok) return null;
                const blob = await response.blob();
                const name = fileName || url.split('?')[0].split('#')[0].split('/').pop() || 'file';
                return new File([blob], name, { type: blob.type || 'application/octet-stream' });
            } catch (error) {
                console.error('[FileField] URL 파일 다운로드 실패:', error);
                return null;
            }
        },
        async applyModelValue(value) {
            const currentPath =
                this.selectedFiles && this.selectedFiles.length > 0
                    ? this.selectedFiles[0].path || this.selectedFiles[0].name || null
                    : null;

            if (value && typeof value === 'object' && value.path && currentPath === value.path) return;
            if (typeof value === 'string' && currentPath === value) return;

            if (value && typeof value === 'object' && value.path) {
                try {
                    const path = value.path;
                    const displayName = value.name || this.guessNameFromPath(path);
                    if (this.isRemoteUrl(path)) {
                        const remoteFile = await this.fetchFileFromUrl(path, displayName);
                        if (remoteFile) {
                            remoteFile.originalFileName = displayName || remoteFile.name;
                            remoteFile.path = path;
                            this.selectedFiles = [remoteFile];
                            return;
                        }
                    }
                    console.log('[FileField] 파일 다운로드 시도:', path);
                    const response = await this.backend.downloadFile(path);
                    if (response && response.error) {
                        console.warn('[FileField] 파일 다운로드 응답 에러:', response.error);
                        this.selectedFiles = [
                            {
                                name: displayName || path,
                                originalFileName: displayName || path,
                                path
                            }
                        ];
                    } else if (response && response.file) {
                        response.file.originalFileName = displayName || response.file.name || this.guessNameFromPath(path);
                        response.file.path = path;
                        this.selectedFiles = [response.file];
                        console.log('[FileField] 파일 다운로드 성공');
                    } else {
                        console.warn('[FileField] 파일 다운로드 응답이 비어있음');
                        this.selectedFiles = [
                            {
                                name: displayName || path,
                                originalFileName: displayName || path,
                                path
                            }
                        ];
                    }
                } catch (error) {
                    console.error('[FileField] 파일 다운로드 에러 발생:', error);
                    this.selectedFiles = [
                        {
                            name: value.name || value.path || '',
                            originalFileName: value.name || value.path || '',
                            path: value.path
                        }
                    ];
                    this.$emit('download-error', error);
                }
                return;
            }

            if (value && typeof value === 'string') {
                try {
                    const displayName = this.guessNameFromPath(value);
                    if (this.isRemoteUrl(value)) {
                        const remoteFile = await this.fetchFileFromUrl(value, displayName);
                        if (remoteFile) {
                            remoteFile.originalFileName = remoteFile.name;
                            remoteFile.path = value;
                            this.selectedFiles = [remoteFile];
                            return;
                        }
                    }
                    const response = await this.backend.downloadFile(value);
                    if (response && response.file) {
                        response.file.originalFileName = displayName || response.file.name || value;
                        response.file.path = value;
                        this.selectedFiles = [response.file];
                    } else {
                        this.selectedFiles = [
                            {
                                name: displayName || value,
                                originalFileName: displayName || value,
                                path: value
                            }
                        ];
                    }
                } catch (error) {
                    console.error('[FileField] 파일 다운로드 에러 발생:', error);
                    this.selectedFiles = [
                        {
                            originalFileName: displayName || value,
                            path: value,
                            name: displayName || value,
                            fullPath: value
                        }
                    ];
                }
                return;
            }

            this.selectedFiles = [
                {
                    path: null,
                    name: null
                }
            ];
        },
        guessNameFromPath(path) {
            if (!path || typeof path !== 'string') return '';
            const clean = path.split('?')[0].split('#')[0];
            const parts = clean.split('/');
            return parts[parts.length - 1] || '';
        },
        handleGeneratedFiles(data) {
            console.log('[FileField] EventBus로부터 파일 수신:', data);

            if (!data || !data.files || data.files.length === 0) {
                console.warn('[FileField] 수신된 파일이 없습니다.');
                return;
            }

            // File 객체들을 selectedFiles에 추가
            const newFiles = data.files.map((file) => {
                // File 객체에 추가 속성 설정
                file.originalFileName = file.name;
                file.path = file.url;

                return file;
            });

            // 기존 파일이 비어있거나 초기값인 경우 교체
            if (
                !this.selectedFiles ||
                this.selectedFiles.length === 0 ||
                (this.selectedFiles.length === 1 && !this.selectedFiles[0].name)
            ) {
                this.selectedFiles = newFiles;
                console.log(`[FileField] ${newFiles.length}개 파일이 추가되었습니다.`, this.selectedFiles);
            } else {
                // 중복 체크 후 추가
                const filesToAdd = [];
                let duplicateCount = 0;

                newFiles.forEach((newFile) => {
                    const isDuplicate = this.selectedFiles.some((existingFile) => {
                        // 파일명, 크기, 타입을 모두 비교
                        return (
                            existingFile.name === newFile.name && existingFile.size === newFile.size && existingFile.type === newFile.type
                        );
                    });

                    if (isDuplicate) {
                        duplicateCount++;
                        console.log(`[FileField] 중복 파일 제외: ${newFile.name} (${newFile.size} bytes, ${newFile.type})`);
                    } else {
                        filesToAdd.push(newFile);
                    }
                });

                if (filesToAdd.length > 0) {
                    this.selectedFiles = [...this.selectedFiles, ...filesToAdd];
                    console.log(
                        `[FileField] ${filesToAdd.length}개 파일이 추가되었습니다. (${duplicateCount}개 중복 제외)`,
                        this.selectedFiles
                    );
                } else {
                    console.log(`[FileField] 모든 파일이 중복되어 추가되지 않았습니다. (${duplicateCount}개 중복)`);
                }
            }

            // ✅ 첫 번째 파일을 modelValue로 업데이트 - 브라우저 유즈 파일인 경우 원본 URL 사용
            if (this.selectedFiles && this.selectedFiles.length > 0 && this.selectedFiles[0].name) {
                const firstFile = this.selectedFiles[0];
                const filePath =
                    firstFile.isBrowserUseFile && firstFile.originalUrl ? firstFile.originalUrl : firstFile.path || firstFile.name;

                console.log(`[FileField] ✅ modelValue 업데이트: path=${filePath}, name=${firstFile.originalFileName || firstFile.name}`);

                this.$emit('update:modelValue', {
                    path: filePath,
                    name: firstFile.originalFileName || firstFile.name
                });
            }
        },
        async handleFileChange(event) {
            try {
                const file = event.target.files[0];
                const fileName = file.name;
                console.log('[FileField] 파일 업로드 시도:', fileName);
                const res = await this.backend.uploadFile(fileName, file);
                if (res && res.error) {
                    console.warn('[FileField] 파일 업로드 응답 에러:', res.error);
                    this.$emit('update:modelValue', { path: null, name: null });
                } else if (res && res.path) {
                    console.log('[FileField] 파일 업로드 성공:', res.path);
                    const storagePath = res.path;
                    // 원본 파일명 유지: selectedFiles에 직접 설정하여 watcher 재다운로드 방지
                    file.originalFileName = fileName;
                    file.path = storagePath;
                    this.selectedFiles = [file];
                    this.$emit('update:modelValue', { path: storagePath, name: fileName, fullPath: res.fullPath || storagePath });
                } else {
                    console.warn('[FileField] 파일 업로드 응답이 비어있음');
                    this.$emit('update:modelValue', { path: null, name: null });
                }
            } catch (error) {
                console.error('[FileField] 파일 업로드 에러 발생:', error);
                this.$emit('update:modelValue', { path: null, name: null });
                // 에러를 부모 컴포넌트에 전달 (선택적)
                this.$emit('upload-error', error);
            }
        },
        async downloadFile(file) {
            // File 객체에서 직접 URL 생성
            const url = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.originalFileName || file.name || 'download'; // 원본 파일명 사용
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 메모리 정리
            URL.revokeObjectURL(url);
        }
    }
};
</script>

<style lang="scss">
.form-file-field {
    margin-bottom: 16px;
}
.form-file-field :deep(.v-file-input) {
    margin-bottom: 32px;
}
.form-file-field .file-link-card {
    margin-top: 10px;
}
.file-link-card {
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid #e4e6ea;
    border-radius: 10px;
    background: #fafbfc;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}
.file-link-card:hover {
    background: #ffffff;
    border-color: #c7d2fe;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.file-link-icon {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: #eef2ff;
    color: #4f46e5;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.file-link-text {
    min-width: 0;
}
.file-link-name {
    font-size: 13px;
    font-weight: 600;
    color: #1f2937;
    word-break: break-all;
}
.file-link-sub {
    font-size: 12px;
    color: #6b7280;
    margin-top: 2px;
}
</style>
