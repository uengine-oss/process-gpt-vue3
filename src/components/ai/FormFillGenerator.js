import AIGenerator from './AIGenerator';

/**
 * 받아쓴 말로 업무 양식 칸을 채우는 LLM 호출.
 *
 * 「에이전트에 맡기기」 빠른 초안(WorkItemAgentGenerator)과 같은 서버 경로
 * (/completion/langchain-chat/messages)를 그대로 쓴다. 요청 글은 src/shared/dictation 의
 * buildFillMessages 가 만든다.
 *
 * 다른 점 하나: 서버 연결 확인이 실패해도 alert 를 띄우지 않는다. 업무 화면 안 한 줄로 알려야
 * 하므로 실패는 요청 오류(onError)로만 받는다. 401 이면 세션을 갱신하는 부분은 그대로 쓴다.
 */
export default class FormFillGenerator extends AIGenerator {
    constructor(client, messages) {
        // 모델 설정은 기본값 그대로 — reasoning_effort 를 실으면 추론 모델이 아닌 설치본(VM)이 빈 답(200)을 돌려줬다(2026-11-11)
        super(client, { isStream: true, previousMessages: messages });
    }

    async checkBackendConnection() {
        await super.checkBackendConnection();
        return true;
    }
}

/** 이 시간 안에 답이 없으면 실패로 본다 — 멈춤을 누른 사람이 막연히 기다리지 않게. */
export const FORM_FILL_TIMEOUT_MS = 60000;

/**
 * 요청 글을 보내고 LLM 답(글)을 돌려준다.
 *
 * @param {Array<{role:string,content:string}>} messages
 * @returns {Promise<string>}
 */
export function requestFormFill(messages, { timeoutMs = FORM_FILL_TIMEOUT_MS } = {}) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (fn, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fn(value);
        };
        const client = {
            // 빈 답은 서버 문제다 — 「말한 내용에서 못 찾았다」 로 알리면 사용자가 말을 바꿔 다시 하게 된다
            onGenerationFinished: (model) => (model ? settle(resolve, model) : settle(reject, new Error('empty reply'))),
            onError: (error) => settle(reject, new Error(error?.message || 'form fill failed'))
        };
        const generator = new FormFillGenerator(client, messages);
        const timer = setTimeout(() => {
            try {
                generator.stop();
            } catch (_e) {
                // 이미 끝난 요청
            }
            settle(reject, new Error('timeout'));
        }, timeoutMs);
        generator.generate();
    });
}
