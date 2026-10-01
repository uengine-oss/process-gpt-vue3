/**
 * DeepAgents Agent Router API Service
 *
 * - deepagents 서버(별도 포트/서비스)로 라우팅/웜업/스트리밍 요청을 보낸다.
 * - gateway `process-gpt-deepagents` 라우트와 동일한 고정 prefix만 사용한다.
 * - codex 서버도 같은 chat/stream 계약이라 baseUrl 만 바꿔 이 클래스를 재사용한다.
 *   (codex 도 /chat/stream/attach · /chat/stop 을 제공한다. 없는 런타임을 붙일 때만
 *   supportsStreamAttach=false 로 재접속 호출을 끈다.)
 */
const DEEP_AGENT_ROUTER_BASE_URL = '/process-gpt-deepagents';

import { buildAgentHeaders } from './agentRequestHeaders';
import { assertAiEnabled } from '@/utils/aiFeatureGate';

class DeepAgentRouterService {
    constructor(baseUrl, { supportsStreamAttach = true } = {}) {
        this.baseUrl = (baseUrl ?? '').toString().trim().replace(/\/$/, '') || DEEP_AGENT_ROUTER_BASE_URL;
        this.supportsStreamAttach = supportsStreamAttach;
    }

    async healthCheck() {
        const response = await fetch(`${this.baseUrl}/health`);
        if (!response.ok) {
            throw new Error(`DeepAgentRouter health error: ${response.status}`);
        }
        return await response.json().catch(() => ({}));
    }

