/** 1-based Excel column number to its A1-style column label. */
export function getColumnLetter(columnNumber) {
    let value = Math.max(1, Number(columnNumber) || 1);
    let result = '';
    while (value > 0) {
        const remainder = (value - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        value = Math.floor((value - 1) / 26);
    }
    return result;
}
