import PaletteProvider from './PaletteProvider';
import CustomSplitLaneHandler from './CustomSplitLaneHandler';
import AddLaneToPhaseHandler from './AddLaneToPhaseHandler';

export default {
  __init__: [ 'paletteProvider', 'customSplitLaneHandler', 'addLaneToPhaseHandler' ],
  paletteProvider: [ 'type', PaletteProvider ],
  customSplitLaneHandler: [ 'type', CustomSplitLaneHandler ],
  addLaneToPhaseHandler: [ 'type', AddLaneToPhaseHandler ]
};