    async routeAgents(payload) {
        assertAiEnabled();
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
        assertAiEnabled();
        const { onAbort, onError } = callbacks;

        try {
            // 실제 응답 에이전트의 agent_profile(id/username 등)을 그대로 백엔드에 전달한다.
            // 예전에는 여기서 'process-gpt-agent'가 아닌 모든 agent_profile을 범용 프로필로
            // 덮어썼는데, 그 결과 백엔드가 chats row를 항상 agentId="process-gpt-agent"로
            // 저장하게 되어 프론트의 activeStreams placeholder(실제 agentId)와 realtime INSERT가
            // 매칭되지 않고, 스트리밍 중이던 말풍선이 사라졌다가 별도 정체성의 메시지로
            // "툭" 나타나는 원인이 되었다.
            const response = await fetch(`${this.baseUrl}/chat/stream`, {
                method: 'POST',
                headers: buildAgentHeaders(params),
                signal: options.signal,
                body: JSON.stringify({
                    message: params.message,
                    // 클라이언트가 생성한 안정적인 "사용자" 메시지 UUID(서버 중복 저장/재시도 dedupe용)
                    message_uuid: params.message_uuid || null,
                    // 클라이언트가 스트리밍 중 미리 만들어 낙관적으로 저장해 둔 "assistant 응답" row의
                    // uuid. SDK가 최종 저장 시 이 uuid로 upsert하면 서버가 별도 uuid로 새 row를 또
                    // 만들지 않아, 같은 턴이 chats 테이블에 두 번 남는 걸 막는다. message_uuid(사용자
                    // 메시지 uuid)와는 다른 값이어야 한다 — 섞어 쓰면 assistant 응답이 user 메시지
                    // row를 덮어쓴다.
                    response_message_uuid: params.response_message_uuid || null,
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
     * 진행 중인 채팅 턴을 **서버에서** 중지한다.
     *
     * 프론트의 abort 는 자기 fetch 만 끊을 뿐이라 서버의 그래프 실행은 계속 돌아간다
     * (LLM/도구 호출이 그대로 소비되고 산출물까지 만들어진다). 중지 버튼이 실제로
     * 멈추게 하려면 이 호출이 필요하다. 베스트 에포트 — 실패해도 예외를 던지지 않는다.
     */
    async stopStream(conversationId, options = {}) {
        if (!conversationId) return { stopped: false };
        try {
            const response = await fetch(`${this.baseUrl}/chat/stop`, {
                method: 'POST',
                headers: buildAgentHeaders({ user_jwt: options.userJwt || '', tenant_id: options.tenantId || '' }),
                body: JSON.stringify({
                    conversation_id: conversationId,
                    tenant_id: options.tenantId || '',
                    user_jwt: options.userJwt || ''
                })
            });
            if (!response.ok) return { stopped: false };
            return await response.json().catch(() => ({ stopped: false }));
        } catch (error) {
            return { stopped: false };
        }
    }

    /**
     * 진행 중인 턴의 **방향을 바꾼다**(스티어링).
     *
     * 중지와 다르다. 중지는 실행을 죽이고 새 메시지는 그 턴을 대체하므로, 어느 쪽이든
     * 지금까지 한 작업이 사라진다. 스티어링은 맥락을 유지한 채 지시만 바꿔 얹는다.
     *
     * 받았다(`accepted`)는 반영됐다는 뜻이 아니다 — 그 시점의 에이전트는 아직 원래
     * 지시대로 도구를 돌리고 있다. 실제 반영은 SSE 로 오는 `steer_applied` 가 알린다.
     * 두 가지를 한 번에 표시하면 사용자는 반영되지 않은 결과를 반영된 것으로 읽는다.
     *
     * 실패는 예외가 아니라 `{ accepted: false, reason }` 이다. 대표적인 사유:
     *   - `unsupported`           : 이 에이전트가 스티어링을 구현하지 않았다(501)
     *   - `no_active_turn`        : 돌고 있는 턴이 없다(이미 끝났다)
     *   - `awaiting_human_input`  : 에이전트가 질문에 대한 답을 기다리는 중이다
     * 호출한 쪽은 사유를 보고 평범한 새 메시지로 되돌릴 수 있다.
     */
    async steerStream(conversationId, message, options = {}) {
        const text = (message ?? '').toString().trim();
        if (!conversationId) return { accepted: false, reason: 'no_conversation' };
        if (!text) return { accepted: false, reason: 'empty_message' };
        try {
            const response = await fetch(`${this.baseUrl}/chat/steer`, {
                method: 'POST',
                headers: buildAgentHeaders({ user_jwt: options.userJwt || '', tenant_id: options.tenantId || '' }),
                body: JSON.stringify({
                    // 동작 유형을 본문에도 싣는다 — 같은 payload 를 /chat/stream 으로 보내도
                    // 동일하게 처리된다(엔드포인트를 하나만 아는 클라이언트를 위해).
                    action: 'steer',
                    conversation_id: conversationId,
                    message: text,
                    tenant_id: options.tenantId || '',
                    user_uid: options.userUid || '',
                    user_jwt: options.userJwt || '',
                    metadata: options.metadata || {}
                })
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                return { accepted: false, reason: body?.reason || `http_${response.status}`, detail: body?.detail || '' };
            }
            return body;
        } catch (error) {
            return { accepted: false, reason: 'network_error', detail: error?.message || '' };
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
        if (!this.supportsStreamAttach) return;

        let response;
        try {
            response = await fetch(`${this.baseUrl}/chat/stream/attach`, {
                method: 'POST',
                headers: buildAgentHeaders({ user_jwt: options.userJwt || '', tenant_id: options.tenantId || '' }),
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
        // 활성 스트림 없음은 200 + JSON({active:false})으로 응답한다(SSE 아님).
        // text/event-stream이 아니면 파싱을 시도하지 않고 조용히 종료한다.
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream')) {
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
            onFileArtifact,
            onDraft,
            onSteerAccepted,
            onSteerApplied
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
                                // 접수만 되고 아직 반영되지 않은 수정 지시. 이게 없으면 재접속한
                                // 화면에는 지시를 보낸 흔적이 사라져 사용자가 또 보낸다.
                                if (onSteerAccepted && Array.isArray(parsed.pending_steers)) {
                                    parsed.pending_steers.forEach((s) => onSteerAccepted(s));
                                }
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
                            // 작성 중인 문서의 현재 모습. 최종 산출물이 아니므로
                            // done.files 와 달리 다운로드 링크를 싣지 않는다.
                            case 'draft':
                                if (onDraft) onDraft(parsed.file || parsed);
                                break;
                            case 'done':
                                // parsed 를 통째로 넘긴다 — done.files(산출물 다운로드 링크)가
                                // content 만 넘기던 시절에 조용히 버려지고 있었다.
                                if (onDone) onDone(parsed.content, parsed);
                                break;
                            // 수정 지시를 받았다. 아직 반영은 아니다 — 이 이벤트로 완료를
                            // 표시하면 사용자는 반영되지 않은 결과를 반영된 것으로 읽는다.
                            case 'steer_accepted':
                                if (onSteerAccepted) onSteerAccepted(parsed);
                                break;
                            // 수정 지시가 실제로 다음 판단에 들어갔다.
                            case 'steer_applied':
                                if (onSteerApplied) onSteerApplied(parsed);
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
