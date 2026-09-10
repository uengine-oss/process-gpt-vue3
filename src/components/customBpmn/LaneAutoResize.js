import BpmnAutoResize from 'bpmn-js/lib/features/auto-resize/BpmnAutoResize';
import { getLanesRoot } from 'bpmn-js/lib/features/modeling/util/LaneUtil';
import { isHorizontal } from 'bpmn-js/lib/util/DiUtil';

export default function LaneAutoResize(injector, spaceTool) {
  injector.invoke(BpmnAutoResize, this);
  this._spaceTool = spaceTool;
}

LaneAutoResize.$inject = ['injector', 'spaceTool'];
LaneAutoResize.prototype = Object.create(BpmnAutoResize.prototype);
LaneAutoResize.prototype.constructor = LaneAutoResize;

LaneAutoResize.prototype._expand = function(elements, target) {
  const previous = this._expandingElements;
  this._expandingElements = new Set(elements);
  try {
    return BpmnAutoResize.prototype._expand.call(this, elements, target);
  } finally {
    this._expandingElements = previous;
  }
};

LaneAutoResize.prototype.resize = function(target, bounds, hints) {
  if (target.type !== 'bpmn:Lane') {
    return BpmnAutoResize.prototype.resize.call(this, target, bounds, hints);
  }

  const elements = [];
  const visit = element => {
    elements.push(element);
    for (const child of element.children || []) visit(child);
  };
  visit(getLanesRoot(target));
  const laneShape = element => element.type === 'bpmn:Lane' || element.type === 'bpmn:Participant';
  const members = new Set((target.businessObject.flowNodeRef || []).map(node => node.id));
  const crossAxis = isHorizontal(target) ? 'y' : 'x';
  const crossSize = crossAxis === 'x' ? 'width' : 'height';
  const laneStart = target[crossAxis], laneEnd = laneStart + target[crossSize];
  const expandingElements = this._expandingElements;
  const belongsToTarget = element => {
    const shape = element.labelTarget || element;
    const content = shape.host || shape;
    // The bounds of these already moved/resized contents triggered this expansion.
    for (let node = content; node; node = node.parent) {
      if (expandingElements?.has(node)) return true;
    }
    // A shared subprocess must stretch across inserted space. Its children keep
    // their own row assignment rather than inheriting the subprocess XML owner.
    if (content.type === 'bpmn:SubProcess' && content.di?.isExpanded &&
      (content[crossAxis] < laneStart || content[crossAxis] + content[crossSize] > laneEnd)) return false;
    if (content.parent === target) return true;
    const center = content[crossAxis] + content[crossSize] / 2;
    for (let node = content; node; node = node.parent) {
      if (node === target || members.has(node.id)) return center >= laneStart && center <= laneEnd;
    }
    return false;
  };
  const changes = [
    ['x', 'width', 'w', bounds.x - target.x, false],
    ['x', 'width', 'e', bounds.x + bounds.width - target.x - target.width, true],
    ['y', 'height', 'n', bounds.y - target.y, false],
    ['y', 'height', 's', bounds.y + bounds.height - target.y - target.height, true]
  ];
  for (const [axis, size, direction, change, end] of changes) {
    if (!change) continue;
    // Target content already occupies the requested new space. Only neighbours
    // may move when that space is inserted at the old lane boundary.
    const affected = elements.filter(element => laneShape(element) ||
      (axis === crossAxis && !belongsToTarget(element)));
    const start = target[axis] + (end ? target[size] - 0.01 : 0.01);
    const adjustments = this._spaceTool.calculateAdjustments(affected, axis, change, start);
    this._spaceTool.makeSpace(adjustments.movingShapes, adjustments.resizingShapes,
      { x: axis === 'x' ? change : 0, y: axis === 'y' ? change : 0 }, direction, start);
  }
};
