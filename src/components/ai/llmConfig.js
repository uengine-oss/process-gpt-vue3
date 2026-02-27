/**
 * LLM Configuration - Central model management
 * 모델을 교체하려면 이 파일만 수정하면 됨
 */
export const LLM_CONFIG = {
    default: {
        vendor: 'openai',
        model: 'gpt-4.1-2025-04-14',
        modelConfig: {
            temperature: 1,
            top_p: 0.9,
            frequency_penalty: 0,
            presence_penalty: 0
        }
    },
    summary: {
        vendor: 'openai',
        model: 'gpt-4o-mini',
        modelConfig: {
            temperature: 0.7,
            top_p: 0.9,
            frequency_penalty: 0,
            presence_penalty: 0
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
