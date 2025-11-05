<template>
  <div class="gateway-node">
    <div class="gateway-label">{{ data.label }}</div>
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
.gateway-node {
  width: 60px;
  height: 60px;
  border: 2px solid #000;
  background: #fff;
  transform: rotate(45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.gateway-label {
  color: #333;
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
  z-index: 10;
  position: relative;
  transform: rotate(-45deg);
}
</style>

