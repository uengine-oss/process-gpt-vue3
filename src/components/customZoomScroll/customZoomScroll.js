import { assign } from 'min-dash';
import ZoomScroll from 'diagram-js/lib/navigation/zoomscroll/ZoomScroll';
import { getStepSize, cap } from 'diagram-js/lib/navigation/zoomscroll/ZoomUtil';

export default function CustomZoomScroll(config, eventBus, canvas) {

  ZoomScroll.call(this, config, eventBus, canvas);

  this._customZoomRange = { min: 0.2, max: 2 };

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

CustomZoomScroll.prototype._zoom = function(delta, position, stepSize) {
  const canvas = this._canvas;

  const direction = delta > 0 ? 1 : -1;

  const currentLinearZoomLevel = Math.log10(canvas.zoom());

  let newLinearZoomLevel = Math.round(currentLinearZoomLevel / stepSize) * stepSize;

  newLinearZoomLevel += stepSize * direction;

  let newLogZoomLevel = Math.pow(10, newLinearZoomLevel);

  canvas.zoom(cap(this._customZoomRange, newLogZoomLevel), position);
};


