/**
 * 에이전트 이벤트에서 작업(job)별 도구 사용 목록을 만든다.
 *
 * tool_usage_started 로 항목을 열고 tool_usage_finished 로 닫는다. 둘 다
 * tool_use_id 가 있으면 그것으로 짝을 맞춘다 — 같은 도구(예: Bash)를 동시에
 * 여러 번 부르면 이름만으로는 어느 호출이 끝났는지 알 수 없어, 끝나지 않은
 * 호출이 완료로, 끝난 호출이 진행 중으로 보였다(cli-agent, 2026-10-08).
 * id 가 없으면 이전처럼 같은 이름의 가장 최근 항목(LIFO)과 짝짓는다.
 *
 * 원래 agentEventTimeline 의 computed 안에 있던 것을 꺼냈다(노드 단위 테스트용).
 */
export function toolUsageByJob(events) {
    const usageMap = {};
    const finishedEventsByJob = {};
    // 이벤트를 시간 순으로 정렬해 시작 항목을 생성하고, 완료 이벤트는 job_id별로 별도 수집
    (events || [])
        .slice()
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .forEach((e) => {
            const { event_type, job_id, id, crew_type } = e;
            const data = e.data || {};
            const jobId = job_id || data?.job_id || id;
            if (!usageMap[jobId]) usageMap[jobId] = [];

            if (event_type === 'tool_usage_started') {
                const toolName = data.tool_name || crew_type;
                const entry = {
                    tool_name: toolName,
                    tool_use_id: data.tool_use_id || null,
                    query: data.query || null,
                    info: null,
                    status: 'searching'
                };
                if (toolName === 'write_todos' && Array.isArray(data.args?.todos)) {
                    entry.todos = data.args.todos;
                }
                usageMap[jobId].push(entry);
            } else if (event_type === 'tool_usage_finished') {
                if (!finishedEventsByJob[jobId]) finishedEventsByJob[jobId] = [];
                finishedEventsByJob[jobId].push({
                    tool_name: data.tool_name || crew_type,
                    tool_use_id: data.tool_use_id || null,
                    info: data.info || data.message || data.result || null,
                    consumed: false
                });
            } else if (event_type === 'task_working') {
                usageMap[jobId].push({
                    tool_name: crew_type,
                    query: data.query || null,
                    info: data.info || data.message || null,
                    status: 'done'
                });
            }
        });

    const close = (entry, fin) => {
        entry.status = 'done';
        entry.info = fin.info;
        fin.consumed = true;
    };

    // 0차 매칭: 호출 id 가 같은 시작 항목
    Object.keys(finishedEventsByJob).forEach((jobId) => {
        const list = usageMap[jobId] || [];
        finishedEventsByJob[jobId].forEach((fin) => {
            if (!fin.tool_use_id) return;
            const entry = list.find((t) => t.tool_use_id === fin.tool_use_id && t.status === 'searching');
            if (entry) close(entry, fin);
        });
    });

    // 1차 매칭: job_id 내에서 도구명이 같은 시작 항목을 LIFO로 찾아 완료 처리 + 결과 반영.
    // id 가 있는 시작 항목은 자기 id 의 완료만 받는다.
    Object.keys(finishedEventsByJob).forEach((jobId) => {
        const list = usageMap[jobId] || [];
        finishedEventsByJob[jobId].forEach((fin) => {
            if (fin.consumed) return;
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].tool_use_id && fin.tool_use_id) continue;
                if (list[i].tool_name === fin.tool_name && list[i].status === 'searching') {
                    close(list[i], fin);
                    break;
                }
            }
        });
    });

    // 폴백 처리: tool_usage_started 이벤트가 tool_usage_finished 이벤트보다 늦게 기록되는 등
    // 기록 순서 문제로 1차 매칭에 실패해 'searching' 상태로 남는 경우가 있다.
    // 같은 job_id에 tool_usage_finished 이벤트가 존재한다면, 도구명이 완전히 일치하지 않더라도
    // 결과(info)와 함께 무조건 완료로 표기한다 (finished 이벤트가 있다는 것은 결과도 있다는 뜻이므로).
    // 단, 호출 id 가 있는 시작 항목은 남의 완료로 닫지 않는다 — 실제로 아직 도는 호출이다.
    Object.keys(usageMap).forEach((jobId) => {
        const unconsumed = (finishedEventsByJob[jobId] || []).filter((f) => !f.consumed && !f.tool_use_id);
        if (unconsumed.length === 0) return;
        usageMap[jobId].forEach((tool) => {
            if (tool.status !== 'searching' || tool.tool_use_id) return;
            if (unconsumed.length === 0) return;
            let idx = unconsumed.findIndex((f) => f.tool_name === tool.tool_name);
            if (idx === -1) idx = 0;
            close(tool, unconsumed[idx]);
            unconsumed.splice(idx, 1);
        });
    });

    return usageMap;
}

/**
 * 결과가 없는 완료인가 — 카드를 "완료" 로 닫되 결과 상자(와 채택 버튼)를 띄우지 않는다.
 *
 * 에이전트가 사람에게 묻고 멈출 때 그때까지의 카드를 닫는 완료는 결과가 아니다.
 * 빈 본문을 결과로 그리면 빈 상자나 메시지 원본이 "채택" 버튼과 함께 보였다.
 */
export function isEmptyCompletion(data) {
    if (data === null || data === undefined || data === '') return true;
    if (Array.isArray(data)) return data.length === 0;
    return typeof data === 'object' && Object.keys(data).length === 0;
}

/**
 * 오류로 끝난 작업(job)들. 오류 이벤트는 따로 카드가 되지만, 같은 job_id 의 작업
 * 카드가 열린 채 남으면 실패한 실행이 영원히 "진행중" 으로 보였다.
 */
export function failedJobIds(events) {
    const ids = new Set();
    (events || []).forEach((e) => {
        if (e?.event_type === 'error' && e.job_id) ids.add(e.job_id);
    });
    return ids;
}
