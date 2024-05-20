<template>
    <!-- #region 프롬프트 입력 항목 토글 버튼 -->
    <div class="d-flex justify-end">
        <v-tooltip>
            <template v-slot:activator="{ props }">
                <v-btn v-bind="props"
                    icon variant="text"
                    class="text-medium-emphasis"
                    @click="promptInput.isVisible = !promptInput.isVisible"
                >
                    <Icon icon="mdi:magic" width="24" height="24" />
                </v-btn>
            </template>
            <span>{{ "스크립트 생성" }}</span>
        </v-tooltip>
    </div>
    <!-- #endregion -->

    <!-- #region 프롬프트 입력 항목 -->
    <div v-if="promptInput.isVisible">
        <div>{{ "프롬프트 입력" }}</div>
        <v-textarea v-model="promptInput.prompt" style="width:100%"></v-textarea>
        <v-btn @click="generateScript" class="w-100"> 스크립트 생성 </v-btn>
    </div>
    <!-- #endregion -->
</template>
<script>
import ChatModule from '@/components/ChatModule.vue'
import ChatGenerator from '@/components/ai/ScriptGenerator.js'

export default {
    mixins: [ChatModule],
    name: 'generate-script-panel',
    props: {
        modelValue: String
    },
    emits: ['update:modelValue'],

    computed: {
        localModelValue: {
            get() {
                return this.modelValue
            },
            set(value) {
                this.$emit('update:modelValue', value)
            }
        }
    },
    watch: {
    },

    data() {
        return {
            promptInput: {
                isVisible: false,
                prompt: ""
            }
        }
    },

    async created() {
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
        await this.init();
    },

    methods: {
        //#region AI 스크립트 생성 요청 및 응답 처리
        generateScript() {
            this.generator.generateScript(this.promptInput.prompt, this.localModelValue);
        },

        afterModelCreated(response) {
            this.processResponse(response);
        },

        afterGenerationFinished(response) {
            this.processResponse(response);
        },

        processResponse(response) {
            this.localModelValue = response;
        }
        //#endregion
    }
};
</script>