<script setup lang="ts">
/**
 * ResultGrid - 쿼리 결과 그리드
 * 피벗 테이블 또는 플랫 테이블 형식으로 결과 표시
 */
import { ref, computed } from 'vue'
import { useCubeStore } from '@/stores/analytics/cubeStore'

const store = useCubeStore()
const showSQL = ref(false)
const viewMode = ref<'flat' | 'pivot'>('flat')

const hasResult = computed(() => {
  return store.queryResult && store.queryResult.rows && store.queryResult.rows.length > 0
})

const copySQL = () => {
  navigator.clipboard.writeText(store.generatedSQL)
}

const exportCSV = () => {
  if (!store.queryResult) return

  const { columns, rows } = store.queryResult
  const csvContent = [
    columns.join(','),
    ...rows.map(row => columns.map(col => {
      const value = row[col]
      // Escape values with commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `query_result_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}
</script>

<template>
  <v-card>
    <v-card-title class="d-flex justify-space-between align-center">
      <div class="d-flex align-center ga-2">
        <span class="text-h6">쿼리 결과</span>
        <v-chip v-if="hasResult" size="small" color="success" variant="tonal">
          {{ store.queryResult?.row_count || 0 }} 행
        </v-chip>
        <v-chip v-if="store.queryResult?.execution_time_ms" size="x-small" variant="text">
          {{ store.queryResult.execution_time_ms.toFixed(1) }}ms
        </v-chip>
      </div>
      <div class="d-flex ga-2">
        <v-btn-toggle v-model="viewMode" density="compact" variant="outlined" divided>
          <v-btn value="flat" size="small">
            <v-icon>mdi-table</v-icon>
          </v-btn>
          <v-btn value="pivot" size="small">
            <v-icon>mdi-grid</v-icon>
          </v-btn>
        </v-btn-toggle>
        <v-btn
          variant="text"
          size="small"
          :prepend-icon="showSQL ? 'mdi-eye-off' : 'mdi-code-tags'"
          @click="showSQL = !showSQL"
        >
          SQL
        </v-btn>
        <v-btn
          variant="tonal"
          size="small"
          prepend-icon="mdi-download"
          :disabled="!hasResult"
          @click="exportCSV"
        >
          CSV
        </v-btn>
      </div>
    </v-card-title>

    <v-divider />

    <!-- SQL Preview -->
    <v-expand-transition>
      <div v-if="showSQL && store.generatedSQL">
        <v-sheet color="grey-darken-4" class="pa-4">
          <div class="d-flex justify-space-between align-center mb-2">
            <span class="text-caption text-grey-lighten-1 text-uppercase">생성된 SQL</span>
            <v-btn
              variant="text"
              size="x-small"
              color="grey-lighten-1"
              prepend-icon="mdi-content-copy"
              @click="copySQL"
            >
              복사
            </v-btn>
          </div>
          <pre class="text-body-2 text-grey-lighten-2 ma-0 overflow-auto" style="max-height: 150px;"><code>{{ store.generatedSQL }}</code></pre>
        </v-sheet>
        <v-divider />
      </div>
    </v-expand-transition>

    <v-card-text class="pa-0">
      <!-- Loading -->
      <div v-if="store.loading" class="d-flex justify-center align-center pa-8">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <!-- Error -->
      <v-alert
        v-else-if="store.error"
        type="error"
        variant="tonal"
        class="ma-4"
        closable
        @click:close="store.error = null"
      >
        {{ store.error }}
      </v-alert>

      <!-- No Results -->
      <div v-else-if="!hasResult" class="text-center pa-8 text-medium-emphasis">
        <v-icon size="48" color="grey-lighten-1" class="mb-2">mdi-table-search</v-icon>
        <div class="text-body-1">쿼리를 실행하면 결과가 표시됩니다</div>
      </div>

      <!-- Results Table -->
      <div v-else class="overflow-auto" style="max-height: 500px;">
        <v-table density="compact" hover>
          <thead>
            <tr>
              <th
                v-for="col in store.queryResult?.columns"
                :key="col"
                class="text-left font-weight-bold bg-grey-lighten-4"
              >
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in store.queryResult?.rows" :key="idx">
              <td v-for="col in store.queryResult?.columns" :key="col">
                {{ row[col] }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.v-table {
  font-size: 0.875rem;
}
</style>
