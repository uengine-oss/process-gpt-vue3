<script setup lang="ts">
/**
 * PivotTable Page
 * 다차원 데이터 분석을 위한 피벗 테이블
 */
import { onMounted, ref } from 'vue'
import { useCubeStore } from '@/stores/analytics/cubeStore'
import PivotEditor from '@/components/analytics/olap/PivotEditor.vue'
import ResultGrid from '@/components/analytics/olap/ResultGrid.vue'

const store = useCubeStore()
const schemaDialog = ref(false)
const schemaXml = ref('')
const tab = ref('file')

onMounted(async () => {
  await store.loadCubes()
})

const handleSchemaUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    await store.uploadSchema(input.files[0])
    schemaDialog.value = false
  }
}

const handleSchemaTextUpload = async () => {
  if (schemaXml.value.trim()) {
    await store.uploadSchemaText(schemaXml.value)
    schemaDialog.value = false
    schemaXml.value = ''
  }
}
</script>

<template>
  <v-row class="justify-center ma-0 pa-0">
    <v-col cols="12" class="pa-0">
      <v-card elevation="10" class="is-work-height">
        <!-- Header -->
        <div class="d-flex justify-space-between align-center px-6 py-4">
          <div>
            <h1 class="text-h5 font-weight-bold">피벗 테이블</h1>
            <p class="text-body-2 text-medium-emphasis mb-0">다차원 데이터 분석</p>
          </div>
          <div class="d-flex ga-2 align-center">
            <!-- Cube Selector -->
            <v-select
              v-if="store.cubes.length > 0"
              v-model="store.currentCube"
              :items="store.cubes"
              label="큐브 선택"
              variant="outlined"
              density="compact"
              hide-details
              style="min-width: 180px;"
              @update:model-value="store.selectCube($event)"
            />
            <v-btn
              variant="text"
              prepend-icon="mdi-upload"
              @click="schemaDialog = true"
            >
              스키마 업로드
            </v-btn>
          </div>
        </div>
        <v-divider />

        <!-- Content -->
        <div class="pa-6" style="overflow: auto; height: calc(100vh - 200px);">
          <!-- No Schema Alert -->
          <v-alert
            v-if="store.cubes.length === 0 && !store.loading"
            type="info"
            variant="tonal"
            class="mb-4"
          >
            <v-alert-title>스키마가 필요합니다</v-alert-title>
            <div class="text-body-2">
              피벗 테이블을 사용하려면 먼저 Mondrian XML 스키마를 업로드하세요.
            </div>
            <template #append>
              <v-btn
                variant="flat"
                color="info"
                size="small"
                @click="schemaDialog = true"
              >
                스키마 업로드
              </v-btn>
            </template>
          </v-alert>

          <!-- Pivot Editor -->
          <div v-if="store.cubes.length > 0" class="mb-4">
            <PivotEditor />
          </div>

          <!-- Results -->
          <ResultGrid v-if="store.queryResult" />
        </div>

        <!-- Schema Upload Dialog -->
        <v-dialog v-model="schemaDialog" max-width="600">
          <v-card>
            <v-card-title class="d-flex justify-space-between align-center">
              <span>스키마 업로드</span>
              <v-btn icon variant="text" @click="schemaDialog = false">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </v-card-title>
            <v-divider />
            <v-card-text>
              <v-tabs v-model="tab" class="mb-4">
                <v-tab value="file">파일 업로드</v-tab>
                <v-tab value="text">XML 직접 입력</v-tab>
              </v-tabs>

              <v-window v-model="tab">
                <v-window-item value="file">
                  <v-file-input
                    label="Mondrian XML 스키마"
                    accept=".xml"
                    variant="outlined"
                    prepend-icon="mdi-file-xml-box"
                    @change="handleSchemaUpload"
                  />
                </v-window-item>
                <v-window-item value="text">
                  <v-textarea
                    v-model="schemaXml"
                    label="XML 스키마"
                    placeholder="<?xml version='1.0' encoding='UTF-8'?>..."
                    variant="outlined"
                    rows="10"
                    class="mb-4"
                  />
                  <v-btn
                    color="primary"
                    :disabled="!schemaXml.trim()"
                    :loading="store.loading"
                    @click="handleSchemaTextUpload"
                  >
                    업로드
                  </v-btn>
                </v-window-item>
              </v-window>
            </v-card-text>
          </v-card>
        </v-dialog>
      </v-card>
    </v-col>
  </v-row>
</template>
