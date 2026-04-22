/**
 * Fixed-base Work Assistant Agent API Service
 *
 * 지정된 baseUrl로 스트리밍 요청을 보낸다.
 */
class FixedBaseWorkAssistantAgentService {
    constructor(baseUrl) {
        this.baseUrl = (baseUrl ?? '').toString().trim().replace(/\/$/, '') || '/agent';
    }

    async sendMessageStream(params, callbacks = {}, options = {}) {
        const {
            onToken,
            onToolStart,
            onToolEnd,
            onPlanTools,
            onPlanSkills,
            onPlanTodos,
            onDone,
            onError,
            onMetadata,
            onAskUser,
            onAbort,
            onAgentLog,
            onProcessStatus,
            onProcessPartial,
            onProcessPatch,
            onOpenUi
        } = callbacks;

        try {
            const response = await fetch(`${this.baseUrl}/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                signal: options.signal,
                body: JSON.stringify({
                    message: params.message,
                    // 클라이언트가 생성한 안정적인 메시지 UUID(서버 중복 저장/재시도 dedupe용)
                    message_uuid: params.message_uuid || null,
                    tenant_id: params.tenant_id,
                    user_uid: params.user_uid,
                    user_email: params.user_email,
                    user_name: params.user_name || params.user_email,
                    user_jwt: params.user_jwt || '',
                    conversation_id: params.conversation_id || null,
                    file: params.file || null,
                    files: Array.isArray(params.files) ? params.files : [],
                    file_count: Number.isFinite(params.file_count) ? params.file_count : Array.isArray(params.files) ? params.files.length : 0,
                    stream: true,
                    metadata: params.metadata || {}
                })
            });

            if (!response.ok) {
                throw new Error(`Agent API error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const rawLine of lines) {
                    const line = rawLine.replace(/\r$/, '');
                    if (!line.startsWith('data:')) continue;
                    const data = line.slice(5).replace(/^\s+/, '');
                    if (!data.trim()) continue;
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.type === 'meta' && parsed.conversation_id && onMetadata) {
                            onMetadata({ conversation_id: parsed.conversation_id });
                            continue;
                        }
                        switch (parsed.type) {
                            case 'token':
                                if (onToken) onToken(parsed.content);
                                break;
                            case 'plan_tools':
                                if (onPlanTools) onPlanTools(Array.isArray(parsed.tools) ? parsed.tools : [], parsed);
                                break;
                            case 'plan_skills':
                                if (onPlanSkills) onPlanSkills(Array.isArray(parsed.skills) ? parsed.skills : [], parsed);
                                break;
                            case 'plan_todos':
                                if (onPlanTodos) onPlanTodos(Array.isArray(parsed.todos) ? parsed.todos : [], parsed);
                                break;
                            case 'tool_start': {
                                const toolRef = parsed.tool ?? parsed.tool_name ?? parsed.name;
                                if (onToolStart) onToolStart(toolRef, parsed.input ?? parsed.arguments ?? null, parsed);
                                break;
                            }
                            case 'tool_end':
                                if (onToolEnd) onToolEnd(parsed.output, parsed);
                                break;
                            case 'ask_user':
                                if (onAskUser) onAskUser(parsed.question || parsed);
                                break;
                            case 'agent_log':
                                if (onAgentLog) onAgentLog(parsed);
                                break;
                            case 'process_status':
                                if (onProcessStatus) onProcessStatus(parsed);
                                break;
                            case 'process_partial':
                                if (onProcessPartial) onProcessPartial(parsed);
                                break;
                            case 'process_patch':
                                if (onProcessPatch) onProcessPatch(parsed);
                                break;
                            case 'openui':
                                if (onOpenUi) onOpenUi(parsed);
                                break;
                            case 'done':
                                if (onDone) onDone(parsed.content);
                                break;
                            case 'error':
                                if (onError) onError(new Error(parsed.error || parsed.message || 'Agent error'));
                                break;
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                }
            }
        } catch (error) {
            if (error?.name === 'AbortError') {
                if (onAbort) onAbort(error);
                return;
            }
            if (onError) onError(error);
            else throw error;
        }
    }
}

export default FixedBaseWorkAssistantAgentService;

