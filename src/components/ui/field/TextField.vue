<template>
    <div>
        <v-text-field v-model="localModelValue">
            <template v-slot:label>
                <span style="color:black;">
                    {{localAlias ?? localName}}
                </span>
            </template>
        </v-text-field>
    </div>
</template>

<script>
export default {
    name: "TextField",
    
    props: {
        modelValue: String,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String
    },

    data() {
        return {
            localModelValue: this.modelValue,

            localName: this.name,
            localAlias: this.alias,

            /**
             * 사용되는 속성들을 종합적으로 관리하기 위해서
             * dataToUse: 실제로 설정이나 HTML 변수로 반영시킬 data 변수명
             * htmlAttribute: HTML 속성으로 사용되는 이름
             * settingLabel: 변수 값 설정창에서 표시되는 라벨
             * settingType: 설정창에서 입력을 받기 위한 타입
             * validCheck: 설정창에서 입력 완료시에 유효성을 확인하는데 사용되는 함수
             */
            settingInfos: [
                {
                    dataToUse: "localName",
                    htmlAttribute: "name",
                    settingLabel: "Name",
                    settingType: "text",
                    validCheck: (value) => {
                        if(!value || value.length <= 0) return "Name 속성에 값을 입력해 주세요."
                        if(!/^[가-힣a-zA-Z0-9_\-. ]+$/.test(value)) return "Name 속성은 한글, 영문, 숫자, 공백, 밑줄(_), 대시(-), 점(.) 만 입력 가능합니다!"
                        return null
                    }
                },

                {
                    dataToUse: "localAlias",
                    htmlAttribute: "alias",
                    settingLabel: "Label",
                    settingType: "text",
                    validCheck: (value) => {
                        if(!value || value.length <= 0) return "Label 속성에 값을 입력해 주세요."
                        if(!/^[가-힣a-zA-Z0-9_\-. ]+$/.test(value)) return "Label 속성은 한글, 영문, 숫자, 공백, 밑줄(_), 대시(-), 점(.) 만 입력 가능합니다!"
                        return null
                    }
                }
            ]
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
}
</script>

<style lang="scss">

</style>
