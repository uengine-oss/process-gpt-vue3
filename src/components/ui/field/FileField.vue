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
            const response = await backend.downloadFile(this.modelValue);
            if (response.error) {
                this.$emit('update:modelValue', "");
            } else {
                this.selectedFiles = [response.file];
            }
        }
    },

    methods: {
        async handleFileChange(event) {
            const file = event.target.files[0];
            const fileName = file.name;
            const res = await backend.uploadFile(fileName, file);
            if (res.error) {
                this.$emit('update:modelValue', "");
            } else {
                this.$emit('update:modelValue', res.path);
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
