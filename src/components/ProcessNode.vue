<template>
  <div class="process-node">
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
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
    <Handle type="source" :position="Position.Bottom" />
    <Handle type="target" :position="Position.Top" />
  </div>
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core'

defineProps({
  data: {
    type: Object,
    required: true,
  },
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

