/**
 * 메인 채팅 진입점 — 새 대화를 만들고 그 방으로 보낸다.
 *
 * 왜 여기 있는가
 *   원래 정의 체계도(ProcessDefinitionMap) 안에만 있던 흐름이다. 그런데 이
 *   진입점은 그 화면만의 것이 아니다 — 휴대폰의 첫 화면도 같은 일을 해야 한다.
 *   두 곳에 같은 것을 두면 한쪽만 고쳐지므로, 옮겨서 하나로 쓴다.
 *
 * 무엇을 하는가
 *   방을 만들고, 첫 글과 첨부를 저장하고, 방 이름은 배경에서 요약해 붙이고,
 *   ChatRoomPage 가 이어받을 수 있도록 chatKickoff 를 남긴 뒤 /chat 으로 옮긴다.
 *   첫 글을 여기서 보내지 않는 이유는, 보내는 도중 화면이 바뀌면 스트리밍으로
 *   돌아오는 답을 받을 곳이 사라지기 때문이다.
 */
import BackendFactory from '@/components/api/BackendFactory';
import { processGptAgent } from '@/constants/processGptAgent';
import { getTenantId } from '@/utils/tenant';

const backend = BackendFactory.createBackend();

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function normalizeParticipant(p) {
    if (!p) return null;
    return {
        id: p?.id || p?.uid || null,
        email: p?.email || null,
        username: p?.username || p?.name || p?.email || '',
        profile: p?.profile || null,
        agent_type: p?.agent_type || p?.agentType || null,
        is_agent: p?.is_agent ?? p?.isAgent ?? null
    };
}

/** 보낼 것이 하나라도 있는가. 빈 전송을 막는다. */
export function hasSomethingToSend(message) {
    const files = Array.isArray(message?.files) ? message.files : message?.file ? [message.file] : [];
    const hasImages = Array.isArray(message?.images) && message.images.length > 0;
    return !!(message && (message.text || files.length > 0 || hasImages));
}

