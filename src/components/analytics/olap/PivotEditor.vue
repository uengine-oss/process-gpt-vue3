<script setup lang="ts">
/**
 * PivotEditor - 피벗 구성 에디터
 * 드래그앤드롭으로 행/열/측정값 구성
 */
import { ref, watch } from 'vue'
import { useCubeStore } from '@/stores/analytics/cubeStore'
import draggable from 'vuedraggable'
import FieldList from './FieldList.vue'

const store = useCubeStore()
const showSQL = ref(false)

// Auto-preview SQL when config changes
watch(
  () => store.pivotConfig,
  async () => {
    if (store.pivotConfig.rows.length || store.pivotConfig.columns.length || store.pivotConfig.measures.length) {
      await store.previewSQL()
    }
  },
  { deep: true }
)

const executeQuery = async () => {
  await store.executePivotQuery()
}

const copySQL = () => {
  navigator.clipboard.writeText(store.generatedSQL)
}
</script>

<template>
  <v-row>
    <!-- Field List Sidebar -->
    <v-col cols="3">
      <div style="max-height: calc(100vh - 200px); overflow-y: auto;">
        <FieldList />
      </div>
    </v-col>

    <!-- Pivot Configuration -->
    <v-col cols="9">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span class="text-h6">피벗 구성</span>
          <div class="d-flex ga-2">
            <v-btn
              variant="text"
              size="small"
              :prepend-icon="showSQL ? 'mdi-eye-off' : 'mdi-code-tags'"
              @click="showSQL = !showSQL"
            >
              SQL {{ showSQL ? '숨기기' : '보기' }}
            </v-btn>
            <v-btn
              variant="tonal"
              size="small"
              prepend-icon="mdi-refresh"
              @click="store.resetPivotConfig"
            >
              초기화
            </v-btn>
            <v-btn
              color="success"
              size="small"
              prepend-icon="mdi-play"
              :disabled="!store.pivotConfig.measures.length"
              :loading="store.loading"
              @click="executeQuery"
            >
              실행
            </v-btn>
          </div>
        </v-card-title>

        <v-divider />

        <v-card-text>
          <!-- Drop Zones -->
          <v-row>
            <!-- Rows -->
            <v-col cols="4">
              <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium mb-2 d-flex align-center ga-1">
                <v-icon size="small">mdi-table-row</v-icon>
                행 (Rows)
              </div>
              <draggable
                v-model="store.pivotConfig.rows"
                group="fields"
                item-key="level"
                class="drop-zone pa-3 rounded-lg"
              >
                <template #item="{ element, index }">
                  <v-chip
                    size="small"
                    color="primary"
                    variant="tonal"
                    closable
                    class="ma-1"
                    @click:close="store.removeFromRows(index)"
                  >
                    {{ element.dimension }} › {{ element.level }}
                  </v-chip>
                </template>
              </draggable>
            </v-col>

            <!-- Columns -->
            <v-col cols="4">
              <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium mb-2 d-flex align-center ga-1">
                <v-icon size="small">mdi-table-column</v-icon>
                열 (Columns)
              </div>
              <draggable
                v-model="store.pivotConfig.columns"
                group="fields"
                item-key="level"
                class="drop-zone pa-3 rounded-lg"
              >
                <template #item="{ element, index }">
                  <v-chip
                    size="small"
                    color="secondary"
                    variant="tonal"
                    closable
                    class="ma-1"
                    @click:close="store.removeFromColumns(index)"
                  >
                    {{ element.dimension }} › {{ element.level }}
                  </v-chip>
                </template>
              </draggable>
            </v-col>

            <!-- Measures -->
            <v-col cols="4">
              <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium mb-2 d-flex align-center ga-1">
                <v-icon size="small">mdi-chart-bar</v-icon>
                측정값 (Measures)
              </div>
              <draggable
                v-model="store.pivotConfig.measures"
                group="measures"
                item-key="name"
                class="drop-zone pa-3 rounded-lg"
              >
                <template #item="{ element, index }">
                  <v-chip
                    size="small"
                    color="success"
                    variant="tonal"
                    closable
                    class="ma-1"
                    @click:close="store.removeMeasure(index)"
                  >
                    {{ element.name }}
                  </v-chip>
                </template>
              </draggable>
            </v-col>
          </v-row>

          <!-- SQL Preview -->
          <v-expand-transition>
            <div v-if="showSQL && store.generatedSQL" class="mt-4">
              <v-divider class="mb-4" />
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-caption text-medium-emphasis text-uppercase font-weight-medium">
                  생성된 SQL
                </span>
                <v-btn
                  variant="text"
                  size="x-small"
                  prepend-icon="mdi-content-copy"
                  @click="copySQL"
                >
                  복사
                </v-btn>
              </div>
              <v-sheet color="grey-darken-4" rounded class="pa-4 overflow-auto" style="max-height: 200px;">
                <pre class="text-body-2 text-grey-lighten-2 ma-0"><code>{{ store.generatedSQL }}</code></pre>
              </v-sheet>
            </div>
          </v-expand-transition>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
.drop-zone {
  min-height: 120px;
  background-color: rgb(var(--v-theme-surface-variant));
  border: 2px dashed rgb(var(--v-theme-outline));
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  transition: border-color 0.2s;
}

.drop-zone:hover {
  border-color: rgb(var(--v-theme-primary));
}

.drop-zone:empty::before {
  content: '여기에 드래그';
  color: rgb(var(--v-theme-outline));
  font-size: 0.75rem;
  width: 100%;
  text-align: center;
  padding: 40px 0;
}
</style>
