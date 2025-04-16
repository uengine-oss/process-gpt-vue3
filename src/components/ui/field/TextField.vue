<template>
    <div class="form-text-field">
        <v-text-field v-model="localModelValue"
            :type="localType" 
            :disabled="localDisabled" 
            :readonly="localReadonly" 
            :id="id" 
            :variant="localReadonly ? 'filled' : 'outlined'"
            :hide-details="hideDetails"
            :density="density"
            @click="handleFieldClick"
            ref="textField"
        >
            <template v-slot:label>
                <span style="color:black;">
                    {{(localAlias && localAlias.length > 0) ? localAlias : localName}}
                </span>
            </template>
        </v-text-field>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"

export default {
    name: "TextField",
    
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
        type: String,
        disabled: String,
        readonly: String
    },

    data() {
        return {
            localModelValue: "",

            localName: "",
            localAlias: "",
            localType: "",
            localDisabled: false,

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                {
                    dataToUse: "localType",
                    htmlAttribute: "type",
                    settingLabel: "FormDefinitionPanel.type",
                    settingType: "select",
                    settingValue: ["text", "number", "email", "url", "date", "datetime-local", "month", "week", "time", "password", "tel", "color"]
                },
                commonSettingInfos["localDisabled"],
                commonSettingInfos["localReadonly"]
            ],
            id: (Date.now().toString() + Math.random().toString(36).substring(2, 5))
        };
    },

    watch: {
        modelValue: {
            handler() {
                this.localModelValue  = ((this.modelValue && this.modelValue.length > 0) ? this.modelValue : "")
            },
            deep: true,
            immediate: true
        },

        localModelValue: {
            handler() {
                this.$emit('update:modelValue', this.localModelValue)
            },
            deep: true,
            immediate: true
        }
    },

    computed: {
        isDateType() {
            return ['date', 'datetime-local', 'month', 'week', 'time'].includes(this.localType);
        }
    },

    methods: {
        handleFieldClick() {
            // 날짜 타입인 경우에만 동작
            if (this.isDateType) {
                // 참조된 텍스트 필드 엘리먼트를 찾아 showPicker 메서드 호출
                const inputElement = this.$refs.textField.$el.querySelector('input');
                if (inputElement && typeof inputElement.showPicker === 'function') {
                    inputElement.showPicker();
                }
            }
        }
    },

    created() {
        if(this.modelValue){
            if(typeof this.modelValue === 'object' && this.modelValue.values && Array.isArray(this.modelValue.values)) {
             this.localModelValue = this.modelValue.values.join(',')
            } else {
                this.localModelValue = this.modelValue
            }
        } else {
            // 각 타입에 맞게 적절한 디폴트값을 세탕하기 위해서
            let valueToSet = ""
            switch (this.type) {
                case "number":
                    valueToSet = "0"
                    break;
                case "color":
                    valueToSet = "#000000"
                    break;
                default:
                    break;
            }
            this.localModelValue = valueToSet
        }
        
        this.localName = this.name ?? "name"
        this.localAlias = this.alias ?? ""
        this.localType = this.type ?? "text"
        this.localDisabled = this.disabled === "true"
        this.localReadonly = this.readonly === "true"
    }
}
</script>

<style lang="scss">

</style>
