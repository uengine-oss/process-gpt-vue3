export const SIMPLE_INBOX_ACTIONABLE_STATUSES = new Set([
    'IN_PROGRESS',
    'SUBMITTED',
    'PENDING',
    'TODO',
    'NEW',
    'DRAFT',
    'RUNNING',
    'Running'
]);

export function reconcileSimpleInboxReadState({ currentTaskIds, knownTaskIds, unreadTaskIds, hasStoredReadState }) {
    const current = new Set(currentTaskIds || []);
    const known = new Set(knownTaskIds || []);
    const unread = new Set(unreadTaskIds || []);

    if (hasStoredReadState) {
        current.forEach((id) => {
            if (!known.has(id)) unread.add(id);
        });
    }
    current.forEach((id) => known.add(id));
    [...unread].forEach((id) => {
        if (!current.has(id)) unread.delete(id);
    });

    return { knownTaskIds: known, unreadTaskIds: unread };
}

export function buildSimpleInstanceRows({ tasks, instances, unreadTaskIds }) {
    const unread = unreadTaskIds instanceof Set ? unreadTaskIds : new Set(unreadTaskIds || []);
    const byId = new Map((instances || []).filter(Boolean).map((instance) => [instance.instId, instance]));
    const grouped = new Map();
    const taskTime = (task) => new Date(task?.updatedAt || task?.startDate || 0).getTime() || 0;

    // 인스턴스 행이 없는 업무도 버리지 않는다.
    //
    // 엔진이 업무를 먼저 만들고 인스턴스 행을 뒤에 남기는 찰나, 지워진 인스턴스의
    // 업무가 남은 경우가 있다. 그때 그냥 빼 버리면 **배정받은 일이 목록에서
    // 조용히 사라진다** — 이전 칸반은 업무를 그대로 보여 주었으므로 퇴행이 된다.
    // 인스턴스를 모르면 그 업무 하나를 한 줄로 세운다.
    (tasks || []).forEach((task) => {
        const rootId = task.rootInstId || task.instId;
        const key = rootId && byId.has(rootId) ? rootId : `task:${task.taskId}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(task);
    });

    return [...grouped.entries()]
        .map(([key, instanceTasks]) => {
            instanceTasks.sort((a, b) => taskTime(b) - taskTime(a));
            const instance = byId.get(key);
            const lead = instanceTasks[0];
            return {
                ...instance,
                // 인스턴스가 없는 줄은 열 곳이 업무 화면이다. 그것을 표시해 둔다.
                instId: instance ? key : lead?.instId || '',
                orphanTaskId: instance ? null : lead?.taskId || null,
                name: instance?.name || lead?.name || lead?.description || '',
                status: instance?.status || lead?.status || '',
                latestTask: instanceTasks[0],
                taskIds: instanceTasks.map((task) => task.taskId).filter(Boolean),
                lastTodoAt: instanceTasks[0]?.updatedAt || instanceTasks[0]?.startDate || instance?.updatedAt,
                todoCount: instanceTasks.length,
                unreadCount: instanceTasks.filter((task) => unread.has(task.taskId)).length
            };
        })
        .sort((a, b) => {
            if (!!a.unreadCount !== !!b.unreadCount) return a.unreadCount ? -1 : 1;
            return new Date(b.lastTodoAt || 0).getTime() - new Date(a.lastTodoAt || 0).getTime();
        });
}
