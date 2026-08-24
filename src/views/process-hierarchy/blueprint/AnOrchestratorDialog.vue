<template>
    <v-dialog :model-value="modelValue" max-width="1280" scrollable @update:model-value="emit('update:modelValue', $event)">
        <v-card rounded="lg" class="an-dialog">
            <v-card-title class="an-dialog__title">
                <v-icon color="indigo" size="20" class="mr-2">mdi-sitemap-outline</v-icon>
                <span>To-Be Master Orchestrator</span>
                <v-spacer />
                <v-btn icon variant="text" size="small" @click="emit('update:modelValue', false)">
                    <v-icon size="18">mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <v-divider />
            <v-card-text class="an-dialog__body">
                <!-- 순서도 페이지가 provide 한 AN_STUDIO_KEY 를 inject 해 동작 -->
                <ToBeOrchestratorStage embedded />
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
/**
 * AnOrchestratorDialog — 순서도(To-Be 모드)에서 챗 명령으로 실행한
 * To-Be Orchestrator 설계 결과(스윔레인 + ROI + Skill Shift)를 보여주는 경량 다이얼로그.
 */
import ToBeOrchestratorStage from '@/views/an-transformation-studio/stages/ToBeOrchestratorStage.vue';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();
</script>

<style scoped>
.an-dialog__title {
    display: flex;
    align-items: center;
    font-size: 15px;
    font-weight: 700;
    padding: 10px 16px;
}
.an-dialog__body {
    padding: 0;
    background: #f7f7fb;
    max-height: calc(92vh - 64px);
}
</style>
