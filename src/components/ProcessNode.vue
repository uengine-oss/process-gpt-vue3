<template>
  <div class="process-node" :class="{ 'offline-node': isOffline }">
    <div class="node-header">
      {{ data.header }}
    </div>
    <div class="node-content">
      {{ data.content }}
    </div>
    <div class="node-footer">
      {{ data.footer }}
    </div>
    
    <!-- Vue Flow handles 정의 -->
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

// 시스템이 off-line인지 확인
const isOffline = computed(() => {
  const footer = (props.data.footer || '').toLowerCase().trim()
  return footer === 'off-line' || footer === 'offline'
})
</script>

<style scoped>
.process-node {
  background: white;
  border: 2px solid #333;
  border-radius: 4px;
  min-width: 120px;
  font-size: 12px;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

/* off-line 시스템 스타일 - 액티비티명 부분만 붉게 표시 */
.process-node.offline-node .node-content {
  background: #ff5555;
  color: white;
  font-weight: bold;
}

.node-header {
  padding: 8px 12px;
  background: #f0f0f0;
  border-bottom: 1px solid #333;
  font-weight: bold;
  text-align: center;
}

.node-content {
  padding: 8px 12px;
  border-bottom: 1px solid #333;
  text-align: center;
  min-height: 30px;
}

.node-footer {
  padding: 6px 12px;
  background: #f9f9f9;
  text-align: center;
  font-size: 11px;
  color: #666;
}
</style>

