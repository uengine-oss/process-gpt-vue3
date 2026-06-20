import AIGenerator from './AIGenerator';

export default class CommitMessageGenerator extends AIGenerator {
    constructor(client, options) {
        super(client, options);
        this.model = 'gpt-4o';
        this.options = options ?? {};

        const originalContent = options?.originalContent ?? '';
        const currentContent = options?.currentContent ?? '';
        const fileName = options?.fileName ?? '';
        const language = options?.language ?? 'Korean';

        this.previousMessages = [
            {
                role: 'system',
                content: `You are a Git commit message expert.

Given the original and modified content of a file, generate a single concise commit message.

Rules:
- Output ONLY the commit message line, nothing else (no explanations, no markdown, no quotes)
- Use Conventional Commits format: type(scope): description  (e.g., "feat: add retry logic", "fix: handle null user")
- Keep the message under 72 characters
- Use imperative mood ("add", "fix", "update", not "added", "fixed", "updated")
- If the preferred language is Korean, write the description part in Korean (e.g., "feat: 재시도 로직 추가")
- If the file is new (original is empty), use "feat:" or "docs:" prefix as appropriate
- Focus on WHAT changed from a user/business perspective

Preferred language: ${language}
File name: ${fileName}

<<<ORIGINAL_START>>>
${originalContent}
<<<ORIGINAL_END>>>

<<<MODIFIED_START>>>
${currentContent}
<<<MODIFIED_END>>>`
            }
        ];
    }
}
