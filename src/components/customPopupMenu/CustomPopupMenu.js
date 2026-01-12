import PopupMenu from 'diagram-js/lib/features/popup-menu/PopupMenu';
import {
  forEach,
  isFunction,
  omit,
} from 'min-dash';

export default class CustomPopupMenu extends PopupMenu {
  constructor(
    config, eventBus, canvas
  ) {
    super(config, eventBus, canvas);
  }
  // Note: _getEntries is handled by the modified PopupMenu.prototype._getEntries below
  // Do NOT override it here as it would shadow the prototype method
}



CustomPopupMenu.$inject = [
  'config',
  'eventBus',
  'canvas'
];


PopupMenu.prototype._getEntries = function(target, providers) {
  var entries = {};
  var removedEntries = ['replace-with-conditional-intermediate-catch'];

  providers.forEach(provider => {
    if (!provider.getPopupMenuEntries) {
      forEach(provider.getEntries(target), function(entry) {
        var id = entry.id;

        if (!id) {
          throw new Error('entry ID is missing');
        }

        entries[id] = omit(entry, [ 'id' ]);
      });

      return;
    }

    
    var entriesOrUpdater = provider.getPopupMenuEntries(target);

    if (isFunction(entriesOrUpdater)) {
      entries = entriesOrUpdater(entries);
    } else {
      forEach(entriesOrUpdater, function(entry, id) {
        entries[id] = entry;
      });
    }
  });

  removedEntries.forEach(id => {
    delete entries[id];
  });

  return entries;
};
