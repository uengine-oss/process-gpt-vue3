export function clearBpmnLoadingTimeout(timerId, clearScheduler = globalThis.clearTimeout) {
    if (timerId) {
        clearScheduler(timerId);
    }

    return null;
}

export function startBpmnLoadingTimeout({
    currentTimerId = null,
    setLoading,
    scheduler = globalThis.setTimeout,
    clearScheduler = globalThis.clearTimeout,
    timeoutMs = 3000
}) {
    const clearedTimerId = clearBpmnLoadingTimeout(currentTimerId, clearScheduler);

    setLoading(true);

    return scheduler(() => {
        setLoading(false);
    }, timeoutMs, clearedTimerId);
}
