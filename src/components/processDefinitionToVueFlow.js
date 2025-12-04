/**
 * 소요시간 문자열을 초 단위로 변환
 * @param {string} timeStr - "55s", "2m", "1h", "1d" 등
 * @returns {number} 초 단위 시간
 */
function parseTimeToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0

  const timeStr_lower = timeStr.toLowerCase().trim()

  // 숫자와 단위 분리
  const match = timeStr_lower.match(/^(\d+(?:\.\d+)?)\s*([smhd]?)/)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = match[2] || 's' // 기본 단위는 초

  switch (unit) {
    case 's': return value // 초
    case 'm': return value * 60 // 분
    case 'h': return value * 3600 // 시간
    case 'd': return value * 86400 // 일
    default: return value
  }
}

/**
 * 소요시간에 따라 선 굵기와 화살표 크기 계산
 * @param {string} requiredTime - 소요시간 문자열
 * @returns {Object} { strokeWidth, markerSize }
 */
function calculateStrokeWidthByTime(requiredTime) {
  const seconds = parseTimeToSeconds(requiredTime)

  // 설정값
  const MIN_WIDTH = 2 // 최소 굵기
  const MAX_WIDTH = 10 // 최대 굵기 (더 굵게)
  const MIN_MARKER = 11 // 최소 화살표 크기
  const MAX_MARKER = 24 // 최대 화살표 크기 (더 크게)

  // 시간 구간별 기준값 (초 단위)
  const TIME_RANGES = {
    SECOND: 60,        // 1분 = 60초
    MINUTE: 3600,      // 1시간 = 3600초
    HOUR: 86400,       // 1일 = 86400초
    DAY: 604800        // 7일 = 604800초 (최대 기준)
  }

  if (seconds <= 0) {
    return { strokeWidth: MIN_WIDTH, markerSize: MIN_MARKER }
  }

  let ratio = 0

  // 구간별로 다른 증가율 적용
  if (seconds <= TIME_RANGES.SECOND) {
    // 초 단위 (0~60초): 0~0.1 비율 (가장 얇게)
    ratio = (seconds / TIME_RANGES.SECOND) * 0.1
  } else if (seconds <= TIME_RANGES.MINUTE) {
    // 분 단위 (1분~1시간): 0.1~0.2 비율
    const progress = (seconds - TIME_RANGES.SECOND) / (TIME_RANGES.MINUTE - TIME_RANGES.SECOND)
    ratio = 0.1 + progress * 0.1
  } else if (seconds <= TIME_RANGES.HOUR) {
    // 시간 단위 (1시간~1일): 0.2~0.3 비율
    const progress = (seconds - TIME_RANGES.MINUTE) / (TIME_RANGES.HOUR - TIME_RANGES.MINUTE)
    ratio = 0.2 + progress * 0.1
  } else if (seconds <= TIME_RANGES.DAY) {
    // 일 단위 (1일~7일): 0.3~0.4 비율 (가장 굵게)
    const progress = (seconds - TIME_RANGES.HOUR) / (TIME_RANGES.DAY - TIME_RANGES.HOUR)
    ratio = 0.3 + progress * 0.1
  } else {
    // 7일 이상: 최대값
    ratio = 0.5
  }

  // 굵기 계산
  const strokeWidth = MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * ratio
  const markerSize = MIN_MARKER + (MAX_MARKER - MIN_MARKER) * ratio

  return {
    strokeWidth: Math.round(strokeWidth * 10) / 10, // 소수점 1자리
    markerSize: Math.round(markerSize)
  }
}

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

    // Sequences를 먼저 추출 (액티비티에 연결된 시퀀스 정보를 찾기 위해)
    let sequences = []
    if (hasElementsStructure) {
      if (processDefinition.sequences) {
        sequences = processDefinition.sequences
      } else {
        sequences = processDefinition.elements.filter(el => el.elementType === 'Sequence')
      }
    } else if (processDefinition.sequences) {
      sequences = processDefinition.sequences
    }

    // 1. Activities 변환
    let activities = []
    if (hasElementsStructure) {
      if (processDefinition.activities) {
        activities = processDefinition.activities
      } else {
        activities = processDefinition.elements.filter(el => el.elementType === 'Activity')
      }
    } else if (processDefinition.activities) {
      activities = processDefinition.activities
    }

    let inputs = {}
    let outputs = {}
    activities.forEach((activity, index) => {
      const nodeId = `activity_${activity.id || index}`
      nodeIdMap.set(activity.id, nodeId)

      // 이 액티비티로 들어오는 시퀀스 찾기 (target이 이 액티비티)
      const incomingSequence = sequences.find(seq =>
        (seq.target === activity.id || seq.targetRef === activity.id)
      )
      console.log(activity);
      let input = activity?.inputData || ''
      let output = activity?.outputData || ''
      // tool 정보에서 시스템 추출 (formHandler:xxx 형식)
      inputs[nodeId] = input
      outputs[nodeId] = output
      let systemName = 'on-line'
      if (activity.system) {
        systemName = activity.system
      } else if (activity.tool && activity.tool.includes(':')) {
        const toolParts = activity.tool.split(':')
        systemName = toolParts[1] || 'on-line'
      }

      nodes.push({
        id: nodeId,
        type: 'process',
        position: { x: 0, y: 0 },
        data: {
          id: activity.id, // 원본 ID 추가
          header: activity.role || '역할',
          content: activity.name || `Activity ${index + 1}`,
          footer: systemName, // system 필드 또는 tool에서 추출
          requiredTime: incomingSequence?.requiredTime || '', // 들어오는 시퀀스의 소요시간
          incomingSequenceId: incomingSequence?.id || null, // 들어오는 시퀀스 ID
          description: activity.description || '', // 설명 추가
          issues: activity.issues || '', // 이슈 추가
          // backflowSequenceId와 backflowRequiredTime은 레이아웃 단계에서 추가됨
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
    sequences.forEach((seq, index) => {
      // source/sourceRef, target/targetRef 처리
      const sourceOriginalId = seq.source || seq.sourceRef
      const targetOriginalId = seq.target || seq.targetRef

      const sourceId = nodeIdMap.get(sourceOriginalId)
      const targetId = nodeIdMap.get(targetOriginalId)

      if (sourceId && targetId) {
        // 소요시간에 따른 선 굵기 계산
        const { strokeWidth, markerSize } = calculateStrokeWidthByTime(seq.requiredTime)

        if (seq.requiredTime) {
          console.log(`⏱️ ${seq.requiredTime} → 굵기: ${strokeWidth}px, 화살표: ${markerSize}px`)
        }

        const inputData = Array.isArray(inputs[sourceId]) ? inputs[sourceId].join(', ') : inputs[sourceId]
        const outputData = Array.isArray(outputs[targetId]) ? outputs[targetId].join(', ') : outputs[targetId]
        console.log(inputData, outputData)
        edges.push({
          id: `edge_${seq.id || index}`,
          source: sourceId,
          target: targetId,
          sourceHandle: 'bottom', // 일반 흐름: 아래에서 출발
          targetHandle: 'top',     // 일반 흐름: 위로 도착
          type: 'custom-edge', // 커스텀 엣지 사용
          label: seq.requiredTime || '', // 선 중간에 표시
          data: { ...seq, input: inputData, output: outputData }, // 클릭 이벤트 처리를 위한 데이터 추가
          style: { stroke: '#333', strokeWidth: strokeWidth, cursor: 'pointer' }, // 커서 스타일 추가
          markerEnd: {
            type: 'arrowclosed',
            width: markerSize,
            height: markerSize,
            color: '#333',
          },
        })

      }
    })

    console.log(`✅ 변환 완료: 노드 ${nodes.length}개, 엣지 ${edges.length}개`)

    // 레이아웃 적용 (역행 정보 포함)
    layoutNodesInSequenceOrder(nodes, edges, sequences)

    return { nodes, edges }
  } catch (error) {
    console.error('❌ 변환 오류:', error)
    return { nodes: [], edges: [] }
  }
}

/**
 * 시퀀스 순서대로 노드를 세로로 배치
 */
function layoutNodesInSequenceOrder(nodes, edges, sequences) {
  if (!nodes.length) return

  console.log('=== 레이아웃 시작 ===')

  // 노드 맵
  const nodeMap = new Map()
  nodes.forEach(node => nodeMap.set(node.id, node))

  // 엣지 ID로 원본 시퀀스를 찾기 위한 맵
  const edgeToSequenceMap = new Map()
  edges.forEach((edge, index) => {
    // edge.id는 `edge_${seq.id || index}` 형식
    const seqId = edge.id.replace('edge_', '')
    // seq.id로 찾거나, 인덱스로 직접 매핑
    const sequence = sequences.find(seq => seq.id === seqId) || sequences[index]
    if (sequence) {
      edgeToSequenceMap.set(edge.id, sequence)
      console.log(`📌 Edge-Sequence 매핑: ${edge.id} -> ${sequence.id || `index_${index}`}`)
    }
  })

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

  // 레벨 기반 BFS로 방문 순서 기록 (같은 레벨의 노드들은 같은 order 부여)
  const visitOrder = new Map() // nodeId -> 레벨(순서) 번호
  const visited = new Set()
  let currentLevel = [startNodes.map(n => n.id)] // 레벨별로 노드 ID 배열
  let levelNumber = 0

  // 시작 노드들에 레벨 0 부여
  startNodes.forEach(node => {
    visitOrder.set(node.id, levelNumber)
    visited.add(node.id)
  })

  // 레벨 기반 BFS
  while (currentLevel[levelNumber] && currentLevel[levelNumber].length > 0) {
    const nextLevel = []

    // 현재 레벨의 모든 노드 처리
    currentLevel[levelNumber].forEach(currentId => {
      const neighbors = adjacencyList.get(currentId) || []

      neighbors.forEach(neighborId => {
        // 아직 방문하지 않았고, 모든 부모가 처리되었는지 확인
        if (!visited.has(neighborId)) {
          // 이 노드의 모든 부모(inEdge의 source)가 이미 방문되었는지 확인
          const allParents = edges
            .filter(e => e.target === neighborId)
            .map(e => e.source)

          const allParentsVisited = allParents.every(parentId => visited.has(parentId))

          if (allParentsVisited) {
            visitOrder.set(neighborId, levelNumber + 1)
            visited.add(neighborId)
            nextLevel.push(neighborId)
          }
        }
      })
    })

    // 다음 레벨로 이동
    if (nextLevel.length > 0) {
      levelNumber++
      currentLevel[levelNumber] = [...new Set(nextLevel)] // 중복 제거
    } else {
      break
    }
  }

  // 방문하지 못한 노드 처리 (고립된 노드 등)
  nodes.forEach(node => {
    if (!visitOrder.has(node.id)) {
      levelNumber++
      visitOrder.set(node.id, levelNumber)
    }
  })

  console.log('방문 순서 (레벨 기반):', Object.fromEntries(visitOrder))

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
  const BASE_HORIZONTAL_SPACING = 200 // 기본 가로 간격을 넓게

  // 부모-자식 관계 맵 구축
  const parentMap = new Map() // childId -> [parentId1, parentId2, ...]
  const childrenMap = new Map() // parentId -> [childId1, childId2, ...]

  edges.forEach(edge => {
    // 역행 엣지는 제외 (역행이 아닌 정방향만 부모-자식 관계로 간주)
    const sourceOrder = visitOrder.get(edge.source)
    const targetOrder = visitOrder.get(edge.target)
    if (sourceOrder < targetOrder) { // 정방향만
      if (!childrenMap.has(edge.source)) {
        childrenMap.set(edge.source, [])
      }
      childrenMap.get(edge.source).push(edge.target)

      if (!parentMap.has(edge.target)) {
        parentMap.set(edge.target, [])
      }
      parentMap.get(edge.target).push(edge.source)
    }
  })

  Array.from(orderGroups.keys()).sort((a, b) => a - b).forEach(order => {
    const nodesInOrder = orderGroups.get(order)
    const y = START_Y + order * VERTICAL_SPACING

    console.log(`📊 레벨 ${order}: ${nodesInOrder.length}개 노드 -`, nodesInOrder.map(n => n.data.content || n.data.label))

    if (nodesInOrder.length === 1) {
      // 단일 노드: 부모 위치 또는 중앙에 배치
      const node = nodesInOrder[0]
      const parents = parentMap.get(node.id) || []

      if (parents.length > 0) {
        // 부모들의 평균 x 위치
        const avgParentX = parents.reduce((sum, parentId) => {
          const parent = nodeMap.get(parentId)
          return sum + (parent?.position?.x || START_X)
        }, 0) / parents.length
        node.position.x = avgParentX
      } else {
        node.position.x = START_X
      }
      node.position.y = y
    } else {
      // 여러 노드: 부모를 기준으로 좌우 분산 배치
      const parents = new Set()
      nodesInOrder.forEach(node => {
        const nodeParents = parentMap.get(node.id) || []
        nodeParents.forEach(p => parents.add(p))
      })

      let centerX = START_X
      if (parents.size > 0) {
        // 부모들의 평균 위치를 중심으로
        centerX = Array.from(parents).reduce((sum, parentId) => {
          const parent = nodeMap.get(parentId)
          return sum + (parent?.position?.x || START_X)
        }, 0) / parents.size
      }

      // 분기되는 노드 수에 따라 간격 조정 (2개부터 넓게)
      const spacing = BASE_HORIZONTAL_SPACING * Math.max(1, nodesInOrder.length / 2)
      const totalWidth = (nodesInOrder.length - 1) * spacing

      console.log(`  ↔️ 분기 배치: ${nodesInOrder.length}개 노드, 간격 ${spacing}px, 총 너비 ${totalWidth}px, 중심 X=${centerX}`)

      nodesInOrder.forEach((node, index) => {
        // 중앙을 기준으로 좌우 분산
        const x = centerX - totalWidth / 2 + index * spacing
        node.position.x = x
        node.position.y = y
        console.log(`    - ${node.data.content || node.data.label}: x=${x}`)
      })
    }
  })

  // 역행 엣지 표시 (색상 변경 + 연결 방향 변경 + 노드에 역행 정보 추가)
  edges.forEach(edge => {
    const sourceOrder = visitOrder.get(edge.source)
    const targetOrder = visitOrder.get(edge.target)

    // source가 target보다 나중에 방문되었으면 역행
    if (sourceOrder > targetOrder) {
      // 기존 굵기는 유지하고 색상만 빨간색으로 변경
      edge.style.stroke = '#ff0000'
      edge.markerEnd.color = '#ff0000'

      // 연결 방향 변경: 오른쪽에서 출발 → 오른쪽으로 도착
      edge.sourceHandle = 'right-source'  // 출발: 오른쪽
      edge.targetHandle = 'right'          // 도착: 오른쪽

      // 원본 시퀀스 정보 찾기
      const sequence = edgeToSequenceMap.get(edge.id)

      // source 노드(출발 노드)에 역행 시퀀스 정보 추가
      const sourceNode = nodeMap.get(edge.source)
      if (sourceNode && sequence) {
        sourceNode.data.backflowSequenceId = sequence.id
        sourceNode.data.backflowRequiredTime = sequence.requiredTime || ''
        console.log(`🔴 역행 시퀀스 추가: ${edge.source} (${sourceNode.data.content || sourceNode.data.label}) -> 시퀀스 ID: ${sequence.id}, 소요시간: ${sequence.requiredTime || '없음'}`)
      } else {
        console.warn(`⚠️ 역행 시퀀스를 찾지 못함: edge ${edge.id}, sourceNode: ${!!sourceNode}, sequence: ${!!sequence}`)
      }

      console.log(`🔴 역행: ${edge.source}(순서${sourceOrder}) -> ${edge.target}(순서${targetOrder}) [right→right]`)
    }
  })

  console.log('=== 레이아웃 완료 ===')
}
