<template>
    <div class="form-file-field">
        <v-file-input
            v-if="!localReadonly && !localDisabled"
            :label="(localAlias && localAlias.length > 0) ? localAlias : localName"
            v-model="selectedFiles"
            :variant="localReadonly ? 'filled' : 'outlined'"
            :hide-details="hideDetails"
            :density="density"
            @change="handleFileChange"
        ></v-file-input>
        <div v-if="selectedFiles && selectedFiles.length > 0 && imgBaseUrl && imgBaseUrl.includes('data:image/')">
            <p style="margin-top: -10px; margin-bottom: 10px;">* 해상도가 낮거나 이미지가 너무 작은 경우 GPT 모델이 인식하지 못할 수 있습니다.</p>
            <img :src="imgBaseUrl" alt="Selected Image" style="width: 350px; max-height: auto;" />
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
import { commonSettingInfos } from "./CommonSettingInfos.vue"
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

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
            localName: "",
            localAlias: "",
            localDisabled: false,
            localReadonly: false,
            selectedFiles: [],
            imgBaseUrl: null,

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                commonSettingInfos["localDisabled"],
                commonSettingInfos["localReadonly"]
            ]
        };
    },

    watch: {
        selectedFiles(val) {
            if (!this.selectedFiles || this.selectedFiles.length <= 0) {
                this.$emit('update:modelValue', { path: null, name: null })
                return
            }
            
            if (Array.isArray(this.selectedFiles) && this.selectedFiles.length > 0) {
                this.selectedFiles.forEach(file => {
                    if (file instanceof File) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            // this.$emit('update:modelValue', e.target.result)
                            this.imgBaseUrl = e.target.result
                        }
                        reader.readAsDataURL(file)
                    }
                })
            }
        }
    },

    created() {
        this.localName = this.name ?? "name"
        this.localAlias = this.alias ?? ""
        this.localDisabled = this.disabled === "true"
        this.localReadonly = this.readonly === "true"

        // this.$emit('update:modelValue', "")
    },

    async mounted() {
        if (this.modelValue && this.modelValue.path) {
            try {
                // modelValue 검증 - 올바른 파일 경로인지 확인
                // if (typeof this.modelValue !== 'string' || this.modelValue.includes('[object Object]')) {
                //     console.warn('[FileField] 잘못된 파일 경로 형식:', this.modelValue);
                //     this.$emit('update:modelValue', "");
                //     return;
                // }
                
                console.log('[FileField] 파일 다운로드 시도:', this.modelValue.path);
                const response = await backend.downloadFile(this.modelValue.path);
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
                const response = await backend.downloadFile(this.modelValue);
                if (response && response.file) {
                    response.file.originalFileName = this.modelValue;
                    response.file.path = this.modelValue;
                    this.selectedFiles = [response.file];
                }
            } catch (error) {
                console.error('[FileField] 파일 다운로드 에러 발생:', error);
                this.selectedFiles = [{
                    originalFileName: this.modelValue,
                    path: this.modelValue,
                    name: this.modelValue
                }]
            }
        } else {
            this.selectedFiles = [{
                path: null,
                name: null
            }]
        }
    },

    methods: {
        async handleFileChange(event) {
            try {
                const file = event.target.files[0];
                const fileName = file.name;
                console.log('[FileField] 파일 업로드 시도:', fileName);
                const res = await backend.uploadFile(fileName, file);
                if (res && res.error) {
                    console.warn('[FileField] 파일 업로드 응답 에러:', res.error);
                    this.$emit('update:modelValue', { path: null, name: null });
                } else if (res && res.path) {
                    console.log('[FileField] 파일 업로드 성공:', res.path);
                    this.$emit('update:modelValue', { path: res.path, name: fileName });
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
