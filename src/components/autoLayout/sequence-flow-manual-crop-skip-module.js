/**
 * 벤드포인트·연결 세그먼트 드래그 시 CroppingConnectionDocking.getCroppedWaypoints 가 호출되는데,
 * 이때 장애물 회피·직교 맨해튼 보정을 하면 사용자가 둔 경로가 덮어씌워짐 → 드래그 구간에만 스킵.
 * (connection.layout / connection.create 등 자동 라우팅은 영향 없음)
 * 전역 플래그가 아니라 모듈 내부 상태만 사용한다.
 */

var manualCropPostprocessSkipped = false;

export function isSequenceFlowManualCropPostprocessSkipped() {
  return manualCropPostprocessSkipped;
}

function prepareSegmentCommit(context) {
  if (context.connection.type !== 'bpmn:SequenceFlow') return;
  var points = context.newWaypoints;
  if (!points || points.length < 2 || points.some(function (point, index) {
    return !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      (index && Math.abs(point.x - points[index - 1].x) > 0.01 &&
        Math.abs(point.y - points[index - 1].y) > 0.01);
  })) return;

  var offset = 0;
  var filtered = points.filter(function (point, index) {
    var previous = points[index - 1], next = points[index + 1];
    if (previous && next &&
      ((previous.x === point.x && point.x === next.x) ||
        (previous.y === point.y && point.y === next.y))) {
      if (index <= context.newSegmentStartIndex) offset--;
      return false;
    }
    return true;
  });
  return { connection: context.connection, points: filtered, index: context.newSegmentStartIndex + offset };
}

function SequenceFlowManualCropSkip(eventBus) {
  var segmentCommit;

  function setSkip(v) {
    manualCropPostprocessSkipped = !!v;
  }

  eventBus.on('bendpoint.move.start', function () {
    setSkip(true);
  });
  eventBus.on(['bendpoint.move.cleanup', 'bendpoint.move.cancel'], function () {
    setSkip(false);
  });

  eventBus.on('connectionSegment.move.start', function () {
    segmentCommit = null;
    setSkip(true);
  });

  // Keep short right-angle legs that native near-collinear filtering removes.
  // Let native dragging, cropping and command history run with the same preview.
  eventBus.on('connectionSegment.move.end', 1100, function (event) {
    segmentCommit = prepareSegmentCommit(event.context);
  });
  eventBus.on('commandStack.connection.updateWaypoints.preExecute', 1500, function (event) {
    var context = event.context;
    if (!segmentCommit || context.connection !== segmentCommit.connection || !context.hints?.segmentMove) return;
    context.newWaypoints = segmentCommit.points;
    context.hints.segmentMove.newSegmentStartIndex = segmentCommit.index;
    segmentCommit = null;
  });
  eventBus.on(['connectionSegment.move.cleanup', 'connectionSegment.move.cancel'], function () {
    segmentCommit = null;
    setSkip(false);
  });
}

SequenceFlowManualCropSkip.$inject = ['eventBus'];

export const sequenceFlowManualCropSkipModule = {
  __init__: ['sequenceFlowManualCropSkip'],
  sequenceFlowManualCropSkip: ['type', SequenceFlowManualCropSkip],
};

export default sequenceFlowManualCropSkipModule;
