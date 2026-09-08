import { defineStore } from 'pinia';

/**
 * 메인 화면에서 고른 폴더를 "아직 없는 대화"로 이월하기 위한 대기소.
 *
 * 왜 필요한가: codex 원본 폴더는 대화 워크스페이스(conversation_id)에 올라간다. 그런데
 * 사용자는 폴더를 **먼저** 고르고 대화를 시작한다(Claude Desktop/Codex app 도 그 순서다).
 * 메인 화면에는 방이 없으니 그 시점엔 올릴 곳이 없다. 그래서 File 객체를 들고 있다가
 * 방이 생기면 그때 올린다.
 *
 * File 을 그대로 들고 있어도 되는 이유: 메인→채팅은 SPA 라우트 전환이라 JS 힙이 유지된다.
 * (새로고침하면 사라지는데, 그건 사용자가 다시 고르는 게 맞다 — 디스크를 못 읽으니까.)
 *
 * 지식 선택([[knowledge-selection-plumbing]])의 이월과 같은 문제를 같은 방식으로 푼다.
 */

interface State {
    /** 아직 방이 없어 못 올린 파일들. 올리고 나면 비운다. */
    pendingFiles: File[];
    /** 사용자가 고른 최상위 폴더명 (안내 문구용). */
    pendingName: string;
    /** 업로드 진행 중 여부 (전송 게이트·버튼 비활성화용). */
    uploading: boolean;
}

function topLevelName(files: File[]): string {
    for (const file of files) {
        const relative = ((file as any).webkitRelativePath || '').replace(/\\/g, '/');
        const head = relative.split('/')[0];
        if (head) return head;
    }
    return '';
}

/**
 * 진행 중인 업로드. Promise 는 직렬화 대상이 아니라 state 밖(모듈 스코프)에 둔다.
 *
 * 이게 필요한 이유: 폴더 업로드는 배치로 나뉘어 수 초~수십 초 걸리는데, 그 사이에
 * 첫 메시지가 나가면 턴이 **덜 올라온 폴더**로 시작한다. 실제로 877개 폴더에서
 * 매니페스트에 40개만 잡힌 채 턴이 돌았다. 에이전트가 "40개뿐"으로 판단해 탐색을
 * 일찍 접거나 "자료에 없다"고 잘못 결론낼 수 있어, 전송 측이 이걸 기다리게 한다.
 */
let inFlight: Promise<unknown> | null = null;

export const useCodexFolderStore = defineStore('codexFolder', {
    state: (): State => ({
        pendingFiles: [],
        pendingName: '',
        uploading: false
    }),
    getters: {
        hasPending: (s): boolean => s.pendingFiles.length > 0,
        pendingCount: (s): number => s.pendingFiles.length,
        /** 전송을 막아야 하는 상태 — 대기 중이거나 올리는 중. */
        blocksSend: (s): boolean => s.uploading || s.pendingFiles.length > 0
    },
    actions: {
        setPending(files: File[]): void {
            this.pendingFiles = Array.isArray(files) ? files : [];
            this.pendingName = topLevelName(this.pendingFiles);
        },
        /** 올리려고 꺼낸다. 꺼내는 즉시 비워 같은 폴더가 두 방에 올라가지 않게 한다. */
        takePending(): File[] {
            const files = this.pendingFiles;
            this.pendingFiles = [];
            this.pendingName = '';
            return files;
        },
        /** 업로드 시작을 등록한다. 전송 측은 waitForUpload() 로 이걸 기다린다. */
        beginUpload(task: Promise<unknown>): Promise<unknown> {
            this.uploading = true;
            const settled = task.finally(() => {
                this.uploading = false;
                if (inFlight === settled) inFlight = null;
            });
            inFlight = settled;
            return settled;
        },
        /**
         * 업로드가 끝날 때까지 기다린다. 이월 대기분이 아직 업로드로 넘어가지 않았을 수도
         * 있어(라우트 전환 직후) 잠깐 그것도 기다린다. 실패해도 전송을 막지는 않는다 —
         * 폴더 없이라도 대화는 되어야 한다.
         */
        async waitForUpload(timeoutMs = 300000): Promise<void> {
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
                if (inFlight) {
                    await inFlight.catch(() => {});
                    continue;
                }
                if (!this.pendingFiles.length) return;
                // 대기분이 있는데 아직 업로드가 시작되지 않았다 — 워처가 곧 집어간다.
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        },
        clear(): void {
            this.pendingFiles = [];
            this.pendingName = '';
        }
    }
});
