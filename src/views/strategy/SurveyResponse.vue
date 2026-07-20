<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStrategyStore } from '@/stores/strategy/strategyStore';

const route = useRoute();
const router = useRouter();
const store = useStrategyStore();

const loading = ref(true);
const submitting = ref(false);
const notFound = ref(false);
const survey = ref<any>(null);
const answers = ref<{ question: string; rating: number; comment: string }[]>([]);
const submitted = ref(false);

onMounted(async () => {
    try {
        survey.value = await store.getSurvey(route.params.requestId as string);
        submitted.value = survey.value.status === 'ANSWERED';
        answers.value = (survey.value.questions || []).map((q: string) => ({ question: q, rating: 0, comment: '' }));
    } catch (e) {
        notFound.value = true;
    } finally {
        loading.value = false;
    }
});

const canSubmit = () => answers.value.length > 0 && answers.value.every((a) => a.rating >= 1);

async function submit() {
    submitting.value = true;
    try {
        await store.respondSurvey(route.params.requestId as string, answers.value);
        submitted.value = true;
    } catch (e: any) {
        if (e?.response?.status === 409) submitted.value = true;
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="survey-page d-flex justify-center pa-4">
        <v-card variant="outlined" rounded="lg" class="pa-6" style="max-width: 640px; width: 100%">
            <div v-if="loading" class="d-flex justify-center py-12">
                <v-progress-circular indeterminate color="primary" />
            </div>

            <div v-else-if="notFound" class="text-center py-8">
                <v-icon size="48" color="grey">mdi-help-circle-outline</v-icon>
                <p class="mt-2">{{ $t('strategyBoard.surveyNotFound') }}</p>
            </div>

            <div v-else-if="submitted" class="text-center py-8">
                <v-icon size="56" color="success">mdi-check-circle-outline</v-icon>
                <h3 class="text-h6 mt-3">{{ $t('strategyBoard.surveyThanks') }}</h3>
                <p class="text-caption text-medium-emphasis">{{ survey.kpi_name }}</p>
                <v-btn class="mt-4" variant="tonal" @click="router.push('/todolist')">{{ $t('strategyBoard.backToTodolist') }}</v-btn>
            </div>

            <template v-else>
                <v-chip size="small" variant="tonal" color="primary" class="mb-2" prepend-icon="mdi-clipboard-text-outline">
                    {{ survey.kpi_name }}
                </v-chip>
                <h2 class="text-h6 font-weight-bold mb-1">{{ $t('strategyBoard.surveyTitle') }}</h2>
                <p class="text-body-2 text-medium-emphasis mb-5">
                    {{ $t('strategyBoard.surveyIntro', { process: survey.proc_inst_name || survey.proc_inst_id }) }}
                </p>

                <div v-for="(answer, i) in answers" :key="i" class="mb-5">
                    <p class="text-subtitle-2 mb-1">{{ i + 1 }}. {{ answer.question }}</p>
                    <div class="d-flex align-center ga-3">
                        <v-rating v-model="answer.rating" :length="5" color="warning" hover density="comfortable" />
                        <span class="text-caption text-medium-emphasis">{{ answer.rating ? answer.rating + ' / 5' : '' }}</span>
                    </div>
                    <v-text-field
                        v-model="answer.comment"
                        :placeholder="$t('strategyBoard.commentPlaceholder')"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="mt-1"
                    />
                </div>

                <v-btn block color="primary" size="large" :loading="submitting" :disabled="!canSubmit()" @click="submit">
                    {{ $t('strategyBoard.submitSurvey') }}
                </v-btn>
            </template>
        </v-card>
    </div>
</template>

<style scoped>
.survey-page {
    height: 100%;
    overflow: auto;
}
</style>
