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
  TASK_BORDER_RADIUS = 10,
  ERROR_COLOR = '#e53935',
  WARNING_COLOR = '#FFA500',
  WARNING = 0,
  ERROR = 1;


export default class CustomBpmnRenderer extends BaseRenderer {
  constructor(eventBus, bpmnRenderer, canvas, options, elementRegistry, graphicsFactory) {
    super(eventBus, HIGH_PRIORITY);
    this.bpmnRenderer = bpmnRenderer;
    this.canvas = canvas; // canvas를 직접 저장합니다.
    this.elementRegistry = elementRegistry;
    this.graphicsFactory = graphicsFactory;

    this.invalidationList = options.propertiesPanel?.invalidationList || {};
    // 'canvas.init' 이벤트에 리스너를 등록합니다.
    eventBus.on('canvas.init', () => {
      this.addTitleToDiagram(this.canvas); // canvas를 addTitleToDiagram에 전달합니다.
    });


    eventBus.on('config.changed', (event) => {
      this.updateConfig(event.config);
    });

  }


  updateConfig(newConfig) {
    this.config = newConfig;
    this.invalidationList = newConfig.propertiesPanel?.invalidationList || {};
    this.redrawAllElements();
  }


  redrawAllElements() {
    const elements = this.elementRegistry.getAll();
    elements.forEach((element) => {
      if (!element.labelTarget) { // 라벨 요소는 제외
        try {
          const gfx = this.elementRegistry.getGraphics(element);
          this.graphicsFactory.update('shape', element, gfx);
        } catch (error) {

        }
      }
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
      'font-weight': '700',
      'text-anchor': 'middle',
      fill: '#535353'
    });
    // titleText.textContent = '영업 활동 프로세스';

    svgAppend(svgRoot, titleText);
  }


  canRender(element) {
    // only render tasks and events (ignore labels)
    return isAny(element, ['bpmn:Task', "bpmn:Lane", "bpmn:Participant", "bpmn:SequenceFlow", "bpmn:StartEvent", "bpmn:EndEvent", "bpmn2:outgoing", "label", "bpmn:Gateway", "bpmn:SubProcess", "bpmn:CallActivity"]) && !element.labelTarget;
  }


  drawShape(parentNode, element) {
    // console.log('Rendering a Task:', parentNode, element);
    const shape = this.bpmnRenderer.drawShape(parentNode, element);
    // 각 요소별로 분리한 함수를 호출합니다.

    if (is(element, 'bpmn:Task')) {
      // 라벨을 찾아서 모든 'tspan' 요소에 대해 스타일을 변경합니다.
      this.drawCustomTask(parentNode, shape, element);
      // const tspanElements = parentNode.querySelectorAll('text.djs-label tspan');
      // tspanElements.forEach((tspan) => {
      //   svgAttr(tspan, { fill: 'red' }); // 모든 tspan 요소에 red 색상을 적용합니다.
      // });
    } else if (is(element, 'bpmn:StartEvent')) {
      this.drawCustomStartEvent(parentNode, shape, element);
    } else if (is(element, 'bpmn:EndEvent')) {
      this.drawCustomEndEvent(parentNode, shape, element);
    } else if (is(element, 'bpmn:Lane')) {
      this.drawCustomLane(parentNode, shape, element);
    } else if (is(element, 'bpmn:Participant')) {
      this.drawCustomParticipant(parentNode, shape, element);
    } else if (is(element, 'label')) {
      this.drawCustomLabel(parentNode, shape, element);
    } else if (is(element, 'bpmn:Gateway')) {
      this.drawCustomGateway(parentNode, shape, element);
    } else if (is(element, 'bpmn:SequenceFlow')) {
      this.drawConnection(parentNode, element);
    } else if (is(element, 'bpmn:SubProcess') || is(element, 'bpmn:CallActivity')) {
      this.drawCustomSubProcess(parentNode, shape, element);
    }
    return shape;
  }


