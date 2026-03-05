/**
 * Agent Router API Service
 *
 * - agent-router를 통해 agent_id별 런타임에 연결/프록시
 * - warmup: 파드 기동/Ready 대기
 * - chat/stream: SSE 스트리밍
 */
const normalizeBaseUrl = (value, fallback) => {
    const v = (value ?? '').toString().trim();
    if (!v || v === '/') return fallback;
    return v.endsWith('/') ? v.slice(0, -1) : v;
};

const AGENT_ROUTER_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_AGENT_ROUTER_BASE_URL, '/agent-router');

class AgentRouterService {
    constructor() {
        this.baseUrl = AGENT_ROUTER_BASE_URL;
    }

    /**
     * Decide which agents should respond for a message (router-side LLM).
     * @param {Object} payload
     * @returns {Promise<Object>} routing result JSON
     */
    async routeAgents(payload) {
        const response = await fetch(`${this.baseUrl}/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload || {})
        });
        if (!response.ok) {
            throw new Error(`AgentRouter route error: ${response.status}`);
        }
        return await response.json();
    }

    async warmup(agentId) {
        const response = await fetch(`${this.baseUrl}/${agentId}/warmup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
        if (!response.ok) {
            throw new Error(`AgentRouter warmup error: ${response.status}`);
        }
        return await response.json();
    }

    async sendMessageStream(agentId, params, callbacks = {}, options = {}) {
        const { onToken, onToolStart, onToolEnd, onDone, onError, onMetadata, onAbort } = callbacks;

        try {
            const response = await fetch(`${this.baseUrl}/${agentId}/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                },
                signal: options.signal,
                body: JSON.stringify({
                    message: params.message,
                    tenant_id: params.tenant_id,
                    user_uid: params.user_uid,
                    user_email: params.user_email,
                    user_name: params.user_name || params.user_email,
                    user_jwt: params.user_jwt || '',
                    conversation_id: params.conversation_id || null,
                    stream: true,
                    metadata: params.metadata || {}
                })
            });

            if (!response.ok) {
                throw new Error(`AgentRouter stream error: ${response.status}`);
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

                for (const line of lines) {
                    // SSE line format: "data: <json>" (space optional)
                    if (line.startsWith('data:')) {
                        const data = line.slice(5).replace(/^\s+/, '');
                        if (!data.trim()) continue;
                        try {
                            const parsed = JSON.parse(data);
                            // work-assistant-agent stream format: {type:'token'|'tool_start'|'tool_end'|'done'|'error', ...}
                            switch (parsed.type) {
                                case 'token':
                                    if (onToken) onToken(parsed.content);
                                    break;
                                case 'tool_start':
                                    if (onToolStart) onToolStart(parsed.tool, parsed.input);
                                    break;
                                case 'tool_end':
                                    if (onToolEnd) onToolEnd(parsed.output);
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
                    } else if (line.startsWith('event: ')) {
                        // EventSourceResponse metadata line (optional)
                        const eventType = line.slice(7).trim();
                        if (eventType === 'metadata') {
                            // next data: line will carry metadata json; handled above
                        }
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

export default new AgentRouterService();
export { AgentRouterService };

