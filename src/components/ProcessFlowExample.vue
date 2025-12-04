<script setup>
import { ref, nextTick, watch, computed } from 'vue'
import { VueFlow, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { ControlButton, Controls } from '@vue-flow/controls'
// import { initialEdges, initialNodes } from './initial-elements.js'
import { convertProcessDefinitionToVueFlow } from './processDefinitionToVueFlow.js'
import ProcessNode from './ProcessNode.vue'
import EventNode from './EventNode.vue'
import GatewayNode from './GatewayNode.vue'
import Icon from './Icon.vue'
import CustomEdge from './CustomEdge.vue'

const props = defineProps({
  processDefinition: {
    type: Object,
    default: null,
  },
  diffActivities: {
    type: Object,
    default: () => ({}),
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
const highlightedNodeId = ref(null) // 검색으로 강조된 노드 ID
const globalLabelMode = ref(false) // false: Time, true: Input/Output

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
      
      // diffActivities가 있으면 노드에 적용
      applyDiffToNodes()

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

// diffActivities가 변경되면 노드에 다시 적용
watch(
  () => props.diffActivities,
  () => {
    applyDiffToNodes()
  },
  { deep: true }
)

// diffActivities를 노드에 적용하는 함수
function applyDiffToNodes() {
  if (!props.diffActivities || Object.keys(props.diffActivities).length === 0) {
    return
  }
  
  nodes.value.forEach(node => {
    const activityId = node.data?.id
    if (activityId && props.diffActivities[activityId]) {
      const changeType = props.diffActivities[activityId]
      
      // 노드 데이터에 차이점 정보 추가
      node.data.diffType = changeType
      
      // 스타일 적용
      if (!node.style) {
        node.style = {}
      }
      
      if (changeType === 'added') {
        node.style.border = '3px solid #2ecc71'
        node.style.boxShadow = '0 0 10px rgba(46, 204, 113, 0.5)'
      } else if (changeType === 'deleted') {
        node.style.border = '3px solid #e74c3c'
        node.style.boxShadow = '0 0 10px rgba(231, 76, 60, 0.5)'
      } else if (changeType === 'modified') {
        node.style.border = '3px solid #2ecc71'
        node.style.boxShadow = '0 0 10px rgba(46, 204, 113, 0.5)'
      }
    }
  })
  
  // 엣지에도 적용
  edges.value.forEach(edge => {
    // edge id에서 원본 시퀀스 id 추출 (edge_${seq.id} 형식)
    const sequenceId = edge.id.replace('edge_', '')
    
    if (sequenceId && props.diffActivities[sequenceId]) {
      const changeType = props.diffActivities[sequenceId]
      
      if (!edge.style) {
        edge.style = {}
      }
      
      if (changeType === 'added') {
        edge.style.stroke = '#2ecc71'
        edge.style.strokeWidth = 3
        if (edge.markerEnd) {
          edge.markerEnd.color = '#2ecc71'
        }
      } else if (changeType === 'deleted') {
        edge.style.stroke = '#e74c3c'
        edge.style.strokeWidth = 3
        if (edge.markerEnd) {
          edge.markerEnd.color = '#e74c3c'
        }
      } else if (changeType === 'modified') {
        edge.style.stroke = '#2ecc71'
        edge.style.strokeWidth = 3
        if (edge.markerEnd) {
          edge.markerEnd.color = '#2ecc71'
        }
      }
    }
  })
}

// 커스텀 노드 타입 등록
const nodeTypes = {
  process: ProcessNode,
  event: EventNode,
  gateway: GatewayNode,
} 

const edgeTypes = {
  'custom-edge': CustomEdge,
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

// 엣지 클릭 핸들러
function handleEdgeClick(event) {
  console.log('🖱️ 엣지 클릭 (ProcessFlowExample):', event)
  const edge = event.edge
  if (edge) {

    if (edge.data) {
      edge.data.showInputOutput = !edge.data.showInputOutput

    }
  }
}

// 전체 엣지 라벨 모드 토글
function toggleGlobalLabelMode() {
  globalLabelMode.value = !globalLabelMode.value
  
  edges.value.forEach(edge => {
    if (!edge.data) edge.data = {}
    edge.data.showInputOutput = globalLabelMode.value
  })
  
  console.log(`🔄 전체 엣지 라벨 모드 변경: ${globalLabelMode.value ? 'Input/Output' : 'Time'}`)
}

// 액티비티 검색 및 포커스
function searchAndFocusActivity(activityName) {
  if (!activityName || activityName.trim() === '') {
    console.log('검색어가 비어있습니다.')
    // 이전 강조 제거
    if (highlightedNodeId.value) {
      const prevNode = nodes.value.find(n => n.id === highlightedNodeId.value)
      if (prevNode && prevNode.style) {
        delete prevNode.style.border
        delete prevNode.style.boxShadow
      }
      highlightedNodeId.value = null
    }
    return false
  }

  try {
    const searchTerm = activityName.toLowerCase()
    
    // 이전에 강조된 노드 초기화
    if (highlightedNodeId.value) {
      const prevNode = nodes.value.find(n => n.id === highlightedNodeId.value)
      if (prevNode && prevNode.style) {
        delete prevNode.style.border
        delete prevNode.style.boxShadow
      }
    }
    
    // 노드 검색 (content, name, label 등에서 검색)
    const matchedNode = nodes.value.find(node => {
      const content = node.data?.content || node.data?.name || node.data?.label || ''
      return content.toLowerCase().includes(searchTerm)
    })

    if (matchedNode) {
      console.log('✅ 노드를 찾았습니다:', matchedNode.data)
      
      // 노드 스타일 직접 변경
      if (!matchedNode.style) {
        matchedNode.style = {}
      }
      matchedNode.style.border = '3px solid rgb(var(--v-theme-primary))'
      matchedNode.style.borderRadius = '8px'
      matchedNode.style.boxShadow = '0 0 20px rgba(var(--v-theme-primary), 0.6)'
      highlightedNodeId.value = matchedNode.id
      
      console.log('🎨 노드 스타일 적용:', matchedNode.style)
      
      // Vue Flow 인스턴스에서 노드 포커싱
      if (vueFlowRef.value) {
        // 노드 위치로 화면 이동 (중앙 배치, 줌 1.0)
        vueFlowRef.value.setCenter(
          matchedNode.position.x + (matchedNode.dimensions?.width || 100) / 2,
          matchedNode.position.y + (matchedNode.dimensions?.height || 80) / 2,
          { zoom: 1.0, duration: 800 }
        )
        
        console.log('📍 노드 포커싱 및 강조 완료')
      }
      
      return true
    } else {
      console.log('❌ 일치하는 노드를 찾을 수 없습니다.')
      highlightedNodeId.value = null
      return false
    }
  } catch (error) {
    console.error('❌ 검색 중 오류 발생:', error)
    return false
  }
}

// 외부에서 호출 가능하도록 expose
defineExpose({
  searchAndFocusActivity
})
</script>

<template>
  <VueFlow
    ref="vueFlowRef"
    :nodes="nodes"
    :edges="edges"
    :node-types="nodeTypes"
    :edge-types="edgeTypes"
    :class="{ dark }"
    class="basic-flow"
    :default-viewport="{ zoom: 0.8 }"
    :min-zoom="0.2"
    :max-zoom="4"
    @pane-ready="onPaneReady"
    @connect="handleConnect"
    @node-double-click="handleNodeDoubleClick"
    @edge-click="handleEdgeClick"
  >
    <Background pattern-color="#aaa" :gap="16" />
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
      <ControlButton title="Toggle Edge Labels (Time <-> In/Out)" @click="toggleGlobalLabelMode">
        <Icon name="exchange" />
      </ControlButton>
    </Controls>

    <Panel position="bottom-right" class="legend-panel">
      <div class="legend-title">범례 (Legend)</div>
      
      <div class="legend-section">
        <div class="legend-subtitle">노드 (Node)</div>
        <div class="legend-item" style="align-items: center;">
          <div class="process-node-preview">
            <div class="node-header">Role</div>
            <div class="node-content">Activity</div>
            <div class="node-footer">System</div>
          </div>
        </div>
      </div>

      <div class="legend-divider"></div>

      <div class="legend-section">
        <div class="legend-subtitle">연결선 (Edge)</div>
        <div class="legend-item">
          <div class="edge-preview normal"></div>
          <span>일반 흐름 (소요시간 비례 굵기)</span>
          
        </div>
        <div class="legend-item">
          <div class="edge-preview backflow"></div>
          <span>역행 흐름 (붉은색)</span>
        </div>
      </div>
    </Panel>
  </VueFlow>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';

.basic-flow {
  height: 100%;
  width: 100%;
  background-color: #f5f5f5;
  overflow: hidden;
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

/* 범례 스타일 */
.legend-panel {
  background: rgba(255, 255, 255, 0.9);
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #eee;
  font-size: 12px;
  width: 200px;
}

.basic-flow.dark .legend-panel {
  background: #2d2d2d;
  border-color: #666;
  color: #fff;
}

.legend-title {
  font-weight: bold;
  margin-bottom: 8px;
  text-align: center;
  font-size: 13px;
}

.legend-section {
  margin-bottom: 5px;
}

.legend-subtitle {
  font-weight: 600;
  margin-bottom: 4px;
  color: #666;
  font-size: 11px;
}

.basic-flow.dark .legend-subtitle {
  color: #aaa;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.node-preview {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  border: 1px solid #333;
}

.node-preview.activity {
  display: none; /* 기존 스타일 숨김 */
}

.process-node-preview {
  background: white;
  border: 2px solid #333;
  border-radius: 4px;
  width: 80px;
  font-size: 9px;
  box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.1);
  margin-right: 4px;
}

.process-node-preview .node-header {
  padding: 2px;
  background: #f0f0f0;
  border-bottom: 1px solid #333;
  font-weight: bold;
  text-align: center;
  font-size: 8px;
}

.process-node-preview .node-content {
  padding: 4px 2px;
  border-bottom: 1px solid #333;
  text-align: center;
}

.process-node-preview .node-footer {
  padding: 2px;
  background: #f9f9f9;
  text-align: center;
  color: #666;
  font-size: 8px;
}

.node-preview.event {
  background: #fff;
  border-radius: 50%;
}

.node-preview.gateway {
  background: #fff;
  transform: rotate(45deg) scale(0.7);
}

.edge-preview {
  width: 30px;
  height: 2px;
  background: #333;
  margin-right: 8px;
  position: relative;
}

.edge-preview.normal {
  height: 4px; /* 굵기 예시 */
}

.edge-preview.backflow {
  background: #ff0000;
  height: 2px;
}

.edge-preview.backflow::after {
  content: '';
  position: absolute;
  right: 0;
  top: -3px;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 6px solid #ff0000;
}

.legend-divider {
  height: 1px;
  background: #eee;
  margin: 8px 0;
}

.basic-flow.dark .legend-divider {
  background: #444;
}

/* 다크모드 범례 스타일 */
.basic-flow.dark .process-node-preview {
  background: #2d2d2d;
  border-color: #666;
  color: #fff;
}

.basic-flow.dark .process-node-preview .node-header {
  background: #3d3d3d;
  border-color: #666;
  color: #fff;
}

.basic-flow.dark .process-node-preview .node-content {
  border-color: #666;
}

.basic-flow.dark .process-node-preview .node-footer {
  background: #252525;
  color: #aaa;
}
</style>
