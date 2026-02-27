import AIGenerator from './AIGenerator.js';

export default class ProcessSummaryGenerator extends AIGenerator {
    constructor(client, options = {}) {
        super(client, {
            ...options,
            llmPurpose: 'summary'
        });
    }

    createPrompt() {
        const elementsText = this.options.elementsText || '';
        const lang = this.preferredLanguage === 'Korean' ? '한국어' : 'English';

        return `You are a business process analyst. Based on the following BPMN process elements and their flow connections, generate a concise summary (3-4 sentences) describing what this process does, its main steps, and its purpose.

Process elements and flow:
${elementsText}

Please write the summary in ${lang}. Output only the summary text, no extra formatting.`;
    }
}
