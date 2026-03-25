"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCOUNT_CATEGORIES = exports.ENTITY_TYPES = void 0;
exports.centsToDisplay = centsToDisplay;
exports.displayToCents = displayToCents;
exports.ENTITY_TYPES = ['1065', '1120', '1120S', '1040_C'];
exports.ACCOUNT_CATEGORIES = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];
function centsToDisplay(cents) {
    return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function displayToCents(value) {
    if (typeof value === 'number')
        return Math.round(value * 100);
    return Math.round(parseFloat(value.replace(/[^0-9.-]/g, '')) * 100);
}
//# sourceMappingURL=types.js.map