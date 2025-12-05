/**
 * BPMN 자동 레이아웃 V2 (SubProcess 전용)
 *
 * - 기존 `bpmn-auto-layout.js` 의 스기야마 레이아웃을 그대로 사용하되,
 *   전체 프로세스가 아니라 **각 SubProcess 내부만 독립적인 \"가상 Participant\" 처럼**
 *   따로 레이아웃해서 그 결과를 SubProcess 자식 노드와 컨테이너 박스에 적용한다.
 *
 * - 최상위 프로세스(풀/레인) 위치는 그대로 두고,
 *   SubProcess 내부 구조만 자동 정렬하고 크기를 맞추는 용도로 사용한다.
 */

(function(global) {
  const BpmnAutoLayoutV2 = {};

  // V1 과 동일한 유효 노드 타입 집합
  const VALID_NODE_TYPES = [
    'bpmn:Task', 'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask', 'bpmn:BusinessRuleTask',
    'bpmn:SendTask', 'bpmn:ReceiveTask', 'bpmn:ManualTask',
    'bpmn:StartEvent', 'bpmn:EndEvent', 'bpmn:IntermediateThrowEvent', 'bpmn:IntermediateCatchEvent',
    'bpmn:ExclusiveGateway', 'bpmn:ParallelGateway', 'bpmn:InclusiveGateway', 'bpmn:EventBasedGateway',
    'bpmn:SubProcess', 'bpmn:CallActivity'
  ];

  function getTypeLabel(elementType) {
    const typeMap = {
      'bpmn:Task': '작업',
      'bpmn:UserTask': '사용자 작업',
      'bpmn:ServiceTask': '서비스 작업',
      'bpmn:SendTask': '전송 작업',
      'bpmn:ReceiveTask': '수신 작업',
      'bpmn:ManualTask': '수동 작업',
      'bpmn:BusinessRuleTask': '업무 규칙 작업',
      'bpmn:ScriptTask': '스크립트 작업',
      'bpmn:StartEvent': '시작 이벤트',
      'bpmn:EndEvent': '종료 이벤트',
      'bpmn:IntermediateThrowEvent': '중간 이벤트(발생)',
      'bpmn:IntermediateCatchEvent': '중간 이벤트(수신)',
      'bpmn:ExclusiveGateway': '배타 게이트웨이',
      'bpmn:ParallelGateway': '병렬 게이트웨이',
      'bpmn:InclusiveGateway': '포괄 게이트웨이',
      'bpmn:EventBasedGateway': '이벤트 기반 게이트웨이',
      'bpmn:SubProcess': '서브프로세스',
      'bpmn:Participant': '참여자',
      'bpmn:Lane': '레인',
      'bpmn:TextAnnotation': '텍스트 주석',
      'bpmn:DataObjectReference': '데이터 객체',
      'bpmn:DataStoreReference': '데이터 저장소'
    };

    return typeMap[elementType] || elementType.replace('bpmn:', '');
  }

  /**
   * el 의 가장 가까운 상위 SubProcess ID 를 찾는다.
   * 없으면 null.
   */
  function getNearestSubProcessId(el) {
    let p = el && el.parent;
    while (p) {
      if (p.businessObject && p.businessObject.$type === 'bpmn:SubProcess') {
        return p.id;
      }
      p = p.parent;
    }
    return null;
  }

  /**
   * 요소의 중심점이 Lane 내부에 있는지 위치 기반으로 판별
   */
  function isElementInLane(element, lane) {
    if (!element || !lane) return false;
    if (typeof element.x !== 'number' || typeof element.y !== 'number' ||
        typeof element.width !== 'number' || typeof element.height !== 'number') {
      return false;
    }
    if (typeof lane.x !== 'number' || typeof lane.y !== 'number' ||
        typeof lane.width !== 'number' || typeof lane.height !== 'number') {
      return false;
    }

    const elementMidX = element.x + element.width / 2;
    const elementMidY = element.y + element.height / 2;

    return (
      elementMidX >= lane.x &&
      elementMidX <= lane.x + lane.width &&
      elementMidY >= lane.y &&
      elementMidY <= lane.y + lane.height
    );
  }

  /**
   * 하나의 SubProcess 내부만 독립적으로 레이아웃
   * - SubProcess 자식 노드들을 Graph 로 구성하고,
   *   lane 이 없는 단일 그룹으로 묶어서 EnhancedSugiyamaLayout 을 실행한다.
   * - 결과 좌표를 BPMN 요소에 적용하고, bounding box 기반으로 SubProcess 박스를 리사이즈한다.
   */
  function layoutSingleSubProcess(bpmnModeler, subProcessElement, options) {
    const { horizontal = false } = options || {};
    const elementRegistry = bpmnModeler.get('elementRegistry');
    const modeling = bpmnModeler.get('modeling');
    const { Graph } = global.GraphAlgorithm || {};
    const EnhancedSugiyamaLayout = global.EnhancedSugiyamaLayout;

    if (!Graph || !EnhancedSugiyamaLayout) {
      console.warn('[V2] GraphAlgorithm 또는 EnhancedSugiyamaLayout 이 없습니다.');
      return;
    }

    const all = elementRegistry.getAll();

    // 서브프로세스 위치는 상위 다이어그램 레이아웃(V1)에서 다시 잡을 것이므로,
    // 내부 레이아웃/리사이즈 과정에서는 "중심 좌표"만 유지하고 크기만 바꾸도록 한다.
    const originalSpX = subProcessElement.x || 0;
    const originalSpY = subProcessElement.y || 0;
    const originalSpW = subProcessElement.width || 0;
    const originalSpH = subProcessElement.height || 0;
    const originalCenter = {
      x: originalSpX + originalSpW / 2,
      y: originalSpY + originalSpH / 2
    };

    // 이 SubProcess 의 \"직접적인\" 내부 노드들만 선택
    const internalNodes = all.filter(el => {
      if (!el.businessObject || el.labelTarget) return false;
      if (!VALID_NODE_TYPES.includes(el.businessObject.$type)) return false;
      const nearest = getNearestSubProcessId(el);
      return nearest === subProcessElement.id;
    });

    if (!internalNodes.length) return;

    const internalNodeIdSet = new Set(internalNodes.map(el => el.id));

    // 내부 노드들 사이의 SequenceFlow 만 대상
    const internalFlows = all.filter(el => {
      const bo = el.businessObject;
      if (!bo || bo.$type !== 'bpmn:SequenceFlow') return false;
      if (!el.source || !el.target) return false;
      return internalNodeIdSet.has(el.source.id) && internalNodeIdSet.has(el.target.id);
    });

    const graph = new Graph();
    const nodeMap = {};

    // 노드 추가
    internalNodes.forEach(element => {
      const bo = element.businessObject;
      const id = element.id;
      const type = getTypeLabel(bo.$type);
      const label = bo.name || type;

      graph.addNode(id, label);
      const node = graph.getNode(id);

      let nodeWidth = element.width || 100;
      let nodeHeight = element.height || 80;
      // V1 과 동일하게, 가로 스윔레인 모드에서는 그래프 쪽에는 width/height 를 반대로 넣어준다.
      if (horizontal) {
        const tmp = nodeWidth;
        nodeWidth = nodeHeight;
        nodeHeight = tmp;
      }

      node.width = nodeWidth;
      node.height = nodeHeight;
      node.nodeType = bo.$type;

      nodeMap[id] = element;
    });

    // 단일 그룹 생성 (Lane 이 없는 가상 레인 역할)
    // SubProcess 와 실제로 Y 범위가 겹치는 Lane 들을 찾는다.
    const lanes = all.filter(el =>
      el.businessObject && el.businessObject.$type === 'bpmn:Lane'
    );

    const spTop = subProcessElement.y;
    const spBottom = spTop + subProcessElement.height;

    const overlappedLanes = lanes.filter(lane => {
      if (typeof lane.y !== 'number' || typeof lane.height !== 'number') return false;
      const top = lane.y;
      const bottom = lane.y + lane.height;
      // Y 구간이 조금이라도 겹치면 \"걸쳐있는\" 것으로 본다.
      return bottom > spTop && top < spBottom;
    });

    // 바깥 V1 레이아웃에서 사용할 수 있도록, 서브프로세스 BO 에 겹치는 레인 ID 를 저장
    if (subProcessElement.businessObject) {
      subProcessElement.businessObject.__v2OverlappedLaneIds =
        overlappedLanes.map(lane => lane.id);
    }

    // 레인별로 내부 노드 그룹을 만들고, 해당 레인 ID 를 가상의 레인(그룹)으로 사용
    const assignedNodeIds = new Set();

    overlappedLanes.forEach(lane => {
      const laneNodeIds = internalNodes
        .filter(node => isElementInLane(node, lane))
        .map(node => node.id);

      if (laneNodeIds.length) {
        graph.createGroup(lane.id, laneNodeIds);
        laneNodeIds.forEach(id => assignedNodeIds.add(id));
      }
    });

    // 어떤 Lane 에도 포함되지 않은 내부 노드는, 서브프로세스 ID 를 가진 가상 레인으로 묶는다.
    const unassignedIds = internalNodes
      .map(n => n.id)
      .filter(id => !assignedNodeIds.has(id));

    if (unassignedIds.length) {
      graph.createGroup(subProcessElement.id, unassignedIds);
    }

    // 엣지 추가
    internalFlows.forEach(flow => {
      if (!nodeMap[flow.source.id] || !nodeMap[flow.target.id]) return;
      graph.addEdge(flow.source.id, flow.target.id);
    });

    // 레이아웃 실행
    const layout = new EnhancedSugiyamaLayout(graph, horizontal);
    layout.run();

    // 노드 위치를 BPMN 요소에 반영
    graph.nodes.forEach(node => {
      const element = nodeMap[node.id];
      if (!element) return;

      const width = element.width || 100;
      const height = element.height || 80;

      const newX = node.x - width / 2;
      const newY = node.y - height / 2;

      const dx = newX - element.x;
      const dy = newY - element.y;

      if (!isFinite(dx) || !isFinite(dy) || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) {
        return;
      }

      try {
        modeling.moveShape(element, { x: dx, y: dy });
      } catch (err) {
        console.warn(`[V2] SubProcess 내부 요소 ${element.id} 이동 중 오류:`, err);
      }
    });

    // 내부 노드 기준으로 SubProcess bounding box 계산
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    internalNodes.forEach(el => {
      if (typeof el.x !== 'number' || typeof el.y !== 'number' ||
          typeof el.width !== 'number' || typeof el.height !== 'number') {
        return;
      }
      const left = el.x;
      const right = el.x + el.width;
      const top = el.y;
      const bottom = el.y + el.height;

      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    });

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
      return;
    }

    const marginX = 30;
    const marginY = 20;

    const x = minX - marginX;
    const y = minY - marginY;
    const width = (maxX - minX) + marginX * 2;
    const height = (maxY - minY) + marginY * 2;

    try {
      // 1차로 내부 노드 기준 bounding box 에 맞춰 리사이즈
      modeling.resizeShape(subProcessElement, { x, y, width, height });

      // 리사이즈 이후, 서브프로세스 중심을 "원래 중심"으로 되돌려서
      // 상위 다이어그램 레이아웃이 참조하는 위치가 변하지 않도록 한다.
      const newSpX = subProcessElement.x || x;
      const newSpY = subProcessElement.y || y;
      const newSpW = subProcessElement.width || width;
      const newSpH = subProcessElement.height || height;
      const newCenter = {
        x: newSpX + newSpW / 2,
        y: newSpY + newSpH / 2
      };

      const dx = originalCenter.x - newCenter.x;
      const dy = originalCenter.y - newCenter.y;

      if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
        try {
          modeling.moveShape(subProcessElement, { x: dx, y: dy });
        } catch (moveErr) {
          console.warn(`[V2] SubProcess ${subProcessElement.id} 중심 복원(move) 중 오류:`, moveErr);
        }
      }
    } catch (err) {
      console.warn(`[V2] SubProcess ${subProcessElement.id} 리사이즈 중 오류:`, err);
    }
  }

  /**
   * 레이아웃(V1 + V2) 이 모두 끝난 후 라벨들을 적절한 위치로 정렬하는 헬퍼.
   * - Shape 라벨: 노드 중앙 하단, 또는 Lane/Participant 는 좌측 중앙
   * - SequenceFlow 라벨: 경로 중간 지점
   */
  // 시퀀스 플로우 라벨이 선과 겹치지 않도록,
  // 경로 중간에서 법선 방향으로 적당히 떨어진 위치를 계산한다.
  function computeFlowLabelCenterAvoidingLine(waypoints, lw, lh) {
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return null;
    }

    const midIndex = Math.floor((waypoints.length - 1) / 2);
    const p1 = waypoints[midIndex];
    const p2 = waypoints[midIndex + 1] || p1;

    const baseCenterX = (p1.x + p2.x) / 2;
    const baseCenterY = (p1.y + p2.y) / 2;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    // 길이가 0 이면 수평 선으로 가정
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // 선분의 법선 벡터 (nx, ny)
    let nx = -dy / len;
    let ny = dx / len;

    // 너무 수평/수직에 가까운 경우에도 항상 "위쪽"으로 올리도록 보정
    if (Math.abs(ny) < 0.1 && Math.abs(nx) < 0.1) {
      nx = 0;
      ny = -1;
    }

    // 라벨 크기를 고려한 최소 거리(라벨 반지름 + 여유)
    const halfExtent = Math.max(lw || 0, lh || 0) / 2;
    const threshold = 8 + halfExtent; // 선과의 최소 거리

    // center 가 polyline 에 너무 가까운지 판단하는 헬퍼 (점-선분 거리 기반)
    const isTooClose = (cx, cy) => {
      for (let i = 0; i < waypoints.length - 1; i++) {
        const s1 = waypoints[i];
        const s2 = waypoints[i + 1];
        const vx = s2.x - s1.x;
        const vy = s2.y - s1.y;
        const segLen2 = vx * vx + vy * vy || 1;

        // 점에서 선분까지의 거리
        let t = ((cx - s1.x) * vx + (cy - s1.y) * vy) / segLen2;
        t = Math.max(0, Math.min(1, t));
        const px = s1.x + vx * t;
        const py = s1.y + vy * t;

        const dist = Math.sqrt((cx - px) * (cx - px) + (cy - py) * (cy - py));
        if (dist < threshold) return true;
      }
      return false;
    };

    const baseX = baseCenterX;
    const baseY = baseCenterY;

    const maxOffset = 40;
    const step = 5;

    // 양쪽 방향(n, -n)을 모두 시도하여, 선에서 충분히 떨어진 첫 지점을 선택
    const dirs = [1, -1];
    for (let d = 0; d < dirs.length; d++) {
      const sign = dirs[d];
      for (let off = 0; off <= maxOffset; off += step) {
        const cx = baseX + nx * off * sign;
        const cy = baseY + ny * off * sign;
        if (!isTooClose(cx, cy)) {
          return { x: cx, y: cy };
        }
      }
    }

    // 적절한 위치를 찾지 못하면 기본 중앙점을 반환
    return { x: baseCenterX, y: baseCenterY };
  }

  function adjustLabelsAfterLayoutV2(bpmnModeler) {
    if (!bpmnModeler) return;

    const elementRegistry = bpmnModeler.get('elementRegistry');
    const modeling = bpmnModeler.get('modeling');

    if (!elementRegistry || !modeling) return;

    const elements = elementRegistry.getAll();
    if (!elements || !elements.length) return;

    // 1) 노드(Shape) 라벨 정렬
    elements.forEach(el => {
      if (!el || !el.businessObject || el.waypoints) return; // 연결선은 제외
      if (!el.labels || el.labels.length === 0) return;
      if (
        typeof el.x !== 'number' ||
        typeof el.y !== 'number' ||
        typeof el.width !== 'number' ||
        typeof el.height !== 'number'
      ) {
        return;
      }

      const boType = el.businessObject.$type || '';

      el.labels.forEach(label => {
        if (!label || typeof label.x !== 'number' || typeof label.y !== 'number') return;

        const lw = label.width || 0;
        const lh = label.height || 0;

        let centerX = el.x + el.width / 2;
        let centerY;

        if (boType === 'bpmn:Lane') {
          // 레인 라벨: 좌측 중앙
          centerX = el.x + 20;
          centerY = el.y + el.height / 2;
        } else if (boType === 'bpmn:Participant') {
          // 풀 라벨: 좌측 중앙 (여유를 조금 더 줌)
          centerX = el.x + 40;
          centerY = el.y + el.height / 2;
        } else {
          // 일반 노드 라벨: 노드 중앙 하단
          centerY = el.y + el.height + 20;
        }

        const newX = centerX - lw / 2;
        const newY = centerY - lh / 2;
        const dx = newX - label.x;
        const dy = newY - label.y;

        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

        try {
          console.log('[V2][label-adjust][shape]', {
            elementId: el.id,
            labelId: label.id,
            boType,
            from: { x: label.x, y: label.y },
            to: { x: newX, y: newY }
          });
          modeling.moveShape(label, { x: dx, y: dy });
        } catch (e) {
          console.warn(`[V2] 라벨 ${label.id} 위치 조정 중 오류:`, e);
        }
      });
    });

    // 2) SequenceFlow 라벨 정렬 (선과 겹치지 않도록 법선 방향으로 살짝 오프셋)
    elements.forEach(conn => {
      if (
        !conn ||
        !conn.businessObject ||
        conn.businessObject.$type !== 'bpmn:SequenceFlow'
      ) {
        return;
      }

      const waypoints = conn.waypoints;
      if (!Array.isArray(waypoints) || waypoints.length < 2) return;

      const label =
        conn.label ||
        (Array.isArray(conn.labels) && conn.labels.length > 0 ? conn.labels[0] : null);

      if (!label || typeof label.x !== 'number' || typeof label.y !== 'number') return;

      const lw = label.width || 0;
      const lh = label.height || 0;

      const center = computeFlowLabelCenterAvoidingLine(waypoints, lw, lh);
      if (!center) return;

      const centerX = center.x;
      const centerY = center.y;

      const newX = centerX - lw / 2;
      const newY = centerY - lh / 2;
      const dx = newX - label.x;
      const dy = newY - label.y;

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

      try {
        console.log('[V2][label-adjust][flow]', {
          flowId: conn.id,
          labelId: label.id,
          from: { x: label.x, y: label.y },
          to: { x: newX, y: newY }
        });
        modeling.moveShape(label, { x: dx, y: dy });
      } catch (e) {
        console.warn(`[V2] 시퀀스 플로우 라벨 ${label.id} 위치 조정 중 오류:`, e);
      }
    });
  }

  /**
   * 전체 다이어그램에서 모든 SubProcess 내부를 순회하면서
   * 각 SubProcess 를 \"가상 Participant\" 처럼 따로 레이아웃한다.
   * - 최상위 다이어그램의 Task/Event 등은 움직이지 않는다.
   */
  BpmnAutoLayoutV2.applyAutoLayout = function(bpmnModeler, options = {}, onLoadStart = () => {}, onLoadEnd = () => {}) {
    const { horizontal = false } = options;
    onLoadStart();

    // V1 과 동일하게 전역 플래그 유지
    window.isHorizontalLayout = horizontal;

    if (!bpmnModeler) {
      throw new Error('BPMN 모델러가 제공되지 않았습니다.');
    }

    try {
      const elementRegistry = bpmnModeler.get('elementRegistry');
      const all = elementRegistry.getAll();

      const subProcesses = all.filter(el =>
        el.businessObject && el.businessObject.$type === 'bpmn:SubProcess'
      );

      // SubProcess 가 하나도 없으면, V2 는 관여할 부분이 없으므로
      // 그대로 V1 기본 자동 레이아웃만 한 번 수행한다.
      if (!subProcesses.length) {
        console.info('[V2] SubProcess 가 없어 V1 기본 자동 레이아웃만 수행합니다.');

        if (global.BpmnAutoLayout) {
          try {
            global.BpmnAutoLayout.applyAutoLayout(
              bpmnModeler,
              { horizontal },
              () => {},
              () => {}
            );
          } catch (e) {
            console.error('[V2] V1 기본 자동 레이아웃 실행 중 오류:', e);
          }
        }

        // 전체 레이아웃이 끝난 뒤 라벨 위치를 정리
        adjustLabelsAfterLayoutV2(bpmnModeler);
        return;
      }

      // 부모 체인 깊이 기준으로 가장 안쪽 SubProcess 부터 처리
      const withDepth = subProcesses.map(sp => {
        let depth = 0;
        let p = sp.parent;
        while (p) {
          if (p.businessObject && p.businessObject.$type === 'bpmn:SubProcess') depth++;
          p = p.parent;
        }
        return { element: sp, depth };
      });

      withDepth.sort((a, b) => b.depth - a.depth);

      withDepth.forEach(({ element: sp }) => {
        layoutSingleSubProcess(bpmnModeler, sp, { horizontal });
      });

      // --- 2단계: 서브프로세스를 하나의 노드처럼 취급하여, 전체 다이어그램을 V1으로 재배치 ---
      if (global.BpmnAutoLayout) {
        // V1 자동 레이아웃에 전달할 요소 필터를 전역 훅으로 잠깐 등록한다.
        // - SubProcess 컨테이너 자신은 포함
        // - 어떤 SubProcess 의 자식(또는 그 하위)인 요소는 제외
        const prevFilter = global.__bpmnAutoLayoutFilterElements;
        global.__bpmnAutoLayoutFilterElements = function(el) {
          if (!el || !el.businessObject) return true;
          const bo = el.businessObject;

          // SubProcess 도형 자체는 항상 포함 (하나의 노드로 간주)
          if (bo.$type === 'bpmn:SubProcess') return true;

          // 가장 가까운 상위 SubProcess 가 있으면, 그 내부 자식이므로 V1 대상에서 제외
          const nearestSpId = getNearestSubProcessId(el);
          if (nearestSpId) return false;

          return true;
        };

        try {
          global.BpmnAutoLayout.applyAutoLayout(
            bpmnModeler,
            { horizontal },
            () => {},
            () => {}
          );
        } finally {
          // 훅 복원
          global.__bpmnAutoLayoutFilterElements = prevFilter;
        }
      }

      // V1/V2 전체 레이아웃 및 모든 waypoints 처리가 끝난 뒤,
      // 다이어그램 전체에 대해 라벨 위치를 정리한다.
      adjustLabelsAfterLayoutV2(bpmnModeler);
    } catch (error) {
      console.error('[V2] SubProcess 전용 자동 레이아웃 적용 중 오류:', error);
      throw error;
    } finally {
      onLoadEnd();
    }
  };

  global.BpmnAutoLayoutV2 = BpmnAutoLayoutV2;

})(typeof window !== 'undefined' ? window : this);


