<script setup>
import { computed } from 'vue'
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from '@vue-flow/core'

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  sourceX: {
    type: Number,
    required: true,
  },
  sourceY: {
    type: Number,
    required: true,
  },
  targetX: {
    type: Number,
    required: true,
  },
  targetY: {
    type: Number,
    required: true,
  },
  sourcePosition: {
    type: String,
    required: true,
  },
  targetPosition: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    required: false,
  },
  markerEnd: {
    type: String,
    required: false,
  },
  style: {
    type: Object,
    required: false,
  },
  selected: {
    type: Boolean,
    required: false,
  },
  label: {
    type: String,
    required: false,
  },
  input: {
    type: String,
    required: false,
  },
  output: {
    type: String,
    required: false,
  }
})

const path = computed(() => getBezierPath(props))

// 라벨 위치 계산을 위한 오프셋
const LABEL_OFFSET = 30
</script>

<template>
  <!-- 기본 엣지 렌더링 -->
  <BaseEdge :path="path[0]" :style="style" :marker-end="markerEnd" />

  <!-- 선택되었을 때만 Input/Output 라벨 표시 -->
  <EdgeLabelRenderer v-if="data?.showInputOutput">
    <!-- Output 라벨 (Source 근처) -->
    <div
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${sourceX}px, ${sourceY + LABEL_OFFSET}px)`,
        pointerEvents: 'all',
      }"
      class="nodrag nopan edge-label-custom"
    >
      Output: {{ data?.output }}
    </div>

    <!-- Input 라벨 (Target 근처) -->
    <div
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${targetX}px, ${targetY - LABEL_OFFSET}px)`,
        pointerEvents: 'all',
      }"
      class="nodrag nopan edge-label-custom"
    >
      Input: {{ data?.input }}
    </div>
  </EdgeLabelRenderer>
  
  <!-- 기존 라벨 (소요시간 등) 렌더링 - 선택되지 않았을 때만 표시 -->
  <EdgeLabelRenderer v-if="label && !data?.showInputOutput">
    <div
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)`,
        pointerEvents: 'all',
      }"
      class="nodrag nopan edge-label-default"
    >
      {{ label }}
    </div>
  </EdgeLabelRenderer>
</template>

<style scoped>
.edge-label-custom {
  background: #ffed4a;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 10;
  color: #333;
}

.edge-label-default {
  background: white;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 10px;
  border: 1px solid #ddd;
}
</style>
