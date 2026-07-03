const INHERITANCE_DIRECTIVE = '> **상속 규칙**';
const INHERITANCE_DIRECTIVE_LEGACY = '## 상속 지시문';

export function generateInheritanceTemplate(parentSkills: string[], childName?: string): string {
    const isSingle = parentSkills.length === 1;
    const extendsField = isSingle
        ? `extends: ${parentSkills[0]}`
        : `extends:\n${parentSkills.map((s) => `  - ${s}`).join('\n')}`;
    const parentListFormatted = parentSkills.join(', ');
    const description = isSingle
        ? `${parentSkills[0]}을(를) 상속한 스킬입니다`
        : `${parentListFormatted}을(를) 상속한 스킬입니다`;
    const nameField = childName ? `name: ${childName}\n` : '';
    const title = childName || '자식 스킬 제목';

    return `---
${nameField}description: ${description}
${extendsField}
---

${INHERITANCE_DIRECTIVE}: 이 스킬은 [${parentListFormatted}] 스킬을 상속합니다. 아래 규칙이 상속된 규칙보다 우선 적용됩니다.

> ⚠️ 위의 \`extends\` 항목과 이 지시문을 삭제하지 마세요. 삭제하면 부모 스킬이 로드되지 않습니다.

# ${title}

## 재정의 규칙

부모 스킬과 다르게 동작해야 하는 규칙을 여기에 작성합니다.

## 추가 규칙

부모 스킬에 없는 새로운 규칙을 여기에 작성합니다.
`;
}

export function hasInheritanceDirective(content: string): boolean {
    if (!content) return false;
    const hasFrontmatterExtends = /^---[\s\S]*?extends\s*:/m.test(content);
    const hasDirective = content.includes(INHERITANCE_DIRECTIVE) || content.includes(INHERITANCE_DIRECTIVE_LEGACY);
    return hasFrontmatterExtends || hasDirective;
}
