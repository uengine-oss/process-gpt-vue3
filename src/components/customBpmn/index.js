import CustomBpmnRenderer from './CustomBpmnRenderer';
import AtomicModeling from './AtomicModeling';
import LaneAutoResize from './LaneAutoResize';
import MoveSemanticOrder from './MoveSemanticOrder';
import SubprocessLaneOwnership from './SubprocessLaneOwnership';

export default {
  __init__: [ 'customBpmnRenderer', 'atomicModeling', 'moveSemanticOrder', 'subprocessLaneOwnership' ],
  customBpmnRenderer: [ 'type', CustomBpmnRenderer ],
  atomicModeling: [ 'type', AtomicModeling ],
  bpmnAutoResize: [ 'type', LaneAutoResize ],
  moveSemanticOrder: [ 'type', MoveSemanticOrder ],
  subprocessLaneOwnership: [ 'type', SubprocessLaneOwnership ]
};
