<script setup lang="ts">
/**
 * Natural Query Page
 * 자연어 질의 (Text2SQL) 인터페이스
 */
import { onMounted } from 'vue'
import { useCubeStore } from '@/stores/analytics/cubeStore'
import NaturalQueryInput from '@/components/analytics/olap/NaturalQueryInput.vue'
import ResultGrid from '@/components/analytics/olap/ResultGrid.vue'

const store = useCubeStore()

onMounted(async () => {
  await store.loadCubes()
})
</script>

<template>
  <v-row class="justify-center ma-0 pa-0">
    <v-col cols="12" class="pa-0">
      <v-card elevation="10" class="is-work-height">
        <!-- Header -->
        <div class="d-flex justify-space-between align-center px-6 py-4">
          <div>
            <h1 class="text-h5 font-weight-bold">자연어 질의</h1>
            <p class="text-body-2 text-medium-emphasis mb-0">자연어로 데이터를 질의하세요 (Text2SQL)</p>
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
          </div>
        </div>
        <v-divider />

        <!-- Content -->
        <div class="pa-6" style="overflow: auto; height: calc(100vh - 200px);">
          <!-- No Cube Alert -->
          <v-alert
            v-if="store.cubes.length === 0 && !store.loading"
            type="info"
            variant="tonal"
            class="mb-4"
          >
            <v-alert-title>스키마가 필요합니다</v-alert-title>
            <div class="text-body-2">
              자연어 질의를 사용하려면 먼저 피벗 테이블에서 Mondrian XML 스키마를 업로드하세요.
            </div>
            <template #append>
              <v-btn
                variant="flat"
                color="info"
                size="small"
                to="/analytics/pivot"
              >
                피벗 테이블로 이동
              </v-btn>
            </template>
          </v-alert>

          <v-row v-if="store.cubes.length > 0">
            <!-- Query Input -->
            <v-col cols="12" md="4">
              <NaturalQueryInput />
            </v-col>

            <!-- Results -->
            <v-col cols="12" md="8">
              <ResultGrid />
            </v-col>
          </v-row>
        </div>
      </v-card>
    </v-col>
  </v-row>
</template>
