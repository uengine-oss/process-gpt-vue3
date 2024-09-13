import { assign } from 'min-dash';
import { i18n } from '@/main';

export default function PaletteProvider(palette,
   create, 
   elementFactory, 
   spaceTool, 
   lassoTool, 
   handTool, 
   globalConnect, 
   translate, 
   commandStack, 
   eventBus) {

  this._create = create;
  this._elementFactory = elementFactory;
  this._spaceTool = spaceTool;
  this._lassoTool = lassoTool;
  this._handTool = handTool;
  this._globalConnect = globalConnect;
  this._translate = translate;
  this._commandStack = commandStack;
  this._isMac = (/mac/i).test(navigator.platform);

  palette.registerProvider(this);
}

PaletteProvider.$inject = [
  'palette',
  'create',
  'elementFactory',
  'spaceTool',
  'lassoTool',
  'handTool',
  'globalConnect',
  'translate',
  'commandStack',
  'eventBus'
];

PaletteProvider.prototype.getPaletteEntries = function(element) {
  var actions = {},
      create = this._create,
      elementFactory = this._elementFactory,
      spaceTool = this._spaceTool,
      lassoTool = this._lassoTool,
      handTool = this._handTool,
      globalConnect = this._globalConnect,
      translate = this._translate,
      commandStack = this._commandStack,
      isMac = this._isMac;


  function createAction(type, group, className, title, options) {

    function createListener(event) {
      var shape = elementFactory.createShape(assign({ type: type }, options));

      // if (options) {
      //   shape.businessObject.di.isExpanded = options.isExpanded;
      // }

      create.start(event, shape);
    }

    var shortType = type.replace(/^bpmn:/, '');
    var translatedShortType = i18n.global.t(`PaletteProvider.${shortType}`);

    return {
      group: group,
      className: className,
      title: title || translatedShortType,
      action: {
        dragstart: createListener,
        click: createListener
      }
    };
  }
  
  
  function createParticipant(event, collapsed, isHorizontal) {
    var participantShape = elementFactory.createParticipantShape({
      isHorizontal: isHorizontal,
      width: isHorizontal ? 450 : 300,
      height: isHorizontal ? 200 : 400
    });
    create.start(event, participantShape);
  }
  assign(actions, {
    'undo': {
      group: 'tools',
      className: 'mdi mdi-undo-variant',
      title: isMac ? i18n.global.t('PaletteProvider.undoCmdZ') : i18n.global.t('PaletteProvider.undoCtrlZ'),
      action: {
        click: function(event) {
          commandStack.undo();
        }
      }
    },
    'redo': {
      group: 'tools',
      className: 'mdi mdi-redo-variant',
      title: isMac ? i18n.global.t('PaletteProvider.RedoCmdShiftZ') : i18n.global.t('PaletteProvider.RedoCtrlY'),
      action: {
        click: function(event) {
          commandStack.redo();
        }
      }
    },
    'hand-tool': {
      group: 'tools',
      className: 'bpmn-icon-hand-tool',
      title: i18n.global.t('PaletteProvider.handTool'),
      action: {
        click: function(event) {
          handTool.activateHand(event);
        }
      }
    },
    // 'custom-separator': {
    //   group: 'custom',
    //   separator: true
    // },
    'lasso-tool': {
      group: 'tools',
      className: 'bpmn-icon-lasso-tool',
      title: i18n.global.t('PaletteProvider.lassoTool'),
      action: {
        click: function(event) {
          lassoTool.activateSelection(event);
        }
      }
    },
    'space-tool': {
      group: 'tools',
      className: 'bpmn-icon-space-tool',
      title: i18n.global.t('PaletteProvider.spaceTool'),
      action: {
        click: function(event) {
          spaceTool.activateSelection(event);
        }
      }
    },
    'global-connect-tool': {
      group: 'tools',
      className: 'bpmn-icon-connection-multi',
      title: i18n.global.t('PaletteProvider.globalConnectTool'),
      action: {
        click: function(event) {
          globalConnect.toggle(event);
        }
      }
    },
    // 'tool-separator': {
    //   group: 'tools',
    //   separator: true
    // },
    'create.start-event': createAction(
      'bpmn:StartEvent', 'event', 'bpmn-icon-start-event-none'
    ),
    'create.intermediate-event': createAction(
      'bpmn:IntermediateThrowEvent', 'event', 'bpmn-icon-intermediate-event-none'
    ),
    'create.end-event': createAction(
      'bpmn:EndEvent', 'event', 'bpmn-icon-end-event-none'
    ),
    'create.exclusive-gateway': createAction(
      'bpmn:ExclusiveGateway', 'gateway', 'bpmn-icon-gateway-xor'
    ),
    'create.task': createAction(
      'bpmn:Task', 'activity', 'bpmn-icon-task'
    ),
    'create.subprocess-expanded': createAction(
      'bpmn:SubProcess', 'activity', 'bpmn-icon-subprocess-expanded', i18n.global.t('PaletteProvider.expandedSubProcess'),
      { isExpanded: true }
    ),
    'create.data-store': createAction(
      'bpmn:DataStoreReference', 'data-object', 'bpmn-icon-data-store', i18n.global.t('PaletteProvider.dataStore')
    ),
    'create.data-object': createAction(
      'bpmn:DataObjectReference', 'data-object', 'bpmn-icon-data-object', i18n.global.t('PaletteProvider.dataObject')
    ),
    'create.participant-expanded': {
      group: 'collaboration',
      className: 'bpmn-icon-participant',
      title: i18n.global.t('PaletteProvider.participantCollapsed'),
      action: {
        dragstart: function(event) {
          createParticipant(event, false, true);
        },
        click: function(event) {
          createParticipant(event, false, true);
        }
      }
    },
    'create.participant-collapsed': {
      group: 'collaboration',
      className: 'bpmn-icon-participant icon-rotate-90',
      title: i18n.global.t('PaletteProvider.participantExpanded'),
      action: {
        dragstart: function(event) {
          createParticipant(event, true, false);
        },
        click: function(event) {
          createParticipant(event, true, false);
        }
      }
    }
  });

  return actions;
};