  drawCustomLane(parentNode, shape, element) {
    svgAttr(shape, {
      color: 'red'
    });
  }

  // 스윔레인 배경 색상 및 선 색상 bpmn:Lane, (stroke : 선 색상, fill: 배경 색상)
  drawCustomLane(parentNode, shape, element) {
    svgAttr(shape, {
      stroke: '#4e72be',
      strokeWidth: '1',
      fill: "#f4f8fc"
    });
  }

  drawCustomParticipant(parentNode, shape, element) {
    svgAttr(shape, {
      stroke: '#4e72be',
      fill: "#f4f8fc"
    });
  }

  // bpmn:UserTask 관련
  drawCustomTask(parentNode, shape, element) {
    // 기존 shape의 크기를 가져옵니다.
    const existingWidth = shape.width.baseVal.value;
    const existingHeight = shape.height.baseVal.value

    var strokColor = 'none';

    var strokColor = this.getValidateColor(this.validate(element.id));
    if (strokColor == null) {
      strokColor = 'none';
    }
    const borderRect = drawBorderRect(parentNode, existingWidth, existingHeight, TASK_BORDER_RADIUS, strokColor);
    prependTo(borderRect, parentNode);
    const rect = drawRect(parentNode, existingWidth, existingHeight, TASK_BORDER_RADIUS, 'none', '#fdf2d0', shape.style);
    prependTo(rect, parentNode);
    svgRemove(shape);
  }

  // StartEvnet 관련
  drawCustomStartEvent(parentNode, shape, element) {
    const size = 34;
    const radius = 100;
    var strokColor = this.getValidateColor(this.validate(element.id));
    if (strokColor == null) {
      strokColor = 'none';
    }
    
    const borderRect = drawBorderRect(parentNode, size, size, radius, strokColor);
    prependTo(borderRect, parentNode);
    const rect = drawRect(parentNode, size, size, radius, 'none', '#f6c745');
    prependTo(rect, parentNode);
    svgRemove(shape);
  }

  // endEvnet 관련
  drawCustomEndEvent(parentNode, shape, element) {
    const size = 34;
    const radius = 100;
    var strokColor = this.getValidateColor(this.validate(element.id));
    if (strokColor == null) {
      strokColor = 'none';
    }
    
    const borderRect = drawBorderRect(parentNode, size, size, radius, strokColor);
    prependTo(borderRect, parentNode);
    const rect = drawRect(parentNode, size, size, radius, 'none', '#f6c745');
    prependTo(rect, parentNode);
    svgRemove(shape);
  }

  // 이벤트끼리의 연결선과 화살표 관련
  drawConnection(parentNode, element) {

    if (is(element, 'bpmn:SequenceFlow')) {
      var strokColor = this.getValidateColor(this.validate(element.id));
      if (strokColor == null) {
        strokColor = '#68369a';
      }
      const customMarkerUrl = createCustomMarker(parentNode, strokColor); // 화살표 색상 설정
      const options = {
        stroke: strokColor, // 연결선 색상 변경
        strokeWidth: '2',
        markerEnd: customMarkerUrl // 사용자 정의 마커 적용
      }

      var connection = this.bpmnRenderer.drawConnection(parentNode, element, options);
      return connection;
    }

    return this.bpmnRenderer.drawConnection(parentNode, element);
  }
  // bpmn:Gateway 관련
  drawCustomGateway(parentNode, shape, element) {
    const existingWidth = shape.getBoundingClientRect().width;
    const existingHeight = shape.getBoundingClientRect().height;

    const points = [
      { x: existingWidth / 2, y: 0 },
      { x: existingWidth, y: existingHeight / 2 },
      { x: existingWidth / 2, y: existingHeight },
      { x: 0, y: existingHeight / 2 }
    ].map(point => `${point.x},${point.y}`).join(' ');

    const diamond = drawPolygon(parentNode, points);

    copyAttributes(shape, diamond);
    var strokColor = this.getValidateColor(this.validate(element.id));
    if (strokColor == null) {
      strokColor = '#000000';
    }
    diamond.style.stroke = strokColor;
    diamond.style.strokeWidth = strokColor === '#000000' ? '2' : '5';
    if(strokColor != '#000000' ) {
      diamond.style.strokeDasharray = '10, 10';
    }

    prependTo(diamond, parentNode);

    svgRemove(shape);
  }

