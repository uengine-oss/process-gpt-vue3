<script setup>
import { ref, nextTick, watch, computed } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { ControlButton, Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
// import { initialEdges, initialNodes } from './initial-elements.js'
import { convertProcessDefinitionToVueFlow } from './processDefinitionToVueFlow.js'
import ProcessNode from './ProcessNode.vue'
import EventNode from './EventNode.vue'
import GatewayNode from './GatewayNode.vue'
import Icon from './Icon.vue'

const props = defineProps({
  processDefinition: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['node-double-click'])

// processDefinition이 있으면 변환, 없으면 초기 데이터 사용
const flowData = computed(() => {
  try {
    if (props.processDefinition) {
      return convertProcessDefinitionToVueFlow(props.processDefinition)
    }
    // return { nodes: initialNodes, edges: initialEdges }
  } catch (error) {
    console.error('❌ flowData 계산 오류:', error)
    // return { nodes: initialNodes, edges: initialEdges }
  }
})

const nodes = ref([])
const edges = ref([])
const dark = ref(false)
const vueFlowRef = ref(null)

// flowData가 변경될 때마다 nodes와 edges 업데이트
watch(
  flowData,
  (newData) => {
    try {
      if (!newData?.nodes || !newData?.edges) {
        console.warn('⚠️ 유효하지 않은 flowData')
        return
      }

      // 깊은 복사
      nodes.value = JSON.parse(JSON.stringify(newData.nodes))
      edges.value = JSON.parse(JSON.stringify(newData.edges))

      console.log(`✅ Vue Flow 업데이트: 노드 ${nodes.value.length}개, 엣지 ${edges.value.length}개`)

      // fitView 호출
      nextTick(() => {
        nextTick(() => {
          if (vueFlowRef.value?.fitView) {
            vueFlowRef.value.fitView({ padding: 0.2, duration: 200 })
          }
        })
      })
    } catch (error) {
      console.error('❌ watch 오류:', error)
    }
  },
  { immediate: true, deep: true }
)

// 커스텀 노드 타입 등록
const nodeTypes = {
  process: ProcessNode,
  event: EventNode,
  gateway: GatewayNode,
}

// VueFlow 초기화
function onPaneReady(instance) {
  console.log('✅ Vue Flow 준비 완료')
  nextTick(() => {
    instance.fitView({ padding: 0.2 })
  })
}

// 새로운 연결 생성
function handleConnect(connection) {
  edges.value.push({
    id: `e${connection.source}-${connection.target}`,
    source: connection.source,
    target: connection.target,
  })
}

// 뷰포트 리셋
function resetTransform() {
  if (vueFlowRef.value) {
    vueFlowRef.value.setViewport({ x: 0, y: 0, zoom: 1 })
  }
}

// 다크모드 토글
function toggleDarkMode() {
  dark.value = !dark.value
}

// 데이터 로그
function logToObject() {
  console.log('Nodes:', nodes.value)
  console.log('Edges:', edges.value)
}

// 노드 더블클릭 핸들러
function handleNodeDoubleClick({ node }) {
  console.log('🖱️ 노드 더블클릭 (ProcessFlowExample):', node)
  // 노드의 데이터를 부모 컴포넌트로 전달
  emit('node-double-click', node.data)
}
</script>

<template>
  <VueFlow
    ref="vueFlowRef"
    :nodes="nodes"
    :edges="edges"
    :node-types="nodeTypes"
    :class="{ dark }"
    class="basic-flow"
    :default-viewport="{ zoom: 0.8 }"
    :min-zoom="0.2"
    :max-zoom="4"
    @pane-ready="onPaneReady"
    @connect="handleConnect"
    @node-double-click="handleNodeDoubleClick"
  >
    <Background pattern-color="#aaa" :gap="16" />
    <MiniMap />
    <Controls position="top-left">
      <ControlButton title="Reset Transform" @click="resetTransform">
        <Icon name="reset" />
      </ControlButton>
      <ControlButton title="Toggle Dark Mode" @click="toggleDarkMode">
        <Icon v-if="dark" name="sun" />
        <Icon v-else name="moon" />
      </ControlButton>
      <ControlButton title="Log Data" @click="logToObject">
        <Icon name="log" />
      </ControlButton>
    </Controls>
  </VueFlow>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
@import '@vue-flow/minimap/dist/style.css';

.basic-flow {
  height: 100%;
  min-height: 80vh;
  background-color: #f5f5f5;
}

.basic-flow.dark {
  background-color: #1a1a1a;
}

.basic-flow.dark .process-node {
  background: #2d2d2d;
  border-color: #666;
  color: #fff;
}

.basic-flow.dark .node-header {
  background: #3d3d3d;
  border-color: #666;
}

.basic-flow.dark .node-footer {
  background: #252525;
  color: #aaa;
}

/* 이벤트 노드 label 스타일 */
.basic-flow :deep(.vue-flow__node-label) {
  text-align: center;
  word-wrap: break-word;
}

/* 게이트웨이 노드 스타일 */
.basic-flow :deep(.vue-flow__node.gateway-node) {
  overflow: visible;
}
</style>
