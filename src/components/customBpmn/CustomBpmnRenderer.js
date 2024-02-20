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
  constructor(eventBus, bpmnRenderer) {
    super(eventBus, HIGH_PRIORITY);
    this.bpmnRenderer = bpmnRenderer;
  }

  canRender(element) {
    console.log('Rendering a Task:', element.type);
    // only render tasks and events (ignore labels)
    return isAny(element, [ 'bpmn:Task', "bpmn:Lane", "bpmn:Participant", "bpmn:SequenceFlow", "bpmn:StartEvent", "bpmn:EndEvent", "bpmn2:outgoing" ]) && !element.labelTarget;
  }
  

  drawShape(parentNode, element) {
    const shape = this.bpmnRenderer.drawShape(parentNode, element);
    
    if (is(element, 'bpmn:Task')) {
      const rect = drawRect(parentNode, 78, 60, TASK_BORDER_RADIUS, 'none');
      prependTo(rect, parentNode);
      svgRemove(shape);
    }
    if (is(element, 'bpmn:StartEvent')) {
      const rect = drawRect(parentNode, 34, 34, 100, 'none');
      prependTo(rect, parentNode);
      svgRemove(shape);
    }
    if (is(element, 'bpmn:EndEvent')) {
      const rect = drawRect(parentNode, 34, 34, 100, 'none');
      prependTo(rect, parentNode);
      svgRemove(shape);
    }
    if (is(element, 'bpmn:Lane')) {
      svgAttr(shape, {
        stroke: '#808080', // 선의 색상을 회색으로 변경합니다.
        strokeWidth: '1'
      });
    }
    if (is(element, 'bpmn:Participant')) {
      svgAttr(shape, {
        stroke: '#808080', // 선의 색상을 회색으로 변경합니다.
        strokeWidth: '1'
      });
    }
    return shape;
  }

  drawConnection(parentNode, element) {
    const connection = this.bpmnRenderer.drawConnection(parentNode, element);
  
    if (is(element, 'bpmn:SequenceFlow')) {
      const customMarkerUrl = createCustomMarker(parentNode, '#808080'); // 화살표 색상 설정
      svgAttr(connection, {
        stroke: '#808080', // 연결선 색상 변경
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

CustomRenderer.$inject = [ 'eventBus', 'bpmnRenderer' ];

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



// copied from https://github.com/bpmn-io/bpmn-js/blob/master/lib/draw/BpmnRenderer.js
function drawRect(parentNode, width, height, borderRadius, strokeColor) {
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
    fill: '#fff',
    filter: filterId, // 필터 적용
  });

  svgAppend(parentNode, rect);

  return rect;
}

// copied from https://github.com/bpmn-io/diagram-js/blob/master/lib/core/GraphicsFactory.js
function prependTo(newNode, parentNode, siblingNode) {
    parentNode.insertBefore(newNode, siblingNode || parentNode.firstChild);
}