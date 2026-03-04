// PAL mode flag — 반드시 라우터보다 먼저 import되어야 함
Object.defineProperty(window, '$pal', {
    value: true,
    writable: false,
    configurable: false
});