  // bpmn:SubProcess 관련
  drawCustomSubProcess(parentNode, shape, element) {
    const existingWidth = shape.width.baseVal.value;
    const existingHeight = shape.height.baseVal.value

    var strokColor = this.getValidateColor(this.validate(element.id));
    if (strokColor == null) {
      strokColor = '#000000';
    }
    const borderRect = drawBorderRect(parentNode, existingWidth, existingHeight, TASK_BORDER_RADIUS, strokColor);
    prependTo(borderRect, parentNode);
    const rect = drawRect(parentNode, existingWidth, existingHeight, TASK_BORDER_RADIUS, '#000000', '#ffffff');
    prependTo(rect, parentNode);
    svgRemove(shape);
  }


  getShapePath(shape) {
    if (is(shape, 'bpmn:Task')) {
      return getRoundRectPath(shape, TASK_BORDER_RADIUS);
    }

    return this.bpmnRenderer.getShapePath(shape);
  }

  validate(key) {
    var state = 'info';
    if (Object.keys(this.invalidationList).length > 0) {
      if (Object.keys(this.invalidationList).includes(key)) {
        this.invalidationList[key].forEach((error) => {
          if (error.errorLevel == WARNING) {
            state = WARNING;
          }
        })
        this.invalidationList[key].forEach((error) => {
          if (error.errorLevel == ERROR) {
            state = ERROR;
          }
        })
      }
    }
    return state;
  }

  getValidateColor(state) {
    if (state == ERROR) {
      return ERROR_COLOR;
    } else if (state == WARNING) {
      return WARNING_COLOR;
    }
    return null;
  }

}

CustomBpmnRenderer.$inject = ['eventBus', 'bpmnRenderer', 'canvas', 'config', 'elementRegistry', 'graphicsFactory'];

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

function drawRect(parentNode, width, height, borderRadius, strokeColor, fillColor) {
  const rect = svgCreate('rect');

  const filterId = addShadowFilter(parentNode);

  svgAttr(rect, {
    width: width,
    height: height,
    rx: borderRadius,
    ry: borderRadius, 
    stroke: strokeColor,
    strokeWidth: 2,
    fill: fillColor || '#fff',
    filter: filterId,
  });

  svgAppend(parentNode, rect);


  return rect;
}

function drawBorderRect(parentNode, width, height, borderRadius, strokeColor) {
  const borderRect = svgCreate('rect');
  
  if (strokeColor !== '#000000') {
    svgAttr(borderRect, {
      'stroke-dasharray': '10, 10'
    });
  }
  svgAttr(borderRect, {
    width: width,
    height: height,
    rx: borderRadius,
    ry: borderRadius,
    stroke: strokeColor == '#000000'? 'none' : strokeColor,
    strokeWidth: 5,
    fill: 'none'
  });
  svgAppend(parentNode, borderRect);
  return borderRect;
}


function drawPolygon(parentNode, points) {
  const polygon = svgCreate('polygon');

  // 필터를 추가하고, 필터 ID를 가져옴
  const filterId = addShadowFilter(parentNode);

  svgAttr(polygon, {
    points: points,
    filter: filterId // 필터 적용
  });

  svgAppend(parentNode, polygon);

  return polygon;
}

function copyAttributes(source, target) {
  const attributes = source.attributes;
  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i];
    target.setAttribute(attr.name, attr.value);
  }
}
// copied from https://github.com/bpmn-io/diagram-js/blob/master/lib/core/GraphicsFactory.js
function prependTo(newNode, parentNode, siblingNode) {
  parentNode.insertBefore(newNode, siblingNode || parentNode.firstChild);
}

