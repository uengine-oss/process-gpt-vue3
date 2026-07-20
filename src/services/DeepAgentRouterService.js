/**
 * DeepAgents Agent Router API Service
 *
 * - deepagents 서버(별도 포트/서비스)로 라우팅/웜업/스트리밍 요청을 보낸다.
 * - gateway `process-gpt-deepagents` 라우트와 동일한 고정 prefix만 사용한다.
 */
const DEEP_AGENT_ROUTER_BASE_URL = '/process-gpt-deepagents';

class DeepAgentRouterService {
    constructor() {
        this.baseUrl = DEEP_AGENT_ROUTER_BASE_URL;
    }

    async healthCheck() {
        const response = await fetch(`${this.baseUrl}/health`);
        if (!response.ok) {
            throw new Error(`DeepAgentRouter health error: ${response.status}`);
        }
        return await response.json().catch(() => ({}));
    }

    async routeAgents(payload) {
        await this.healthCheck();
        const selected = payload.room_participant_ids.filter((id) => id !== payload.user_uid && payload.candidate_agent_ids.includes(id));
        return {
            should_intervene: true,
            selected_agent_ids: selected
        };
    }

    async warmup(agentId) {
        const response = await this.healthCheck();
        response['agent_id'] = agentId;
        return response;
    }

    async sendMessageStream(agentId, params, callbacks = {}, options = {}) {
        const { onAbort, onError } = callbacks;

        try {
            let meta = params.metadata;
            if (meta.agent_profile && meta.agent_profile.id !== 'process-gpt-agent') {
                meta.agent_profile = {
                    id: 'process-gpt-agent',
                    username: 'Process GPT Agent',
                    alias: '',
                    role: '',
                    goal: '',
                    persona: '',
                    description: '',
                    tools: '',
                    skills: []
                };
            }
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
                    file_count: Number.isFinite(params.file_count)
                        ? params.file_count
                        : Array.isArray(params.files)
                        ? params.files.length
                        : 0,
                    stream: true,
                    metadata: params.metadata || {}
                })
            });

            if (!response.ok) {
                throw new Error(`DeepAgentRouter stream error: ${response.status}`);
            }

            await this._consumeEventStream(response, callbacks);
        } catch (error) {
            if (error?.name === 'AbortError') {
                if (onAbort) onAbort(error);
                return;
            }
            if (onError) onError(error);
            else throw error;
        }
    }

    /**
     * 진행 중인 채팅 스트림에 재접속한다(재진입/새로고침 대응).
     * 활성 스트림이 없으면(백엔드가 실패 상태코드 또는 204/빈 응답으로 표현) 어떤 콜백도
     * 오류로 호출하지 않고 조용히 종료한다 — 이 메서드는 항상 베스트 에포트다.
     */
    async attachToStream(conversationId, callbacks = {}, options = {}) {
        const { onAbort } = callbacks;
        if (!conversationId) return;

        let response;
        try {
            response = await fetch(`${this.baseUrl}/chat/stream/attach`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                signal: options.signal,
                body: JSON.stringify({
                    conversation_id: conversationId,
                    tenant_id: options.tenantId || '',
                    user_jwt: options.userJwt || ''
                })
            });
        } catch (error) {
            if (error?.name === 'AbortError' && onAbort) onAbort(error);
            // 네트워크 오류 등은 "활성 스트림 없음"과 동일하게 조용히 종료
            return;
        }

        // 활성 스트림 없음(백엔드 계약: 실패 상태코드 또는 204/빈 바디) → 조용히 종료
        if (!response.ok || response.status === 204 || !response.body) {
            return;
        }

        try {
            await this._consumeEventStream(response, callbacks);
        } catch (error) {
            if (error?.name === 'AbortError' && onAbort) onAbort(error);
            // attach는 부가 기능이므로 실패해도 조용히 무시
        }
    }

    /** sendMessageStream/attachToStream 공용 SSE 파싱 루프 */
    async _consumeEventStream(response, callbacks = {}) {
        const {
            onToken,
            onToolStart,
            onToolEnd,
            onPlanTools,
            onPlanSkills,
            onPlanConnectors,
            onPlanTodos,
            onDone,
            onError,
            onMetadata,
            onOpenUi,
            onProcessResult,
            onFileArtifact
        } = callbacks;

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
                if (line.startsWith('data:')) {
                    const data = line.slice(5).replace(/^\s+/, '');
                    if (!data.trim()) continue;
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.type === 'meta' && parsed.conversation_id && onMetadata) {
                            onMetadata({ conversation_id: parsed.conversation_id, agent_id: parsed.agent_id || null });
                            continue;
                        }
                        switch (parsed.type) {
                            case 'snapshot':
                                // catch-up 스냅샷: 지금까지 누적된 전체 텍스트를 한 번에 전달
                                if (onToken) onToken(parsed.content);
                                break;
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
                            case 'plan_connectors':
                                if (onPlanConnectors) onPlanConnectors(Array.isArray(parsed.connectors) ? parsed.connectors : [], parsed);
                                break;
                            case 'tool_start': {
                                const toolRef = parsed.tool ?? parsed.tool_name ?? parsed.name;
                                if (onToolStart) onToolStart(toolRef, parsed.input ?? parsed.arguments ?? null, parsed);
                                break;
                            }
                            case 'tool_end':
                                if (onToolEnd) onToolEnd(parsed.output, parsed);
                                break;
                            case 'openui':
                                if (onOpenUi) onOpenUi(parsed);
                                break;
                            case 'process_result':
                                if (onProcessResult) onProcessResult(parsed.data || {}, parsed);
                                break;
                            case 'file_artifact':
                                if (onFileArtifact) onFileArtifact(parsed);
                                break;
                            case 'done':
                                if (onDone) onDone(parsed.content);
                                break;
                            case 'error':
                                if (onError) onError(new Error(parsed.content || parsed.error || parsed.message || 'Agent error'));
                                break;
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                }
            }
        }
    }
}

export default new DeepAgentRouterService();
export { DeepAgentRouterService };
