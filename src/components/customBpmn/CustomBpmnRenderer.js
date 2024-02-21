import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';

import {
  append as svgAppend,
  attr as svgAttr,
  create as svgCreate,
  remove as svgRemove
} from 'tiny-svg';

import {
  getRoundRectPath
} from 'bpmn-js/lib/draw/BpmnRenderUtil';

import { is } from 'bpmn-js/lib/util/ModelUtil';
import { isAny } from 'bpmn-js/lib/features/modeling/util/ModelingUtil';

const HIGH_PRIORITY = 1500,
      TASK_BORDER_RADIUS = 10;


export default class CustomRenderer extends BaseRenderer {
  constructor(eventBus, bpmnRenderer, canvas) {
    super(eventBus, HIGH_PRIORITY);
    this.bpmnRenderer = bpmnRenderer;
    this.canvas = canvas; // canvas를 직접 저장합니다.
  
    // 'canvas.init' 이벤트에 리스너를 등록합니다.
    eventBus.on('canvas.init', () => {
      this.addTitleToDiagram(this.canvas); // canvas를 addTitleToDiagram에 전달합니다.
    });
  }

  addTitleToDiagram(canvas) {
    // SVG 루트 요소를 가져옵니다.
    const svgRoot = canvas._svg;
  
    // 새로운 text SVG 요소를 생성합니다.
    const titleText = svgCreate('text');
    svgAttr(titleText, {
      x: '110',
      y: '110',
      'font-size': '24px',
      'font-family': 'Arial, sans-serif',
      'font-weight' : '700',
      'text-anchor': 'middle',
      fill: '#535353'
    });
    // titleText.textContent = '영업 활동 프로세스';
  
    svgAppend(svgRoot, titleText);
  }
  

  canRender(element) {
    // only render tasks and events (ignore labels)
    return isAny(element, [ 'bpmn:Task', "bpmn:Lane", "bpmn:Participant", "bpmn:SequenceFlow", "bpmn:StartEvent", "bpmn:EndEvent", "bpmn2:outgoing", "label" ]) && !element.labelTarget;
  }
  

  drawShape(parentNode, element) {
    // console.log('Rendering a Task:', parentNode, element);
    const shape = this.bpmnRenderer.drawShape(parentNode, element);
    // 각 요소별로 분리한 함수를 호출합니다.
    
    if (is(element, 'bpmn:Task')) {
      // 라벨을 찾아서 모든 'tspan' 요소에 대해 스타일을 변경합니다.
      this.drawCustomTask(parentNode, shape);
      // const tspanElements = parentNode.querySelectorAll('text.djs-label tspan');
      // tspanElements.forEach((tspan) => {
      //   svgAttr(tspan, { fill: 'red' }); // 모든 tspan 요소에 red 색상을 적용합니다.
      // });
    } else if (is(element, 'bpmn:StartEvent')) {
      this.drawCustomStartEvent(parentNode, shape);
    } else if (is(element, 'bpmn:EndEvent')) {
      this.drawCustomEndEvent(parentNode, shape);
    } else if (is(element, 'bpmn:Lane')) {
      this.drawCustomLane(parentNode, shape);
    } else if (is(element, 'bpmn:Participant')) {
      this.drawCustomParticipant(parentNode, shape);
    } else if (is(element, 'label')) {
      this.drawCustomLabel(parentNode, shape);
    }
    return shape;
  }
  

  drawCustomLane(parentNode, shape) {
    svgAttr(shape, {
      color:'red'
    });
  }

  // 스윔라인 배경 색상 및 선 색상 bpmn:Lane, (stroke : 선 색상, fill: 배경 색상)
  drawCustomLane(parentNode, shape) {
    svgAttr(shape, {
      stroke: '#4e72be',
      strokeWidth: '1',
      fill:"#f4f8fc"
    });
  }
  
  drawCustomParticipant(parentNode, shape) {
    svgAttr(shape, {
      fill: '#FFFF00',
    });
  }

