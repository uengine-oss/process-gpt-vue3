const consumers = new Map();

export function registerDrilldownHistory(session, canHandle) {
    consumers.set(session, canHandle);
    return () => consumers.delete(session);
}

/** Let Vue Router maintain its history state, but skip route navigation for owned plane changes. */
export function withCallActivityHistory(routerHistory) {
    const listen = routerHistory.listen.bind(routerHistory);
    routerHistory.listen = (listener) =>
        listen((to, from, info) => {
            const marker = window.history.state?.caDrilldown;
            if (to === from && marker && consumers.get(marker.session)?.(marker)) return;
            listener(to, from, info);
        });
    return routerHistory;
}
