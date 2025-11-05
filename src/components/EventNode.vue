<template>
  <div class="event-node" :class="nodeClass">
    <div class="event-label">{{ data.label }}</div>
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
    <Handle type="source" :position="Position.Bottom" />
    <Handle type="target" :position="Position.Top" />
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
</style>

