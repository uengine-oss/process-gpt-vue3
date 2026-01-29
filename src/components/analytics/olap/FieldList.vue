<script setup lang="ts">
/**
 * FieldList - 차원과 측정값 필드 목록
 * 드래그앤드롭으로 피벗 구성에 사용
 */
import { useCubeStore } from '@/stores/analytics/cubeStore'
import draggable from 'vuedraggable'

const store = useCubeStore()

const emit = defineEmits(['dragStart'])

const handleDragStart = (item: any, type: string) => {
  emit('dragStart', { item, type })
}
</script>

<template>
  <div>
    <!-- Dimensions -->
    <v-card class="mb-4" variant="outlined">
      <v-card-title class="text-subtitle-2 text-medium-emphasis d-flex align-center ga-2 py-2">
        <v-icon size="small" color="primary">mdi-table</v-icon>
        차원 (Dimensions)
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-3">
        <div v-for="dim in store.dimensions" :key="dim.name" class="mb-3">
          <div class="text-body-2 font-weight-medium text-primary mb-2">{{ dim.name }}</div>
          <draggable
            :list="dim.levels"
            :group="{ name: 'fields', pull: 'clone', put: false }"
            item-key="name"
            :clone="(item: any) => ({ dimension: dim.name, level: item.name })"
            @start="handleDragStart($event, 'dimension')"
            class="d-flex flex-column ga-1"
          >
            <template #item="{ element }">
              <v-chip
                size="small"
                variant="tonal"
                color="grey"
                class="cursor-grab"
                prepend-icon="mdi-subdirectory-arrow-right"
              >
                {{ element.name }}
              </v-chip>
            </template>
          </draggable>
        </div>
        <div v-if="store.dimensions.length === 0" class="text-body-2 text-medium-emphasis text-center py-4">
          스키마를 업로드하세요
        </div>
      </v-card-text>
    </v-card>

    <!-- Measures -->
    <v-card variant="outlined">
      <v-card-title class="text-subtitle-2 text-medium-emphasis d-flex align-center ga-2 py-2">
        <v-icon size="small" color="success">mdi-chart-bar</v-icon>
        측정값 (Measures)
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-3">
        <draggable
          :list="store.measures"
          :group="{ name: 'measures', pull: 'clone', put: false }"
          item-key="name"
          :clone="(item: any) => ({ name: item.name })"
          class="d-flex flex-column ga-1"
        >
          <template #item="{ element }">
            <v-chip
              size="small"
              variant="tonal"
              color="success"
              class="cursor-grab"
            >
              <template #prepend>
                <span class="font-weight-bold mr-1">Σ</span>
              </template>
              {{ element.name }}
              <template #append>
                <v-chip size="x-small" variant="text" class="ml-1 text-uppercase">
                  {{ element.agg }}
                </v-chip>
              </template>
            </v-chip>
          </template>
        </draggable>
        <div v-if="store.measures.length === 0" class="text-body-2 text-medium-emphasis text-center py-4">
          스키마를 업로드하세요
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.cursor-grab {
  cursor: grab;
}
.cursor-grab:active {
  cursor: grabbing;
}
</style>
