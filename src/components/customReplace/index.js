import CustomReplaceMenuProvider from './CustomReplaceMenuProvider';
import CatalogReplaceMenuProvider from './CatalogReplaceMenuProvider';

export default {
    __init__: ['customReplaceMenuProvider', 'catalogReplaceMenuProvider'],
    customReplaceMenuProvider: ['type', CustomReplaceMenuProvider],
    catalogReplaceMenuProvider: ['type', CatalogReplaceMenuProvider]
};
