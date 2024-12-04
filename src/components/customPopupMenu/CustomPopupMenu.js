import { assign } from 'min-dash';
import PopupMenu from 'diagram-js/lib/features/popup-menu/PopupMenu';
import { i18n } from '@/main';

export default function CustomPopupMenu(
  config, eventBus, canvas) {
    this.config = config;
    this.eventBus = eventBus;
    this.canvas = canvas;

  }


CustomPopupMenu.$inject = [
  'config',
  'eventBus',
  'canvas'
];


CustomPopupMenu.prototype = Object.create(PopupMenu.prototype);

CustomPopupMenu.prototype._getEntries = function(target) {
  const entries = PopupMenu.prototype._getEntries.call(this, target); 
  return entries;
};