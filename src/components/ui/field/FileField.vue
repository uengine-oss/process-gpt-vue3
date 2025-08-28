<template>
    <div class="form-file-field">
        <v-file-input
            :label="(localAlias && localAlias.length > 0) ? localAlias : localName"
            v-model="selectedFiles"
            :disabled="localDisabled"
            :readonly="localReadonly"
            :variant="localReadonly ? 'filled' : 'outlined'"
            :hide-details="hideDetails"
            :density="density"
            @change="handleFileChange"
        ></v-file-input>
        <div v-if="selectedFiles && selectedFiles.length > 0 && imgBaseUrl && imgBaseUrl.includes('data:image/')">
            <p style="margin-top: -10px; margin-bottom: 10px;">* 해상도가 낮거나 이미지가 너무 작은 경우 GPT 모델이 인식하지 못할 수 있습니다.</p>
            <img :src="imgBaseUrl" alt="Selected Image" style="width: 350px; max-height: auto;" />
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
        modelValue: String,
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
            selectedFiles: null,
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
                this.$emit('update:modelValue', "")
                return
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                // this.$emit('update:modelValue', e.target.result)
                this.imgBaseUrl = e.target.result
            }
            reader.readAsDataURL(this.selectedFiles[0])
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
        if (this.modelValue) {
            try {
                // modelValue 검증 - 올바른 파일 경로인지 확인
                if (typeof this.modelValue !== 'string' || this.modelValue.includes('[object Object]')) {
                    console.warn('[FileField] 잘못된 파일 경로 형식:', this.modelValue);
                    this.$emit('update:modelValue', "");
                    return;
                }
                
                console.log('[FileField] 파일 다운로드 시도:', this.modelValue);
                const response = await backend.downloadFile(this.modelValue);
                if (response && response.error) {
                    console.warn('[FileField] 파일 다운로드 응답 에러:', response.error);
                    this.$emit('update:modelValue', "");
                } else if (response && response.file) {
                    this.selectedFiles = [response.file];
                    console.log('[FileField] 파일 다운로드 성공');
                } else {
                    console.warn('[FileField] 파일 다운로드 응답이 비어있음');
                    this.$emit('update:modelValue', "");
                }
            } catch (error) {
                console.error('[FileField] 파일 다운로드 에러 발생:', error);
                this.$emit('update:modelValue', "");
                // 에러를 부모 컴포넌트에 전달 (선택적)
                this.$emit('download-error', error);
            }
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
                    this.$emit('update:modelValue', "");
                } else if (res && res.path) {
                    console.log('[FileField] 파일 업로드 성공:', res.path);
                    this.$emit('update:modelValue', res.path);
                } else {
                    console.warn('[FileField] 파일 업로드 응답이 비어있음');
                    this.$emit('update:modelValue', "");
                }
            } catch (error) {
                console.error('[FileField] 파일 업로드 에러 발생:', error);
                this.$emit('update:modelValue', "");
                // 에러를 부모 컴포넌트에 전달 (선택적)
                this.$emit('upload-error', error);
            }
        }
    }
};
</script>

<style lang="scss">
.form-file-field {
    margin-bottom: 16px;
}
</style>
