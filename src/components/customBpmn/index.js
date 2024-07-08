import CustomBpmnRenderer from './CustomBpmnRenderer';
import PaletteProvider from './PaletteProvider';

export default {
  __init__: [ 'customBpmnRenderer' , 'paletteProvider'],
  customBpmnRenderer: [ 'type', CustomBpmnRenderer ],
  paletteProvider: [ 'type', PaletteProvider ]
};