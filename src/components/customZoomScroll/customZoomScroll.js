import { assign } from 'min-dash';
import ZoomScroll from 'diagram-js/lib/navigation/zoomscroll/ZoomScroll';
import { getStepSize, cap } from 'diagram-js/lib/navigation/zoomscroll/ZoomUtil';
import {
  event as domEvent,
  closest as domClosest
} from 'min-dom';

import {
  log10
} from 'diagram-js/lib/util/Math';

import {
  isMac
} from 'diagram-js/lib/util/Platform';


var sign = Math.sign || function(n) {
  return n >= 0 ? 1 : -1;
};

export default function CustomZoomScroll(config, eventBus, canvas) {

  ZoomScroll.call(this, config, eventBus, canvas);

  this.canvas = canvas;
  this._customZoomRange = { min: 0.2, max: 2 };
  this.canvasSize = (({ height, width, x, y }) => ({ height, width, x, y }))(canvas.viewbox());
  this.scale = 1;
  this.scaleOffset = 1;
  canvas.movedDistance = {x:-100, y:0};
  this.resetMovedDistance = function(){
    canvas.movedDistance = {x:-100, y:0};
  }

  // 배포 환경에서 preventDefault가 동작하도록 passive: false로 wheel 이벤트 재등록
  var self = this;
  var container = canvas._container;
  
  console.log('[줌스크롤] 초기화 시작, container:', container);
  
  if (container) {
    var handleWheelWithPassiveFalse = function(event) {
      console.log('[줌스크롤] wheel 이벤트 발생');
      self._handleWheel(event);
    };
    
    // 부모 클래스가 등록한 이벤트를 제거하고 passive: false로 재등록
    setTimeout(function() {
      container.addEventListener('wheel', handleWheelWithPassiveFalse, { passive: false, capture: true });
      console.log('[줌스크롤] wheel 이벤트 등록 완료 (passive: false, capture: true)');
    }, 0);
  }

}

CustomZoomScroll.$inject = [
  'config.zoomScroll',
  'eventBus',
  'canvas'
];

CustomZoomScroll.prototype = Object.create(ZoomScroll.prototype);

CustomZoomScroll.prototype.zoom = function(delta, position) {
  console.log('[줌스크롤] zoom 함수 호출됨, delta:', delta, 'position:', position);
  
  var stepSize = getStepSize(this._customZoomRange, 10 * 2);

  this._totalDelta += delta;

  console.log('[줌스크롤] _totalDelta:', this._totalDelta, '절댓값:', Math.abs(this._totalDelta));

  if (Math.abs(this._totalDelta) > 0.1) {
    console.log('[줌스크롤] _zoom 실행');
    this._zoom(delta, position, stepSize);

    this._totalDelta = 0;
  } else {
    console.log('[줌스크롤] delta가 0.1 이하라서 _zoom 실행 안됨');
  }
};

CustomZoomScroll.prototype.getStepSize = function() {
  return getStepSize(this._customZoomRange, 10 * 2);
};

CustomZoomScroll.prototype._zoom = function(delta, position, stepSize) {
  console.log('[줌스크롤] _zoom 함수 시작');
  
  const canvas = this._canvas;

  const direction = delta > 0 ? 1 : -1;

  const currentLinearZoomLevel = Math.log10(canvas.zoom());

  let newLinearZoomLevel = Math.round(currentLinearZoomLevel / stepSize) * stepSize;

  newLinearZoomLevel += stepSize * direction;

  let newLogZoomLevel = Math.pow(10, newLinearZoomLevel);

  console.log('[줌스크롤] 줌 레벨 변경:', canvas.zoom(), '->', cap(this._customZoomRange, newLogZoomLevel));
  
  canvas.zoom(cap(this._customZoomRange, newLogZoomLevel), position);
  
  console.log('[줌스크롤] canvas.zoom 호출 완료');
};



