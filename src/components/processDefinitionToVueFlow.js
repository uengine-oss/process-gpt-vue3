/**
 * 프로세스 정의를 Vue Flow 형식으로 변환
 */
export function convertProcessDefinitionToVueFlow(processDefinition) {
  try {
    if (!processDefinition) {
      return { nodes: [], edges: [] }
    }

    const nodes = []
    const edges = []
    const nodeIdMap = new Map() // 원본 ID -> Vue Flow ID

    // Elements 구조 확인
    const hasElementsStructure = processDefinition.elements && Array.isArray(processDefinition.elements)

    // 1. Activities 변환
    let activities = []
    if (hasElementsStructure) {
      activities = processDefinition.elements.filter(el => el.elementType === 'Activity')
    } else if (processDefinition.activities) {
      activities = processDefinition.activities
    }

    activities.forEach((activity, index) => {
      const nodeId = `activity_${activity.id || index}`
      nodeIdMap.set(activity.id, nodeId)

      nodes.push({
        id: nodeId,
        type: 'process',
        position: { x: 0, y: 0 },
        data: {
          header: activity.role || '역할',
          content: activity.name || `Activity ${index + 1}`,
          footer: activity.type || 'Activity',
        },
        style: { width: 150, height: 80 },
      })
    })

    // 2. Events 변환
    let events = []
    if (hasElementsStructure) {
      events = processDefinition.elements.filter(el => el.elementType === 'Event')
    } else if (processDefinition.events) {
      events = processDefinition.events
    }

    events.forEach((event, index) => {
      const nodeId = `event_${event.id || index}`
      nodeIdMap.set(event.id, nodeId)

      const bpmnType = (event.bpmnType || '').toLowerCase()
      const isStart = bpmnType.includes('start')
      const isEnd = bpmnType.includes('end')

      nodes.push({
        id: nodeId,
        type: 'event',
        position: { x: 0, y: 0 },
        data: {
          label: event.name || `Event ${index + 1}`,
          type: isStart ? 'start-event-node' : isEnd ? 'end-event-node' : 'intermediate-event-node',
        },
        style: { width: 50, height: 50 },
      })
    })

    // 3. Gateways 변환
    let gateways = []
    if (hasElementsStructure) {
      gateways = processDefinition.elements.filter(el => el.elementType === 'Gateway')
    } else if (processDefinition.gateways) {
      gateways = processDefinition.gateways
    }

    gateways.forEach((gateway, index) => {
      const nodeId = `gateway_${gateway.id || index}`
      nodeIdMap.set(gateway.id, nodeId)

      nodes.push({
        id: nodeId,
        type: 'gateway',
        position: { x: 0, y: 0 },
        data: {
          label: gateway.name || `Gateway ${index + 1}`,
        },
        style: { width: 80, height: 80 },
      })
    })

    // 4. Sequences 변환 (source, target, sourceRef, targetRef 모두 처리)
    let sequences = []
    if (hasElementsStructure) {
      sequences = processDefinition.elements.filter(el => el.elementType === 'Sequence')
    } else if (processDefinition.sequences) {
      sequences = processDefinition.sequences
    }

    sequences.forEach((seq, index) => {
      // source/sourceRef, target/targetRef 처리
      const sourceOriginalId = seq.source || seq.sourceRef
      const targetOriginalId = seq.target || seq.targetRef
      
      const sourceId = nodeIdMap.get(sourceOriginalId)
      const targetId = nodeIdMap.get(targetOriginalId)

      if (sourceId && targetId) {
        edges.push({
          id: `edge_${seq.id || index}`,
          source: sourceId,
          target: targetId,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'step',
          label: seq.name || '',
          style: { stroke: '#333', strokeWidth: 2 },
        })
      }
    })

    console.log(`✅ 변환 완료: 노드 ${nodes.length}개, 엣지 ${edges.length}개`)

    // 레이아웃 적용
    layoutNodesInSequenceOrder(nodes, edges)

    return { nodes, edges }
  } catch (error) {
    console.error('❌ 변환 오류:', error)
    return { nodes: [], edges: [] }
  }
}

