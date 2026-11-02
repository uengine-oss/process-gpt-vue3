/**
 * LLM Configuration - Central model management
 * 모델을 교체하려면 이 파일만 수정하면 됨
 */
export const LLM_CONFIG = {
    default: {
        modelConfig: {
            temperature: 1,
            top_p: 0.9,
            frequency_penalty: 0,
            presence_penalty: 0
        }
    },
    summary: {
        modelConfig: {
            temperature: 0.7,
            top_p: 0.9,
            frequency_penalty: 0,
            presence_penalty: 0
        }
    },
    // 폼 디자이너(FormDesignGenerator). 추론 모델(gpt-5)은 기본 추론 강도로 첫 토큰까지 65~83초가 걸렸다.
    // 같은 요청을 minimal로 보내면 첫 토큰 2.8초·전체 7~9초였고 요청한 필드는 빠짐없이 들어왔다(2026-10-12 측정).
    // 추론 모델이 아니면 LiteLLM(drop_params: true)이 버린다 — frentis-ai-model에서 확인.
    formDesign: {
        modelConfig: {
            temperature: 1,
            top_p: 0.9,
            frequency_penalty: 0,
            presence_penalty: 0,
            reasoning_effort: 'minimal'
        }
    }
};

/**
 * Get LLM configuration for a specific purpose
 * @param {string} purpose - 'default' | 'summary' | etc.
 * @returns {Object} LLM configuration object
 */
export function getLLMConfig(purpose = 'default') {
    return LLM_CONFIG[purpose] || LLM_CONFIG.default;
}
