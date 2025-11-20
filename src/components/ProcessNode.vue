<template>
  <div class="process-node" :class="{ 'offline-node': isOffline, 'has-issue': hasIssue }">
    <!-- 이슈 있을 때 느낌표 아이콘 -->
    <div v-if="hasIssue" class="issue-indicator">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="9" fill="#ff0000" stroke="white" stroke-width="1"/>
        <text x="10" y="15.2" text-anchor="middle" font-size="14" font-weight="bold" fill="white">!</text>
      </svg>
    </div>
    
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

// 이슈가 있는지 확인
const hasIssue = computed(() => {
  const issues = props.data.issues
  return issues !== null && issues !== undefined && issues !== '' && issues.trim() !== ''
})
</script>

<style scoped>
.process-node {
  position: relative;
  background: white;
  border: 2px solid #333;
  border-radius: 4px;
  min-width: 120px;
  font-size: 12px;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

/* 이슈가 있는 액티비티 - 붉은 테두리 */
.process-node.has-issue {
  border: 4px solid #ff0000;
  box-shadow: 0 0 8px rgba(255, 0, 0, 0.3);
}

/* 이슈 표시 아이콘 (좌측 상단) */
.issue-indicator {
  position: absolute;
  top: -8px;
  left: -8px;
  z-index: 10;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
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

