/**
 * BPMN 자동 레이아웃 모듈
 * 기존 script.js 파일에서 분리된 자동 레이아웃 로직
 */

(function(global) {
  // 전역 네임스페이스
  const BpmnAutoLayout = {};

  /**
   * BPMN 다이어그램에 자동 레이아웃 적용
   * @param {BpmnJS} bpmnModeler - BPMN-JS 모델러 인스턴스
   * @param {Object} options - 레이아웃 옵션
   * @param {boolean} options.horizontal - 가로 방향 레이아웃 사용 여부
   */
  BpmnAutoLayout.applyAutoLayout = function(bpmnModeler, options = {}) {
    const { horizontal = false } = options;
    
    // 가로 모드 여부를 전역 변수로 설정하여 다른 클래스/함수에서도 참조 가능하게 함
    window.isHorizontalLayout = horizontal;
    
    if (!bpmnModeler) {
      throw new Error('BPMN 모델러가 제공되지 않았습니다.');
    }

    try {
      // 그래프 객체 초기화
      const { Graph } = window.GraphAlgorithm;
      // 외부 파일로 분리된 EnhancedSugiyamaLayout 클래스 참조
      const EnhancedSugiyamaLayout = window.EnhancedSugiyamaLayout; 
      const graph = new Graph();
      
      // BPMN 모델에서 요소 가져오기
      const elements = bpmnModeler.get('elementRegistry').getAll();
      
      // 서브프로세스가 있으면 깨지는 문제가 있어 서브프로세스가 있을 경우에는 임시 비활성화
      let isSubprocessImported = false;
      elements.forEach(element => {
        if(element.type === "bpmn:SubProcess") {
          isSubprocessImported = true;
        }
      });
      if(isSubprocessImported) {
        return;
      }
      // 노드 맵 생성 (빠른 참조를 위함)
      const nodeMap = {};
      
      // 실제 노드 목록 (Task, Event, Gateway 등)
      const validNodeTypes = [
        'bpmn:Task', 'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask', 'bpmn:BusinessRuleTask',
        'bpmn:SendTask', 'bpmn:ReceiveTask', 'bpmn:ManualTask',
        'bpmn:StartEvent', 'bpmn:EndEvent', 'bpmn:IntermediateThrowEvent', 'bpmn:IntermediateCatchEvent',
        'bpmn:ExclusiveGateway', 'bpmn:ParallelGateway', 'bpmn:InclusiveGateway', 'bpmn:EventBasedGateway',
        'bpmn:SubProcess', 'bpmn:CallActivity'
      ];
      
      // 요소 유형에 따른 레이블 가져오기
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
      
      // 먼저 노드 추가 (실제 도형 요소만)
      elements.forEach(element => {
        // 연결선(Flow)은 제외하고 실제 노드만 추가
        if (element.businessObject && 
            element.businessObject.$type && 
            !element.labelTarget && 
            validNodeTypes.includes(element.businessObject.$type)) {
          
          // 레이블 제외, 실제 요소만 처리
          const id = element.id;
          const type = getTypeLabel(element.businessObject.$type);
          const label = element.businessObject.name || type;
          
          // 그래프에 노드 추가하고 실제 크기 설정
          graph.addNode(id, label);
          const node = graph.getNode(id);
          node.width = element.width || 100;
          node.height = element.height || 80;
          
          // 노드 타입 저장 (게이트웨이 여부 확인용)
          node.nodeType = element.businessObject.$type;
          
          // 노드 맵에 저장
          nodeMap[id] = element;
        }
      });
      
      // 엣지 추가 (연결선 - SequenceFlow만)
      elements.forEach(element => {
        if (element.businessObject && 
            element.businessObject.$type === 'bpmn:SequenceFlow' && 
            element.source && 
            element.target && 
            nodeMap[element.source.id] && 
            nodeMap[element.target.id]) {
          
          graph.addEdge(element.source.id, element.target.id);
        }
      });
      
      // 그룹화 처리 (서브프로세스나 풀/레인 등이 있는 경우)
      let groupId = 0;
      const participantsWithLanes = new Set(); // lane이 있는 participant 추적

      // 1. 먼저 어떤 participant가 lane을 가지고 있는지 확인
      elements.forEach(element => {
        if (element.businessObject && element.businessObject.$type === 'bpmn:Lane') {
          if (element.parent && element.parent.businessObject && 
              element.parent.businessObject.$type === 'bpmn:Participant') {
            participantsWithLanes.add(element.parent.id);
          }
        }
      });


      function sortGroupsAndOrder(graph, elements) {
        // 1. groupOrder 정렬
        graph.groupOrder.sort((a, b) => {
          const elA = elements.find(el => el.id === a);
          const elB = elements.find(el => el.id === b);
          if (!elA || !elB) return 0;
          if (horizontal) {
            return elA.y - elB.y;
          } else {
            return elA.x - elB.x;
          }
        });
      
        // 2. groups 배열도 groupOrder 순서에 맞게 재정렬
        graph.groups = graph.groupOrder
          .map(id => graph.groups.find(g => g.id === id))
          .filter(Boolean); // 혹시 없는 id는 제거
      }
      // 2. 그룹화 처리 진행
      elements.forEach(element => {
        if (element.businessObject && element.businessObject.$type) {
          // 서브프로세스 처리
          if (element.businessObject.$type === 'bpmn:SubProcess') {
            const childElements = [];
            elements.forEach(child => {
              if (child.parent && child.parent.id === element.id && 
                  child.businessObject && !child.labelTarget) {
                childElements.push(child.id);
              }
            });
            
            if (childElements.length > 0) {
              // 그룹 ID로 요소의 ID 사용
              graph.createGroup(element.id, childElements);
            }
          }
          // 레인 처리 - participant 안에 레인이 있는 경우
          else if (element.businessObject.$type === 'bpmn:Lane') {
            // 레인 안에 있는 요소 찾기
            const childElements = [];
            
            // 방법 1: 좌표 기반 확인
            elements.forEach(child => {
              if (child.id !== element.id && child.businessObject && 
                  !child.labelTarget && isElementInLane(child, element)) {
                childElements.push(child.id);
              }
            });
            
            // 방법 2: flowNodeRef 사용 (있는 경우)
            if (element.businessObject.flowNodeRef) {
              element.businessObject.flowNodeRef.forEach(ref => {
                const childElement = elements.find(el => 
                  el.businessObject && el.businessObject.id === ref.id
                );
                if (childElement && !childElements.includes(childElement.id)) {
                  childElements.push(childElement.id);
                }
              });
            }
            
            if (childElements.length > 0) {
              // 그룹 ID로 레인의 ID 사용
              graph.createGroup(element.id, childElements);
            }
          }
          // Participant 처리 - lane이 없는 경우에만 그룹화
          else if (element.businessObject.$type === 'bpmn:Participant' && 
                   !participantsWithLanes.has(element.id)) {
            const childElements = [];
            
            elements.forEach(child => {
              if (child.parent && child.parent.id === element.id && 
                  child.businessObject && !child.labelTarget) {
                childElements.push(child.id);
              }
            });
            
            if (childElements.length > 0) {
              // 그룹 ID로 참여자의 ID 사용
              graph.createGroup(element.id, childElements);
            }
          }
        }
      });

      sortGroupsAndOrder(graph, elements);

      // Lane 내부 요소 확인 helper 함수
      function isElementInLane(element, lane) {
        // 요소나 레인에 경계가 없는 경우 처리
        if (!element || !lane) return false;
        
        // 요소의 중심점이 레인 내부에 있는지 확인
        const elementMidX = element.x + element.width / 2;
        const elementMidY = element.y + element.height / 2;
        
        return (
          elementMidX >= lane.x &&
          elementMidX <= lane.x + lane.width &&
          elementMidY >= lane.y &&
          elementMidY <= lane.y + lane.height
        );
      }
      
      // 확장된 Sugiyama 레이아웃 적용
      const layout = new EnhancedSugiyamaLayout(graph, horizontal);
      layout.run();
      
      // 모델러의 캔버스와 변환 모듈 가져오기
      const canvas = bpmnModeler.get('canvas');
      const modeling = bpmnModeler.get('modeling');
      const connectionDocking = bpmnModeler.get('connectionDocking');
      
      // 계산된 위치로 요소 이동
      graph.nodes.forEach(node => {
        const element = nodeMap[node.id];
        if (element) {
          // 요소 위치 업데이트 (중앙점을 기준으로)
          const newPosition = {
            x: node.x - element.width / 2,
            y: node.y - element.height / 2
          };
          
          // 좌표값 유효성 검사
          const dx = newPosition.x - element.x;
          const dy = newPosition.y - element.y;
          
          // 무한대나 NaN 값이 아닌지 확인
          if (!isFinite(dx) || !isFinite(dy) || isNaN(dx) || isNaN(dy)) {
            console.warn(`요소 ${element.id} 이동에 유효하지 않은 좌표가 있습니다:`, dx, dy);
            return; // 이 요소는 건너뜀
          }
          
          // 0이 아닌 이동만 적용 (최소 1px 이상 차이날 때만 적용)
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            return; // 거의 이동이 없는 경우 건너뜀
          }
          
          // element가 Root이고 children 배열이 있는 경우 처리
          if (!element.waypoints) {
            let elementToMove = element;
            
            // Root 요소인 경우, 실제 shape를 찾아서 이동시킴
            if (element.labels && element.children) {
              // 실제 shape 요소를 찾아 이동시킴
              const childrenWithShape = element.children.filter(child => 
                child.type && !child.waypoints && child.type.includes('bpmn:'));
                
              if (childrenWithShape.length > 0) {
                elementToMove = childrenWithShape[0];
              }
            }
            
            // 유효한 shape이고 이동 가능한지 확인
            if (elementToMove && elementToMove.id && typeof elementToMove.x === 'number') {
              try {
                modeling.moveShape(elementToMove, {
                  x: dx,
                  y: dy
                });
                
                // 라벨 요소가 있는 경우 함께 이동
                if (element.labels && element.labels.length > 0) {
                  element.labels.forEach(label => {
                    if (label && label.id && typeof label.x === 'number') {
                      try {
                        modeling.moveShape(label, {
                          x: dx,
                          y: dy
                        });
                      } catch (labelErr) {
                        console.warn(`라벨 ${label.id} 이동 중 오류:`, labelErr);
                      }
                    }
                  });
                }
              } catch (err) {
                console.warn(`요소 ${elementToMove.id} 이동 중 오류:`, err);
              }
            }
          }
        }
      });

      const participantChildrenMap = {};

      // 1. 참가자 → 레인 관계 구성
      graph.groups.forEach(group => {
        const element = elements.find(e => e.id === group.id);
        if (!element) return;
        
        if (element.type === 'bpmn:Lane' && element.parent?.type === 'bpmn:Participant') {
          const parentId = element.parent.id;
          if (!participantChildrenMap[parentId]) {
            participantChildrenMap[parentId] = [];
          }
          participantChildrenMap[parentId].push(group.id);
        }
      });

      // 2. 레인 우선 크기 조정
      graph.groups.forEach(group => {
        const element = elements.find(el => el.id === group.id);
        if (!element || element.type === 'bpmn:Participant') return;

        const minX = group.minX ?? Infinity;
        const maxX = group.maxX ?? -Infinity;
        const minY = group.minY ?? Infinity;
        const maxY = group.maxY ?? -Infinity;

        const margin = 0;
        
        // 가로 배치 모드인 경우 x, y 값 교환 고려
        if (horizontal) {
          modeling.resizeShape(element, {
            x: minY - margin, // x에 minY 사용
            y: minX - margin, // y에 minX 사용
            width: maxY - minY + margin * 2, // width에 y 차이 사용
            height: maxX - minX + margin * 2 // height에 x 차이 사용
          });
        } else {
          modeling.resizeShape(element, {
            x: minX - margin,
            y: minY - margin,
            width: maxX - minX + margin * 2,
            height: maxY - minY + margin * 2
          });
        }
      });

      // 3. 참가자(Pool) 크기 조정 - 자식 레인의 합으로 계산
      Object.entries(participantChildrenMap).forEach(([participantId, laneIds]) => {
        const laneBounds = laneIds
          .map(id => graph.getGroup(id))
          .filter(Boolean);

        if (laneBounds.length === 0) return;

        let minX = Math.min(...laneBounds.map(g => g.minX));
        let maxX = Math.max(...laneBounds.map(g => g.maxX));
        let minY = Math.min(...laneBounds.map(g => g.minY));
        let maxY = Math.max(...laneBounds.map(g => g.maxY));

        const margin = 0;
        const participantElement = elements.find(el => el.id === participantId);
        if (participantElement) {
          if(participantElement.type === 'bpmn:Participant') {
            // 가로 배치 모드에서는 레이블을 위한 공간을 다르게 조정
            minY = minY - 30; // 가로 모드에서는 왼쪽에 여유 공간
          }
          
          // 가로 배치 모드인 경우 x, y 값 교환 고려
          if (horizontal) {
            modeling.resizeShape(participantElement, {
              x: minY - margin, // x에 minY 사용
              y: minX - margin, // y에 minX 사용
              width: maxY - minY + margin * 2, // width에 y 차이 사용
              height: maxX - minX + margin * 2 // height에 x 차이 사용
            });
          } else {
            modeling.resizeShape(participantElement, {
              x: minX - margin,
              y: minY - margin,
              width: maxX - minX + margin * 2,
              height: maxY - minY + margin * 2
            });
          }
        }
      });

      // waypoints 적용 함수 호출
      applyGraphWaypointsToBpmnModeler(graph, bpmnModeler);
    } catch (error) {
      console.error('자동 레이아웃 적용 중 오류가 발생했습니다:', error);
      throw error;
    }
  };

  /**
   * 개선된 waypoints를 BPMN 모델에 적용하는 유틸리티 함수
   * @param {Object} graph - 레이아웃이 적용된 그래프 객체 
   * @param {BpmnJS} bpmnModeler - BPMN-JS 모델러 인스턴스
   */
  function applyGraphWaypointsToBpmnModeler(graph, bpmnModeler) {
    const modeling = bpmnModeler.get('modeling');
    const elementRegistry = bpmnModeler.get('elementRegistry');

    if (!graph || !graph.edges || graph.edges.length === 0) return;

    graph.edges.forEach(edge => {
      const source = graph.getNode(edge.source);
      const target = graph.getNode(edge.target);
      const waypoints = edge.waypoints;

      if (!source || !target || !Array.isArray(waypoints) || waypoints.length < 2) return;

      const connectionElement = elementRegistry.filter(el => {
        return (
          el.businessObject &&
          el.businessObject.$type === 'bpmn:SequenceFlow' &&
          el.source && el.target &&
          el.source.id === source.id &&
          el.target.id === target.id
        );
      })[0];

      if (!connectionElement) return;

      try {
        modeling.updateWaypoints(connectionElement, waypoints);
      } catch (err) {
        console.warn(`연결선(${source.id} -> ${target.id}) waypoints 적용 실패`, err);
      }
    });

    console.log('[BPMN] waypoints 적용 완료');
  }

  // 글로벌 객체에 추가
  global.BpmnAutoLayout = BpmnAutoLayout;

})(typeof window !== 'undefined' ? window : this); 