CustomZoomScroll.prototype._handleWheel = function handleWheel(event) {

  console.log('[줌스크롤] _handleWheel 호출됨');

  // event is already handled by '.djs-scrollable'
  if (domClosest(event.target, '.djs-scrollable', true)) {
    console.log('[줌스크롤] djs-scrollable에서 이미 처리됨, 종료');
    return;
  }

  var element = this._container;
  var me = this;

  console.log('[줌스크롤] preventDefault 호출 전, event:', event);
  event.preventDefault();
  console.log('[줌스크롤] preventDefault 호출 완료');

  // pinch to zoom is mapped to wheel + ctrlKey = true
  // in modern browsers (!)

  // 마우스 휠 기본 동작을 줌으로 설정, Shift 키를 누르면 스크롤
  var isZoom = !event.shiftKey;
  
  console.log('[줌스크롤] isZoom:', isZoom, 'shiftKey:', event.shiftKey);

  var isHorizontalScroll = event.shiftKey;

  var factor = -1 * this._scale,
      delta;

  if (isZoom) {
    factor *= event.deltaMode === 0 ? 0.020 : 0.32;
  } else {
    factor *= event.deltaMode === 0 ? 1.0 : 16.0;
  }

  if (isZoom) {
    console.log('[줌스크롤] 줌 모드 진입, deltaY:', event.deltaY);
    
    var elementRect = element.getBoundingClientRect();

    var offset = {
      x: event.clientX - elementRect.left,
      y: event.clientY - elementRect.top
    };

    delta = (
      Math.sqrt(
        Math.pow(event.deltaY, 2) +
        Math.pow(event.deltaX, 2)
      ) * sign(event.deltaY) * factor
    );

    console.log('[줌스크롤] 계산된 delta:', delta, 'offset:', offset);
    
    // zoom in relative to diagram {x,y} coordinates
    this.zoom(delta, offset);
    
    console.log('[줌스크롤] zoom 함수 호출 완료');
  } else {
    console.log('[줌스크롤] 스크롤 모드 진입');

    if (isHorizontalScroll) {
      delta = {
        dx: factor * event.deltaY,
        dy: 0
      };
    } else {
      delta = {
        dx: factor * event.deltaX,
        dy: factor * event.deltaY
      };
    }


    me.scale = me.canvas.viewbox().scale / me.scaleOffset;
    
    // 스케일 조정된 경계를 계산
    var scaledWidth = me.canvasSize.width * me.scale;
    var scaledHeight = me.canvasSize.height * me.scale;
    var scaledLeft = me.canvasSize.x - (scaledWidth - me.canvasSize.width) / 2;
    var scaledTop = me.canvasSize.y - (scaledHeight - me.canvasSize.height) / 2;
    var scaledRight = scaledLeft + scaledWidth + (scaledWidth - me.canvasSize.width) / 2;
    var scaledBottom = scaledTop + scaledHeight + (scaledHeight - me.canvasSize.height) / 2;
    var canvasLeft = me.canvasSize.x;
    var canvasTop = me.canvasSize.y;
    var canvasRight = canvasLeft + me.canvasSize.width;
    var canvasBottom = canvasTop + me.canvasSize.height;

    // 경계를 초과하게 될 경우 이동하지 않게 변경
    var adjustedDeltaX = delta.dx;
    var adjustedDeltaY = delta.dy;
    var scaledMovedDistanceX = me.canvas.movedDistance.x * me.scale;
    var scaledMovedDistanceY = me.canvas.movedDistance.y * me.scale;

    if(delta.dx < 0 && scaledLeft > canvasLeft + scaledMovedDistanceX + delta.dx){
        adjustedDeltaX = 0;
    }
    if(delta.dx > 0 && scaledRight < canvasRight + scaledMovedDistanceX + delta.dx){
        adjustedDeltaX = 0;
    }
    if(delta.dy < 0 && scaledTop > canvasTop + scaledMovedDistanceY + delta.dy){
        adjustedDeltaY = 0;
    }
    if(delta.dy > 0 && scaledBottom < canvasBottom + scaledMovedDistanceY + delta.dy){
        adjustedDeltaY = 0;
    }

    if (adjustedDeltaX !== 0 || adjustedDeltaY !== 0) {
      this.scroll({
        dx: adjustedDeltaX,
        dy: adjustedDeltaY
      });
    }

    me.canvas.movedDistance.x += (adjustedDeltaX / me.scale);
    me.canvas.movedDistance.y += (adjustedDeltaY / me.scale);

  }
};

