import { defineStore } from 'pinia';

/**
 * 지식베이스 선택 단일 소스(single source of truth).
 *
 * 왜 존재하나: 예전엔 선택값(문서/폴더)이 화면·컴포넌트마다 자기 복사본을 들고
 * props/events/sessionStorage(kickoff)/DB-context 로 손수 베껴 넘겼다. 그래서
 *  (1) 필드 추가 시 6~7곳을 다 고쳐야 하고(하나 빠뜨리면 그 진입점만 조용히 유실),
 *  (2) "선택 있음 = 문서 개수>0" 가정이 곳곳에 박혀 폴더-only(문서 0개) 도입에 다 깨졌다.
 * 이 스토어로 상태·직렬화·방 바인딩을 한 곳에 모아 그 재발을 없앤다.
 *
 * - docs   : 개별 선택 파일(emit shape: id/name/file_name/folderPath/sourceRef/docRole ...)
 * - folders: 폴더째 선택 경로들(['A/B/C', ...]) — deepagents 는 folder_paths 로 스코프
 * - sourceRoomId: 이 선택이 '속한' 방. null = 아직 방에 안 묶임(메인화면에서 고른 이월분)
 */

type KnowledgeDoc = Record<string, any>;

interface State {
    docs: KnowledgeDoc[];
    folders: string[];
    sourceRoomId: string | null;
}

export const useKnowledgeSelectionStore = defineStore('knowledgeSelection', {
    state: (): State => ({
        docs: [],
        folders: [],
        sourceRoomId: null,
    }),
    getters: {
        hasSelection: (s): boolean => (s.docs?.length || 0) + (s.folders?.length || 0) > 0,
        count: (s): number => (s.docs?.length || 0) + (s.folders?.length || 0),
        docIds: (s): string[] => (s.docs || []).map((d) => d?.id).filter(Boolean),

        /** deepagents 전송용 metadata (snake_case). 폴더째 선택은 folder_paths 로 스코프. */
        requestMetadata(): { knowledge_docs: KnowledgeDoc[]; knowledge_folders: string[] } {
            return {
                knowledge_docs: (this.docs || [])
                    .filter((d) => d && d.sourceRef)
                    .map((d) => ({
                        id: d.sourceRef,
                        source_type: d.sourceType || 'drive',
                        file_name: d.file_name || d.name || '',
                        mime_type: d.mimeType || '',
                        folder_path: d.folderPath || '',
                        // 역할(양식/사업개요 등) — 백엔드 초안 템플릿/자료 구분에 필수
                        doc_role: d.docRole || d.doc_role || 'content',
                    })),
                knowledge_folders: (this.folders || []).filter(
                    (p) => typeof p === 'string' && p.trim()
                ),
            };
        },

        /** 방 컨텍스트(chat_rooms.context) 저장/복원용(camelCase). */
        contextPayload(): { knowledgeDocs: KnowledgeDoc[]; knowledgeFolders: string[] } {
            return {
                knowledgeDocs: Array.isArray(this.docs) ? this.docs : [],
                knowledgeFolders: Array.isArray(this.folders) ? this.folders : [],
            };
        },
    },
    actions: {
        /** 피커 confirm 결과 반영. 새 선택은 '아직 방에 안 묶인(null)' 상태 → 다음에 진입한 방이 채택한다.
         *  (메인화면에서 고른 선택이 새로 만든 방으로 이월되게 하는 핵심.) */
        setSelection(docs: KnowledgeDoc[] | null, folders: string[] | null): void {
            this.docs = Array.isArray(docs) ? docs : [];
            this.folders = Array.isArray(folders) ? folders : [];
            this.sourceRoomId = null;
        },
        /** 방-내에서 선택이 확정돼 그 방 소유로 표시(ChatRoomPage 가 저장 후 호출). */
        claimRoom(roomId: string): void {
            if (roomId) this.sourceRoomId = roomId;
        },
        clear(): void {
            this.docs = [];
            this.folders = [];
        },
        /**
         * 채팅방(/chat)을 벗어나 메인/다른 화면으로 나갈 때 호출.
         * 특정 방에 묶인(sourceRoomId!=null) 선택은 비워, 이전 방의 체크가 메인화면이나
         * 다른 방으로 새는 것을 막는다. 방→방 전환은 bindRoom 이 처리하므로 여기선 방 밖으로
         * 나가는 경우만 다룬다. 아직 방에 안 묶인(null) '메인에서 갓 고른 이월분' 은 유지한다
         * (새 방 생성 시 채택돼야 하므로).
         */
        resetIfRoomBound(): void {
            if (this.sourceRoomId === null) return;
            this.docs = [];
            this.folders = [];
            this.sourceRoomId = null;
        },
        loadFromContext(ctx: any): void {
            const c = ctx && typeof ctx === 'object' ? ctx : {};
            this.docs = Array.isArray(c.knowledgeDocs) ? c.knowledgeDocs : [];
            this.folders = Array.isArray(c.knowledgeFolders) ? c.knowledgeFolders : [];
        },

        /**
         * 방 진입/전환 시 바인딩. 이월(메인→새 방)과 방 전환을 한 곳에서 결정한다.
         * @returns true 면 '이월분을 이 방으로 채택' → 호출측이 방 컨텍스트에 저장해야 함.
         */
        bindRoom(roomId: string, ctx: any): boolean {
            if (!roomId) return false;
            if (this.sourceRoomId === roomId) return false; // 이미 이 방
            const c = ctx && typeof ctx === 'object' ? ctx : {};
            const ctxHas =
                (Array.isArray(c.knowledgeDocs) && c.knowledgeDocs.length > 0) ||
                (Array.isArray(c.knowledgeFolders) && c.knowledgeFolders.length > 0);
            if (ctxHas) {
                // 기존 방의 저장된 선택 로드
                this.loadFromContext(c);
                this.sourceRoomId = roomId;
                return false;
            }
            if (this.sourceRoomId === null && this.hasSelection) {
                // 메인화면에서 고른 선택을 새 방으로 이월 — 유지 + 채택
                this.sourceRoomId = roomId;
                return true;
            }
            // 다른 방으로 전환인데 대상 방에 선택 없음 → 비운다(이전 방 선택이 새 방으로 새지 않게)
            this.clear();
            this.sourceRoomId = roomId;
            return false;
        },
    },
});
