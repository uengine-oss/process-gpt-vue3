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

    // only render tasks and events (ignore labels)
    return isAny(element, [ 'bpmn:Task' ]) && !element.labelTarget;
  }
  

  drawShape(parentNode, element) {
    const shape = this.bpmnRenderer.drawShape(parentNode, element);

    if (is(element, 'bpmn:Task')) {
      const rect = drawRect(parentNode, 78, 60, TASK_BORDER_RADIUS, 'none');
      prependTo(rect, parentNode);
      svgRemove(shape);
    }
    return shape;
  }

  getShapePath(shape) {
    if (is(shape, 'bpmn:Task')) {
      return getRoundRectPath(shape, TASK_BORDER_RADIUS);
    }

    return this.bpmnRenderer.getShapePath(shape);
  }
}

CustomRenderer.$inject = [ 'eventBus', 'bpmnRenderer' ];

// helpers //////////

// SVG에 필터를 추가하는 함수
function addShadowFilter(parentNode) {
  const defs = svgCreate('defs');
  const filter = svgCreate('filter');
  const feDropShadow = svgCreate('feDropShadow');

  svgAttr(filter, {
    id: 'dropshadow',
    height: '130%'
  });

  svgAttr(feDropShadow, {
    dx: '2', // X축 오프셋
    dy: '2', // Y축 오프셋
    stdDeviation: '5', // 블러 정도
    'flood-opacity': '0.3',
    'border-radius': '10%'
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