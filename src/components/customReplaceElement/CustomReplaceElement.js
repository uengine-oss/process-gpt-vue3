import { assign } from 'min-dash';
import ReplaceMenuProvider from 'bpmn-js/lib/features/popup-menu/ReplaceMenuProvider';
import { i18n } from '@/main';

export default function CustomReplaceMenuProvider(
  bpmnFactory, popupMenu, modeling, moddle, bpmnReplace, rules, translate, moddleCopy) {

  ReplaceMenuProvider.call(this, bpmnFactory, popupMenu, modeling, moddle, bpmnReplace, rules, translate, moddleCopy);

  this._bpmnFactory = bpmnFactory;
  this._popupMenu = popupMenu;
  this._modeling = modeling;
  this._moddle = moddle;
  this._bpmnReplace = bpmnReplace;
  this._rules = rules;
  this._translate = translate;
  this._moddleCopy = moddleCopy;

  this._register();
}

CustomReplaceMenuProvider.$inject = [
  'bpmnFactory',
  'popupMenu',
  'modeling',
  'moddle',
  'bpmnReplace',
  'rules',
  'translate',
  'moddleCopy'
];

CustomReplaceMenuProvider.prototype = Object.create(ReplaceMenuProvider.prototype);

CustomReplaceMenuProvider.prototype._createEntries = function(target, replaceOptions) {
  const entries = ReplaceMenuProvider.prototype._createEntries.call(this, target, replaceOptions);
  Object.keys(entries).forEach(key => {
    if (entries[key].label) {
      const translationKey = `CustomReplaceElement.${key}`;
      entries[key].label = i18n.global.t(translationKey);
    }
  });
  return entries;
};

CustomReplaceMenuProvider.prototype.getPopupMenuHeaderEntries = function(target) {
  const headerEntries = ReplaceMenuProvider.prototype.getPopupMenuHeaderEntries.call(this, target);
  Object.keys(headerEntries).forEach(key => {
    if (headerEntries[key].title) {
      const translationKey = `CustomReplaceElement.${key}`;
      headerEntries[key].title = i18n.global.t(translationKey);
    }
  });

  return headerEntries;
};

