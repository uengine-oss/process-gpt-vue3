<template>
  <div class="event-node" :class="[nodeClass, diffClass]">
    <div class="event-label">{{ data.label }}</div>
    <Handle type="target" :position="Position.Left" id="left" :style="{ opacity: 0 }" />
    <Handle type="source" :position="Position.Right" id="right-source" :style="{ right: '0px', opacity: 0 }" />
    <Handle type="target" :position="Position.Right" id="right" :style="{ right: '0px', opacity: 0 }" />
    <Handle type="source" :position="Position.Bottom" id="bottom" :style="{ opacity: 0 }" />
    <Handle type="target" :position="Position.Top" id="top" :style="{ opacity: 0 }" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const nodeClass = computed(() => props.data.type || 'intermediate-event-node')

const diffClass = computed(() => {
  if (props.data.diffType === 'added') return 'diff-added'
  if (props.data.diffType === 'deleted') return 'diff-deleted'
  if (props.data.diffType === 'modified') return 'diff-modified'
  return ''
})
</script>

<style scoped>
.event-node {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 3px solid #000;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.event-label {
  color: #000;
  font-size: 9px;
  font-weight: bold;
  text-align: center;
  padding: 2px;
  word-wrap: break-word;
  line-height: 1.1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Diff 스타일 - 추가된 노드 */
.event-node.diff-added {
  border: 3px solid #2ecc71 !important;
  box-shadow: 0 0 10px rgba(46, 204, 113, 0.5) !important;
}

/* Diff 스타일 - 삭제된 노드 */
.event-node.diff-deleted {
  border: 3px solid #e74c3c !important;
  box-shadow: 0 0 10px rgba(231, 76, 60, 0.5) !important;
}

/* Diff 스타일 - 수정된 노드 */
.event-node.diff-modified {
  border: 3px solid #2ecc71 !important;
  box-shadow: 0 0 10px rgba(46, 204, 113, 0.5) !important;
}
</style>