/**
 * 시퀀스 순서대로 노드를 세로로 배치
 */
function layoutNodesInSequenceOrder(nodes, edges) {
  if (!nodes.length) return

  console.log('=== 레이아웃 시작 ===')

  // 노드 맵
  const nodeMap = new Map()
  nodes.forEach(node => nodeMap.set(node.id, node))

  // 인접 리스트 구축
  const adjacencyList = new Map()
  const inDegree = new Map()

  nodes.forEach(node => {
    adjacencyList.set(node.id, [])
    inDegree.set(node.id, 0)
  })

  edges.forEach(edge => {
    adjacencyList.get(edge.source).push(edge.target)
    inDegree.set(edge.target, inDegree.get(edge.target) + 1)
  })

  // 시작 노드 찾기: start-event 타입 우선, 없으면 inDegree 0
  let startNodes = nodes.filter(n => 
    n.type === 'event' && 
    n.data.type === 'start-event-node' &&
    inDegree.get(n.id) === 0
  )

  if (startNodes.length === 0) {
    startNodes = nodes.filter(n => inDegree.get(n.id) === 0)
  }

  console.log('시작 노드:', startNodes.map(n => n.id))

  // BFS로 방문 순서 기록
  const visitOrder = new Map() // nodeId -> 방문 순서 번호
  const queue = []
  let orderCounter = 0

  startNodes.forEach(node => {
    queue.push(node.id)
    visitOrder.set(node.id, orderCounter++)
  })

  const visited = new Set()

  while (queue.length > 0) {
    const currentId = queue.shift()
    
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const neighbors = adjacencyList.get(currentId) || []
    neighbors.forEach(neighborId => {
      if (!visitOrder.has(neighborId)) {
        visitOrder.set(neighborId, orderCounter++)
        queue.push(neighborId)
      }
    })
  }

  // 방문하지 못한 노드 처리
  nodes.forEach(node => {
    if (!visitOrder.has(node.id)) {
      visitOrder.set(node.id, orderCounter++)
    }
  })

  console.log('방문 순서:', Object.fromEntries(visitOrder))

  // 순서별로 노드 그룹화
  const orderGroups = new Map()
  nodes.forEach(node => {
    const order = visitOrder.get(node.id)
    if (!orderGroups.has(order)) {
      orderGroups.set(order, [])
    }
    orderGroups.get(order).push(node)
  })

  // 위에서 아래로 배치 (세로 정렬)
  const START_X = 400
  const START_Y = 50
  const VERTICAL_SPACING = 150
  const HORIZONTAL_SPACING = 80

  Array.from(orderGroups.keys()).sort((a, b) => a - b).forEach(order => {
    const nodesInOrder = orderGroups.get(order)
    const y = START_Y + order * VERTICAL_SPACING

    // 같은 순서의 노드들은 가로로 나열 (중앙 정렬)
    nodesInOrder.forEach((node, index) => {
      const totalWidth = nodesInOrder.length * HORIZONTAL_SPACING
      const x = START_X - totalWidth / 2 + index * HORIZONTAL_SPACING
      
      node.position.x = x
      node.position.y = y
    })
  })

  // 역행 엣지 표시
  edges.forEach(edge => {
    const sourceOrder = visitOrder.get(edge.source)
    const targetOrder = visitOrder.get(edge.target)

    // source가 target보다 나중에 방문되었으면 역행
    if (sourceOrder > targetOrder) {
      edge.style = { stroke: '#ff0000', strokeWidth: 3 }
      console.log(`🔴 역행: ${edge.source}(순서${sourceOrder}) -> ${edge.target}(순서${targetOrder})`)
    } else {
      edge.style = { stroke: '#333', strokeWidth: 2 }
    }
  })

  console.log('=== 레이아웃 완료 ===')
}
