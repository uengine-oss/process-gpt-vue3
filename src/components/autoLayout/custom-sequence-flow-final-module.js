/**
 * ModelingModule 에서 다음만 교체합니다.
 * - layouter: sequence-flow-final-layouter.js
 * - connectionDocking: sequence-flow-final-connection-docking.js (CroppingConnectionDocking 복사 + visual crop only 유지)
 * Task 유형 변경 시 기존 크기와 연결선 경로를 유지합니다.
 */
import SequenceFlowFinalLayouter from './sequence-flow-final-layouter.js';
import CroppingConnectionDocking from './sequence-flow-final-connection-docking.js';
import PreserveTaskReplacementConnections from './preserve-task-replacement-connections.js';

export const customSequenceFlowFinalModule = {
    __init__: ['preserveTaskReplacementConnections'],
    preserveTaskReplacementConnections: ['type', PreserveTaskReplacementConnections],
    layouter: ['type', SequenceFlowFinalLayouter],
    connectionDocking: ['type', CroppingConnectionDocking]
};

export default customSequenceFlowFinalModule;
