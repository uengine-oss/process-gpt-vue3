<template>
    <div class="form-file-field">
        <v-file-input
            v-if="!localReadonly && !localDisabled"
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
                <div class="d-flex align-center cursor-pointer text-body-1" @click="downloadFile(file)">
                    <v-icon>mdi-download</v-icon>
                    <span class="ml-4">{{ file.originalFileName }}</span>
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

        if (this.modelValue && this.modelValue.path) {
            try {
                // modelValue 검증 - 올바른 파일 경로인지 확인
                // if (typeof this.modelValue !== 'string' || this.modelValue.includes('[object Object]')) {
                //     console.warn('[FileField] 잘못된 파일 경로 형식:', this.modelValue);
                //     this.$emit('update:modelValue', "");
                //     return;
                // }

                console.log('[FileField] 파일 다운로드 시도:', this.modelValue.path);
                const response = await this.backend.downloadFile(this.modelValue.path);
                if (response && response.error) {
                    console.warn('[FileField] 파일 다운로드 응답 에러:', response.error);
                    this.$emit('update:modelValue', { path: null, name: null });
                } else if (response && response.file) {
                    response.file.originalFileName = this.modelValue.name;
                    response.file.path = this.modelValue.path;
                    this.selectedFiles = [response.file];
                    console.log('[FileField] 파일 다운로드 성공');
                } else {
                    console.warn('[FileField] 파일 다운로드 응답이 비어있음');
                    this.$emit('update:modelValue', { path: null, name: null });
                }
            } catch (error) {
                console.error('[FileField] 파일 다운로드 에러 발생:', error);
                this.$emit('update:modelValue', { path: null, name: null });
                // 에러를 부모 컴포넌트에 전달 (선택적)
                this.$emit('download-error', error);
            }
        } else if (this.modelValue && typeof this.modelValue === 'string') {
            try {
                const response = await this.backend.downloadFile(this.modelValue);
                if (response && response.file) {
                    response.file.originalFileName = this.modelValue;
                    response.file.path = this.modelValue;
                    this.selectedFiles = [response.file];
                }
            } catch (error) {
                console.error('[FileField] 파일 다운로드 에러 발생:', error);
                this.selectedFiles = [
                    {
                        originalFileName: this.modelValue,
                        path: this.modelValue,
                        name: this.modelValue,
                        fullPath: this.modelValue
                    }
                ];
            }
        } else {
            this.selectedFiles = [
                {
                    path: null,
                    name: null
                }
            ];
        }
    },

    beforeUnmount() {
        // EventBus 이벤트 리스너 해제
        if (this.EventBus) {
            this.EventBus.off('browser-use-files-generated', this.handleGeneratedFiles);
            console.log('[FileField] EventBus 리스너 해제 완료');
        }
    },

    methods: {
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
                    this.$emit('update:modelValue', { path: res.path, name: fileName, fullPath: res.fullPath || res.path });
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
            link.download = file.originalFileName; // 원본 파일명 사용
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
</style>
