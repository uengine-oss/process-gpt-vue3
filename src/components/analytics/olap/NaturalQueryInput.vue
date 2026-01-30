<script setup lang="ts">
/**
 * NaturalQueryInput - 자연어 질의 입력 컴포넌트
 * Text2SQL 인터페이스
 */
import { ref } from 'vue'
import { useCubeStore } from '@/stores/analytics/cubeStore'

const store = useCubeStore()
const question = ref('')
const queryHistory = ref<Array<{ question: string; success: boolean; timestamp: Date }>>([])
const showTips = ref(false)

const exampleQueries = [
  '월별 Task 건수',
  '프로세스별 평균 처리시간',
  '에이전트와 사람의 작업 비교',
  '가장 많은 에러가 발생한 활동',
  '사용자별 완료한 Task 수'
]

const submitQuery = async () => {
  if (!question.value.trim()) return

  const q = question.value.trim()

  try {
    await store.executeNaturalQuery(q)
    queryHistory.value.unshift({
      question: q,
      success: !store.error,
      timestamp: new Date()
    })
    // Keep only last 10 queries
    if (queryHistory.value.length > 10) {
      queryHistory.value = queryHistory.value.slice(0, 10)
    }
  } catch (e) {
    queryHistory.value.unshift({
      question: q,
      success: false,
      timestamp: new Date()
    })
  }
}

const useExample = (example: string) => {
  question.value = example
}

const useHistoryItem = (item: { question: string }) => {
  question.value = item.question
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <v-card>
    <v-card-title class="d-flex align-center ga-2">
      <v-icon color="primary">mdi-chat-question</v-icon>
      자연어 질의
    </v-card-title>

    <v-divider />

    <v-card-text>
      <!-- Query Input -->
      <v-textarea
        v-model="question"
        label="질문을 입력하세요"
        placeholder="예: 월별 Task 건수를 알려줘"
        variant="outlined"
        rows="2"
        auto-grow
        hide-details
        class="mb-4"
        @keydown.enter.ctrl="submitQuery"
      />

      <div class="d-flex justify-space-between align-center mb-4">
        <v-btn
          color="primary"
          :loading="store.loading"
          :disabled="!question.trim() || !store.currentCube"
          prepend-icon="mdi-magnify"
          @click="submitQuery"
        >
          질의 실행
        </v-btn>
        <v-btn
          variant="text"
          size="small"
          :prepend-icon="showTips ? 'mdi-chevron-up' : 'mdi-lightbulb-outline'"
          @click="showTips = !showTips"
        >
          도움말
        </v-btn>
      </div>

      <!-- Tips -->
      <v-expand-transition>
        <v-alert
          v-if="showTips"
          type="info"
          variant="tonal"
          class="mb-4"
          closable
          @click:close="showTips = false"
        >
          <div class="text-subtitle-2 mb-2">질의 작성 팁</div>
          <ul class="text-body-2 pl-4">
            <li>구체적인 집계 함수를 명시하세요 (합계, 평균, 개수 등)</li>
            <li>시간 범위를 지정하면 더 정확한 결과를 얻을 수 있습니다</li>
            <li>그룹화 기준을 명확히 하세요 (월별, 사용자별 등)</li>
          </ul>
        </v-alert>
      </v-expand-transition>

      <!-- Example Queries -->
      <div class="mb-4">
        <div class="text-caption text-medium-emphasis mb-2">예시 질의</div>
        <div class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="example in exampleQueries"
            :key="example"
            size="small"
            variant="outlined"
            class="cursor-pointer"
            @click="useExample(example)"
          >
            {{ example }}
          </v-chip>
        </div>
      </div>

      <!-- Query History -->
      <div v-if="queryHistory.length > 0">
        <div class="text-caption text-medium-emphasis mb-2">최근 질의</div>
        <v-list density="compact" class="bg-transparent">
          <v-list-item
            v-for="(item, idx) in queryHistory"
            :key="idx"
            class="px-2 rounded"
            @click="useHistoryItem(item)"
          >
            <template #prepend>
              <v-icon
                :color="item.success ? 'success' : 'error'"
                size="small"
              >
                {{ item.success ? 'mdi-check-circle' : 'mdi-close-circle' }}
              </v-icon>
            </template>
            <v-list-item-title class="text-body-2">
              {{ item.question }}
            </v-list-item-title>
            <template #append>
              <span class="text-caption text-medium-emphasis">
                {{ formatTime(item.timestamp) }}
              </span>
            </template>
          </v-list-item>
        </v-list>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