export async function startMainChat(message, { currentUser, router, eventBus } = {}) {
    const userInfo = currentUser || (await backend.getUserInfo());
    const me = normalizeParticipant(userInfo);

    const text = (message?.text || '').toString().trim();
    const hasImages = Array.isArray(message?.images) && message.images.length > 0;
    const messageFiles = Array.isArray(message?.files) ? message.files.filter(Boolean) : message?.file ? [message.file] : [];
    const hasFile = messageFiles.length > 0;
    const primaryFile = messageFiles[0] || null;
    const orchestration = (message?.orchestration || '').toString().trim() || 'langchain-react';

    const roomId = uuid();
    const nowIso = new Date().toISOString();
    const roomName = '새 대화';
    // 채팅방 생성/이동을 지연시키지 않고, 첫 요청을 요약한 이름은 백그라운드에서 생성한다.
    const generatedNamePromise = text ? backend.generateSemanticName('chat', text) : null;

    // raw File 객체가 있으면 ChatRoomPage에서 memento 업로드하도록 임시 전달
    // (File 객체는 sessionStorage에 직렬화 불가 → window 임시 변수 사용)
    const rawFiles = Array.isArray(message?.rawFiles) ? message.rawFiles.filter(Boolean) : [];
    if (rawFiles.length > 0) {
        window.__pendingMementoFiles = { roomId, files: rawFiles };
    }

    const participants = [
        me,
        // 가상 에이전트는 DB에 저장되지 않으며 방 참가자에만 포함
        normalizeParticipant(processGptAgent) || processGptAgent
    ].filter(Boolean);

    const room = {
        id: roomId,
        name: roomName,
        // primary_agent_id는 DB에 실제로 존재하는 에이전트가 아닐 수 있어 저장하지 않음
        participants,
        message: { msg: 'NEW', type: 'text', createdAt: nowIso },
        // chat_rooms.context에 orchestration 저장 (tools/skills/todos와 충돌 방지: 최상위 키로 둔다)
        context: {
            orchestration,
            auto_name_pending: !!generatedNamePromise,
            updatedAt: nowIso
        }
    };

    await backend.putObject('db://chat_rooms', room);

    const msgUuid = uuid();
    const msg = {
        uuid: msgUuid,
        role: 'user',
        // 첨부만 있을 때 자동 문구를 넣지 않음 (메시지는 첨부 UI로만 표시)
        content: text || '',
        timeStamp: nowIso,
        email: userInfo?.email || null,
        name: userInfo?.username || userInfo?.name || userInfo?.email || '',
        userName: userInfo?.username || userInfo?.name || userInfo?.email || '',
        images: message?.images || [],
        pdfFile: primaryFile,
        pdfFiles: messageFiles
    };

    await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: roomId, messages: msg });

    // 첨부 파일은 chat_attachments 테이블에 저장 (ChatRoomPage로 넘어가기 전에 선저장)
    // Raw files are uploaded and saved by ChatRoomPage. Saving placeholder
    // metadata here creates a second attachment row after the upload finishes.
    if (hasFile && rawFiles.length === 0) {
        try {
            const tenantId = getTenantId();
            const userName = userInfo?.name || userInfo?.username || userInfo?.email || '';
            for (const f of messageFiles) {
                const fileName = (f?.fileName || f?.name || '').toString().trim();
                const filePath = (f?.fileUrl || f?.url || f?.publicUrl || f?.fullPath || f?.path || '').toString() || '';
                if (!fileName && !filePath) continue;
                // eslint-disable-next-line no-await-in-loop
                await backend.putObject('db://chat_attachments', {
                    id: uuid(),
                    file_name: fileName || (filePath ? String(filePath).split('/').pop() : '') || 'attachment',
                    file_path: filePath,
                    chat_room_id: roomId,
                    user_name: userName,
                    tenant_id: tenantId
                });
            }
        } catch (e) {
            // ignore
        }
    }
    // last message preview는 첨부 요약을 사용 (content는 비워둠)
    const fileName = (primaryFile?.name || primaryFile?.fileName || '').toString();
    const preview =
        (text || '').substring(0, 50) ||
        (hasFile ? (messageFiles.length > 1 ? `${fileName} 외 ${messageFiles.length - 1}개` : fileName).substring(0, 50) : '') ||
        (hasImages ? `이미지 ${(message?.images || []).length || 0}장` : '');
    room.message = { msg: (preview || '').substring(0, 50), type: 'text', createdAt: nowIso };
    await backend.putObject('db://chat_rooms', room);

    if (generatedNamePromise) {
        generatedNamePromise
            .then(async (generatedName) => {
                if (!generatedName) return;

                // 응답 스트리밍 중 변경된 방 데이터를 덮어쓰지 않도록 최신 context를 합쳐 필요한 필드만 갱신한다.
                const supabase = window.$supabase;
                if (supabase) {
                    const { data: latestRoom } = await supabase.from('chat_rooms').select('context').eq('id', roomId).maybeSingle();
                    const { error } = await supabase
                        .from('chat_rooms')
                        .update({
                            name: generatedName,
                            context: {
                                ...(latestRoom?.context || room.context || {}),
                                auto_name_pending: false
                            }
                        })
                        .eq('id', roomId);
                    if (error) throw error;
                } else {
                    const latestRoom = await backend.getObject(`db://chat_rooms/${roomId}`, { key: 'id' });
                    await backend.putObject('db://chat_rooms', {
                        ...(latestRoom || room),
                        name: generatedName,
                        context: {
                            ...(latestRoom?.context || room.context || {}),
                            auto_name_pending: false
                        }
                    });
                }
                eventBus.emit('chat-rooms-updated');
            })
            .catch(() => {});
    }

    // ChatRoomPage에서 첫 메시지에 대한 에이전트 응답만 kick-off 하도록 sessionStorage에 전달
    try {
        sessionStorage.setItem(
            `chatKickoff:${roomId}`,
            JSON.stringify({
                roomId,
                msgUuid,
                // 서버 dedupe용: 클라이언트에서 생성한 user 메시지 UUID
                message_uuid: msgUuid,
                text,
                images: message?.images || [],
                file: primaryFile,
                files: messageFiles,
                orchestration,
                // 지식 선택은 전역 스토어(useKnowledgeSelectionStore)가 단일 소스라 kickoff 로 안 넘긴다.
                // 스토어는 앱 전역이라 메인→채팅 이동에도 살아있고, 새 방이 bindRoom 으로 이월받는다.
                createdAt: nowIso
            })
        );
    } catch (e) {
        // ignore
    }

    // definition-map 패널은 열지 않고 /chat으로 이동
    await router.push({ path: '/chat', query: { roomId } });
}
