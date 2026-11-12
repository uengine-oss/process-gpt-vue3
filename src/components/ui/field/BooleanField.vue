<template>
    <div class="form-boolean-field">
        <v-checkbox
            :label="localAlias && localAlias.length > 0 ? localAlias : localName"
            v-model="localModelValue"
            :disabled="localDisabled"
            :readonly="localReadonly"
            :hide-details="hideDetails"
            :density="density"
        ></v-checkbox>
    </div>
</template>

<script>
import { commonSettingInfos } from './CommonSettingInfos.vue';

/** 예/아니오 값: true · 'true' · 'Y' · 'yes' · '예' · 1 만 참, 나머지(빈 값 · 'false' · 'N')는 거짓 */
function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const s = String(value ?? '')
        .trim()
        .toLowerCase();
    return ['true', 'y', 'yes', '1', '예', 'on'].includes(s);
}

export default {
    name: 'BooleanField',

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
        // 에이전트 · 외부 시스템이 넣은 값은 문자열('true'/'false')로 오기도 한다 — 그대로 두면 'false' 도 체크된 칸이 된다
        modelValue: [Boolean, String, Number],
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        disabled: String,
        readonly: String
    },

    data() {
        return {
            localModelValue: false,

            localName: '',
            localAlias: '',
            localDisabled: false,
            localReadonly: false,

            settingInfos: [
                commonSettingInfos['localName'],
                commonSettingInfos['localAlias'],
                commonSettingInfos['localDisabled'],
                commonSettingInfos['localReadonly']
            ]
        };
    },

    watch: {
        modelValue: {
            handler() {
                this.localModelValue = toBoolean(this.modelValue);
            },
            deep: true,
            immediate: true
        },

        localModelValue: {
            handler() {
                this.$emit('update:modelValue', this.localModelValue);
            },
            deep: true,
            immediate: true
        }
    },

    created() {
        this.localModelValue = toBoolean(this.modelValue);

        this.localName = this.name ?? 'name';
        this.localAlias = this.alias ?? '';
        this.localDisabled = this.disabled === 'true';
        this.localReadonly = this.readonly === 'true';
    }
};
</script>

<style lang="scss">
.form-boolean-field {
    margin-bottom: 16px;
}
</style>
