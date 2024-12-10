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
  this.movedDistance = {x:-100, y:0};
  this.resetMovedDistance = function(){
    this.movedDistance = {x:-100, y:0};
  }

}

CustomZoomScroll.$inject = [
  'config.zoomScroll',
  'eventBus',
  'canvas'
];

CustomZoomScroll.prototype = Object.create(ZoomScroll.prototype);

CustomZoomScroll.prototype.zoom = function(delta, position) {
  var stepSize = getStepSize(this._customZoomRange, 10 * 2);

  this._totalDelta += delta;

  if (Math.abs(this._totalDelta) > 0.1) {
    this._zoom(delta, position, stepSize);

    this._totalDelta = 0;
  }
};

CustomZoomScroll.prototype.getStepSize = function() {
  return getStepSize(this._customZoomRange, 10 * 2);
};

CustomZoomScroll.prototype._zoom = function(delta, position, stepSize) {
  const canvas = this._canvas;

  const direction = delta > 0 ? 1 : -1;

  const currentLinearZoomLevel = Math.log10(canvas.zoom());

  let newLinearZoomLevel = Math.round(currentLinearZoomLevel / stepSize) * stepSize;

  newLinearZoomLevel += stepSize * direction;

  let newLogZoomLevel = Math.pow(10, newLinearZoomLevel);

  canvas.zoom(cap(this._customZoomRange, newLogZoomLevel), position);
};



CustomZoomScroll.prototype._handleWheel = function handleWheel(event) {

  // event is already handled by '.djs-scrollable'
  if (domClosest(event.target, '.djs-scrollable', true)) {
    return;
  }

  var element = this._container;
  var me = this;

  event.preventDefault();

  // pinch to zoom is mapped to wheel + ctrlKey = true
  // in modern browsers (!)

  var isZoom = event.ctrlKey || (isMac() && event.metaKey);

  var isHorizontalScroll = event.shiftKey;

  var factor = -1 * this._scale,
      delta;

  if (isZoom) {
    factor *= event.deltaMode === 0 ? 0.020 : 0.32;
  } else {
    factor *= event.deltaMode === 0 ? 1.0 : 16.0;
  }

  if (isZoom) {
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

    // zoom in relative to diagram {x,y} coordinates
    this.zoom(delta, offset);
  } else {

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

    
    me.scale = me.canvas.viewbox().scale;
    
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
    var scaledMovedDistanceX = me.movedDistance.x * me.scale;
    var scaledMovedDistanceY = me.movedDistance.y * me.scale;

    if(scaledLeft > canvasLeft + scaledMovedDistanceX + delta.dx){
        adjustedDeltaX = 0;
    }
    if(scaledRight < canvasRight + scaledMovedDistanceX + delta.dx){
        adjustedDeltaX = 0;
    }
    if(scaledTop > canvasTop + scaledMovedDistanceY + delta.dy){
        adjustedDeltaY = 0;
    }
    if(scaledBottom < canvasBottom + scaledMovedDistanceY + delta.dy){
        adjustedDeltaY = 0;
    }

    if (adjustedDeltaX !== 0 || adjustedDeltaY !== 0) {
      this.scroll({
        dx: adjustedDeltaX,
        dy: adjustedDeltaY
      });
    }

    me.movedDistance.x += (adjustedDeltaX / me.scale);
    me.movedDistance.y += (adjustedDeltaY / me.scale);

  }
};

