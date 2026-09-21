/**
 * 에이전트 이벤트를 화면이 읽을 수 있는 모양으로 바꾼다.
 *
 * 원래 AgentMonitor 안에만 있던 것을 꺼냈다. 인스턴스 대화도 같은 이벤트를
 * 같은 모양으로 보여 주어야 하는데, 옮기지 않고 베끼면 두 화면이 서서히
 * 달라진다 — 도구 사용 시작·완료 짝 맞추기 같은 규칙은 특히 그렇다.
 *
 * 쓰는 쪽이 갖춰야 하는 것
 *   events — events 테이블 행의 배열
 * 선택
 *   handleHumanCheckedEvent(row) — human_checked 를 받았을 때 할 일이 있으면
 */
export default {
    computed: {
        tasks() {
            const taskMap = new Map();
            const crewCompletedJobIds = new Set();
            const humanAskedTasks = [];
            const humanRespondedJobIds = new Set();
            const humanResponseByJobId = {};

            // 단일 루프로 이벤트 처리
            this.events.forEach((e) => {
                const { event_type, crew_type, data, job_id, id, timestamp } = e;
                const jobId = job_id || data?.job_id || id;

                if (event_type === 'crew_completed') {
                    crewCompletedJobIds.add(jobId);
                } else if (event_type === 'human_response') {
                    humanRespondedJobIds.add(jobId);
                    humanResponseByJobId[jobId] = e;
                } else if (event_type === 'task_started') {
                    // console.log('[AgentMonitor] task_started 이벤트:', {
                    //     jobId,
                    //     data,
                    //     task_description: data?.task_description,
                    //     goal: data?.goal,
                    //     name: data?.name,
                    //     role: data?.role
                    // })
                    taskMap.set(jobId, {
                        id,
                        jobId,
                        goal: data?.goal || 'Task',
                        name: data?.name || '',
                        role: data?.role || 'Agent',
                        crewType: crew_type || 'default',
                        startTime: timestamp,
                        isCompleted: false,
                        outputRaw: null,
                        content: null,
                        isCrewCompleted: false,
                        agentProfile: data?.agent_profile,
                        isHumanAsked: false,
                        taskDescription: data?.task_description || null
                    });
                    // console.log('[AgentMonitor] 생성된 task 객체:', taskMap.get(jobId))
                } else if (event_type === 'task_completed' && taskMap.has(jobId)) {
                    const task = taskMap.get(jobId);
                    task.isCompleted = true;
                    task.outputRaw = data || null;
                    task.content = this.resolvePrimaryValue(data || null, task.crewType);
                    if (task.crewType === 'browser-use') {
                        task.completedEventId = e.id;
                    }
                } else if (event_type === 'error') {
                    // job_id 매칭 없이 독립 태스크 생성
                    const friendlyText = data && (data.friendly || data.message || data.msg || data.raw_error);
                    const message = friendlyText || '오류가 발생했습니다';
                    const key = id;
                    taskMap.set(key, {
                        id,
                        jobId: key,
                        goal: data?.goal,
                        name: data?.name,
                        role: data?.role,
                        crewType: 'text',
                        startTime: timestamp,
                        isCompleted: true,
                        outputRaw: data || null,
                        content: message,
                        isCrewCompleted: false,
                        agentProfile: data?.agent_profile || null,
                        isHumanAsked: false,
                        isError: true
                    });
                } else if (event_type === 'human_asked') {
                    // human_asked 이벤트를 별도 작업으로 추가 (블루톤 카드용 텍스트 구성)
                    const baseDescription = this.$t('AgentSelectInfo.humanApproval.description');
                    const response = humanResponseByJobId[jobId] || null;
                    humanAskedTasks.push({
                        id,
                        jobId,
                        goal: baseDescription,
                        name: this.$t('AgentSelectInfo.humanApproval.title'),
                        role: data?.role || 'System',
                        crewType: 'human_asked',
                        startTime: timestamp,
                        isCompleted: Boolean(response),
                        outputRaw: null,
                        content: null,
                        isCrewCompleted: false,
                        agentProfile: data?.agent_profile || null,
                        isHumanAsked: true,
                        humanQueryData: {
                            type: data?.type || 'text',
                            options: Array.isArray(data?.options) ? data.options : [],
                            text: data?.text || ''
                        },
                        humanResponse: response,
                        eventRow: e
                    });
                } else if (event_type === 'human_checked') {
                    const content = data.data;
                    taskMap.set(jobId, {
                        id,
                        jobId,
                        goal: data?.goal || 'Task',
                        name: data?.name || '',
                        role: data?.role || 'Agent',
                        crewType: crew_type || 'default',
                        startTime: timestamp,
                        isCompleted: true,
                        outputRaw: data || null,
                        content: content || null,
                        isCrewCompleted: false,
                        agentProfile: data?.agent_profile,
                        isHumanAsked: false,
                        taskDescription: data?.message || null
                    });
                    if (typeof this.handleHumanCheckedEvent === 'function') this.handleHumanCheckedEvent(e);
                }
            });

            // crew_completed 마킹 - job_id 기준으로 처리
            crewCompletedJobIds.forEach((jobId) => {
                if (taskMap.has(jobId)) {
                    taskMap.get(jobId).isCrewCompleted = true;
                }
            });

            // human_response 존재 시 해당 human_asked 카드를 완료 처리
            humanAskedTasks.forEach((task) => {
                if (humanRespondedJobIds.has(task.jobId)) {
                    task.isCompleted = true;
                    task.humanResponse = task.humanResponse || humanResponseByJobId[task.jobId] || null;
                }
            });

            // 일반 작업과 human_asked 작업을 합치고 시간 순으로 정렬
            const allTasks = [...Array.from(taskMap.values()), ...humanAskedTasks];
            return allTasks.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        },
        toolUsageStatusByTask() {
            const usageMap = {};
            const finishedEventsByJob = {};
            // 이벤트를 시간 순으로 정렬해 시작 항목을 생성하고, 완료 이벤트는 job_id별로 별도 수집
            this.events
                .slice()
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .forEach((e) => {
                    const { event_type, data, job_id, id, crew_type } = e;
                    const jobId = job_id || data?.job_id || id;
                    if (!usageMap[jobId]) usageMap[jobId] = [];

                    if (event_type === 'tool_usage_started') {
                        const toolName = data.tool_name || crew_type;
                        const entry = {
                            tool_name: toolName,
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

            // 1차 매칭: job_id 내에서 도구명이 같은 시작 항목을 LIFO로 찾아 완료 처리 + 결과 반영
            Object.keys(finishedEventsByJob).forEach((jobId) => {
                const list = usageMap[jobId] || [];
                finishedEventsByJob[jobId].forEach((fin) => {
                    for (let i = list.length - 1; i >= 0; i--) {
                        if (list[i].tool_name === fin.tool_name && list[i].status === 'searching') {
                            list[i].status = 'done';
                            list[i].info = fin.info;
                            fin.consumed = true;
                            break;
                        }
                    }
                });
            });

            // 폴백 처리: tool_usage_started 이벤트가 tool_usage_finished 이벤트보다 늦게 기록되는 등
            // 기록 순서 문제로 1차 매칭에 실패해 'searching' 상태로 남는 경우가 있다.
            // 같은 job_id에 tool_usage_finished 이벤트가 존재한다면, 도구명이 완전히 일치하지 않더라도
            // 결과(info)와 함께 무조건 완료로 표기한다 (finished 이벤트가 있다는 것은 결과도 있다는 뜻이므로).
            Object.keys(usageMap).forEach((jobId) => {
                const unconsumed = (finishedEventsByJob[jobId] || []).filter((f) => !f.consumed);
                if (unconsumed.length === 0) return;
                usageMap[jobId].forEach((tool) => {
                    if (tool.status !== 'searching') return;
                    if (unconsumed.length === 0) return;
                    let idx = unconsumed.findIndex((f) => f.tool_name === tool.tool_name);
                    if (idx === -1) idx = 0;
                    tool.status = 'done';
                    tool.info = unconsumed[idx].info;
                    unconsumed.splice(idx, 1);
                });
            });

            return usageMap;
        },
    },
    methods: {
        parseJson(data, fallback = {}) {
            if (!data) return fallback;
            try {
                return typeof data === 'string' ? JSON.parse(data) : data;
            } catch {
                return fallback;
            }
        },
        cleanString(str) {
            return str.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, '  ').replace(/\\\\/g, '\\');
        },
        removeFences(str) {
            return str
                .replace(/^```[a-zA-Z0-9]*\s*/, '')
                .replace(/```$/, '')
                .trim();
        },
        extractDisplayTextFromObject(obj) {
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
            const preferredKeys = ['message', 'summary', 'content', 'text', 'result'];
            const parts = [];
            for (const k of preferredKeys) {
                if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
                const v = obj[k];
                if (v === undefined || v === null) continue;
                parts.push(typeof v === 'object' ? JSON.stringify(v) : String(v));
            }
            return parts.join('\n').trim();
        },
        resolvePrimaryValue(output, crewType) {
            const type = crewType ? String(crewType).toLowerCase() : '';
            // planning 타입: 객체(JSON 포함)이고 explanation_text 키가 있으면 그 값만 표시
            if (type === 'planning') {
                let obj = output;
                if (typeof obj === 'string') {
                    const cleaned = this.cleanString(this.removeFences(obj));
                    const parsed = this.parseJson(cleaned, null);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        obj = parsed;
                    }
                }
                if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                    if (Object.prototype.hasOwnProperty.call(obj, 'explanation_text')) {
                        return obj.explanation_text;
                    }
                }
                // 키가 없으면 원래 로직대로 원본 유지
                return output;
            }
            // result 타입: 제출용 outputRaw는 그대로 두고, 표시용으로는 message/summary 우선
            if (type === 'result') {
                if (output && typeof output === 'object' && !Array.isArray(output)) {
                    const text = this.extractDisplayTextFromObject(output);
                    if (text) return text;
                }
                return output;
            }
            if (output && typeof output === 'object' && !Array.isArray(output)) {
                const keys = Object.keys(output);
                if (keys.length > 0) {
                    const text = this.extractDisplayTextFromObject(output);
                    if (text) return text;
                    return output[keys[0]];
                }
            }
            return output;
        },
    }
};