  // bpmn:UserTask 관련
  drawCustomTask(parentNode, shape) {
    const rect = drawRect(parentNode, 78, 60, TASK_BORDER_RADIUS, 'none', '#fdf2d0');
    prependTo(rect, parentNode);
    svgRemove(shape);
  }

  // StartEvnet 관련
  drawCustomStartEvent(parentNode, shape) {
    const rect = drawRect(parentNode, 34, 34, 100, 'none', '#f6c745');
    prependTo(rect, parentNode);
    svgRemove(shape);
  }

  // endEvnet 관련
  drawCustomEndEvent(parentNode, shape) {
    const rect = drawRect(parentNode, 34, 34, 100, 'none', '#f6c745');
    prependTo(rect, parentNode);
    svgRemove(shape);
  }

  // 이벤트끼리의 연결선과 화살표 관련
  drawConnection(parentNode, element) {
    const connection = this.bpmnRenderer.drawConnection(parentNode, element);
  
    if (is(element, 'bpmn:SequenceFlow')) {
      const customMarkerUrl = createCustomMarker(parentNode, '#68369a'); // 화살표 색상 설정
      svgAttr(connection, {
        stroke: '#68369a', // 연결선 색상 변경
        strokeWidth: '2',
        markerEnd: customMarkerUrl // 사용자 정의 마커 적용
      });
    }
  
    return connection;
  }

  getShapePath(shape) {
    if (is(shape, 'bpmn:Task')) {
      return getRoundRectPath(shape, TASK_BORDER_RADIUS);
    }

    return this.bpmnRenderer.getShapePath(shape);
  }
}

CustomRenderer.$inject = [ 'eventBus', 'bpmnRenderer', 'canvas' ];

// 연결선에 붙은 화살표 관련
function createCustomMarker(parentNode, color) {
  const marker = svgCreate('marker');
  const path = svgCreate('path');

  svgAttr(marker, {
    id: 'custom-arrow',
    viewBox: '0 0 10 10',
    refX: '9',
    refY: '5',
    markerWidth: '6',
    markerHeight: '6',
    orient: 'auto'
  });

  svgAttr(path, {
    d: 'M 0 0 L 10 5 L 0 10 z',
    fill: color
  });

  svgAppend(marker, path);
  svgAppend(parentNode, marker);

  return 'url(#custom-arrow)';
}
// 그림자 추가
function addShadowFilter(parentNode) {
  const defs = svgCreate('defs');
  const filter = svgCreate('filter');
  const feDropShadow = svgCreate('feDropShadow');

  svgAttr(filter, {
    id: 'dropshadow',
    height: '130%'
  });

  svgAttr(feDropShadow, {
    dx: '1', // X축 오프셋
    dy: '1', // Y축 오프셋
    stdDeviation: '3', // 블러 정도
    'flood-opacity': '0.3',
  });

  svgAppend(filter, feDropShadow);
  svgAppend(defs, filter);
  svgAppend(parentNode, defs);

  return 'url(#dropshadow)';
}

// 정보, 가로길이, 세로길이, 외부 선, 선 색상, 배경 색상
function drawRect(parentNode, width, height, borderRadius, strokeColor, fillColor) {
  const rect = svgCreate('rect');
  
  // 필터를 추가하고, 필터 ID를 가져옴
  const filterId = addShadowFilter(parentNode);

  svgAttr(rect, {
    width: width,
    height: height,
    rx: borderRadius,
    ry: borderRadius,
    stroke: strokeColor || '#000',
    strokeWidth: 2,
    fill: fillColor || '#fff',
    filter: filterId, // 필터 적용
  });

  svgAppend(parentNode, rect);

  return rect;
}

// copied from https://github.com/bpmn-io/diagram-js/blob/master/lib/core/GraphicsFactory.js
function prependTo(newNode, parentNode, siblingNode) {
    parentNode.insertBefore(newNode, siblingNode || parentNode.firstChild);
}