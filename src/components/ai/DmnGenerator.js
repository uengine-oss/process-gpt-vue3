import AIGenerator from "@/components/ai/AIGenerator";
import BackendFactory from '@/components/api/BackendFactory';

const backend = BackendFactory.createBackend();

// 'DMN 정의' 메뉴에서 AI를 통한 DMN 생성을 위한 생성기 클래스
export default class DmnDesignGenerator extends AIGenerator {
    constructor(client, options) {
        super(client, options);

        this.previousMessageFormats = [
            {
                role: 'system',
                content: `You are a DMN (Decision Model and Notation) expert specializing in creating business decision tables following DMN 1.3 standards. You process both text descriptions and images (diagrams, tables, flowcharts, handwritten notes).

## ⚠️ CRITICAL: Response Format
You MUST return ONLY valid JSON in this exact format. No markdown, no explanations outside this structure:
\`\`\`json
{
  "dmnXml": "<complete DMN XML as a single-line escaped string>",
  "description": "<brief explanation in Korean>",
  "modifications": [{"action": "add|modify|delete", "element": "input|output|rule|decision", "description": "what changed"}]
}
\`\`\`

## Core Capabilities
1. **Generate valid DMN XML** for decision tables and models
2. **Analyze images** to extract business rules:
   - Decision tables, flowcharts, business documents
   - Extract inputs, outputs, conditions, rule mappings
   - Interpret handwritten notes and informal diagrams
3. **Translate business requirements** into structured DMN notation
4. **Modify existing DMN** while preserving structure and IDs

## DMN Structure Requirements
- **Definitions**: Root element with unique ID and descriptive name
- **Decision**: Main decision element with business-friendly name
- **Inputs**: Conditions with expressions and data types (string, number, boolean, etc.)
- **Outputs**: Decision results with types and possible values
- **Rules**: Input conditions → output values mappings with proper hit policies
- **DMNDI**: Visualization elements for proper rendering

## Hit Policy Guidelines
- Use full notation (UNIQUE, ANY, FIRST, PRIORITY, OUTPUT ORDER, RULE ORDER, COLLECT)
- **DO NOT use abbreviated versions** (U, A, F, P, O, R, C, C+, C<, C>, C#)
- For **COLLECT** hit policy, analyze requirements to determine if aggregation is needed:
  - If aggregation needed, add separate **aggregation** attribute with values: SUM, MIN, MAX, COUNT
  - Use full names (SUM, not +; MIN, not <; MAX, not >; COUNT, not #)
  - Example: \`hitPolicy="COLLECT" aggregation="SUM"\`
  - If no aggregation needed, use only \`hitPolicy="COLLECT"\` without aggregation attribute

## ID and Naming Conventions
- Use **lowercase snake_case** for all IDs (e.g., "loan_approval", "customer_risk_assessment")
- Derive IDs from business domain/purpose (no mandatory prefixes)
- Ensure **all element IDs are unique** (input_1, output_1, rule_1, etc.)
- Use clear, human-readable Korean names for display

## Processing Guidelines
**For Image Input:**
1. Analyze visual elements (tables, diagrams, flowcharts)
2. Extract decision logic, variables, and conditions
3. Map visual structure to DMN elements

**For New DMN Creation:**
1. Identify business question and context
2. Define inputs (variables, types, expressions)
3. Define outputs (results, types, values)
4. Create complete rule set (all combinations or specified rules)
5. Generate complete importable DMN XML with DMNDI

**For DMN Modification:**
1. Parse existing DMN structure
2. Apply requested changes while maintaining IDs
3. Return complete modified XML (not just changes)

Generate complete, valid DMN 1.3 compliant XML that can be directly imported.`
            }
        ];

        if (this.prompt && this.prompt != '') {
            this.previousMessages = [
                ...this.previousMessageFormats,
                {
                    role: 'user',
                    content: this.prompt
                }
            ];
        } else {
            this.previousMessages = [
                ...this.previousMessageFormats
            ];
        }
    }

    createPrompt() {
        return '';
    }

    /**
     * 메시지를 OpenAI Vision API 형식으로 변환
     */
    createMessageContent(message) {
        // 이미지가 있는 경우 Vision API 형식으로 변환
        if (message.images && message.images.length > 0) {
            const content = [];
            
            // 텍스트 추가
            if (message.text) {
                content.push({
                    type: 'text',
                    text: message.text
                });
            }
            
            // 이미지들 추가
            message.images.forEach(image => {
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: image.url
                    }
                });
            });
            
            return content;
        }
        
        // 이미지가 없으면 텍스트만 반환
        return message.text || '';
    }

    sendMessage(message) {
        const content = this.createMessageContent(message);
        
        this.previousMessages = [
            ...this.previousMessageFormats,
            {
                role: 'user',
                content: content
            }
        ];
        
        return super.generate(message);
    }

    sendMessageWithPrevDmnOutput(message) {
        const textPrompt = `
# Previous DMN Output
Below is the DMN XML that was previously generated. Use this as context for the current request.

\`\`\`xml
${this.client.prevDmnOutput}
\`\`\`

# Current Request
${message.text || '(이미지 참조)'}

Please provide modifications to the existing DMN or create a new one based on the request.

CRITICAL: Return ONLY the following format:
\`\`\`json
{
  "dmnXml": "<complete DMN XML as a single-line escaped string>",
  "description": "<brief explanation in Korean>",
  "modifications": [{"action": "add|modify|delete", "element": "input|output|rule|decision", "description": "what changed"}]
}
\`\`\`
`;

        // 이미지가 있는 경우 Vision API 형식으로 변환
        let content;
        if (message.images && message.images.length > 0) {
            content = [
                {
                    type: 'text',
                    text: textPrompt
                }
            ];
            
            // 이미지들 추가
            message.images.forEach(image => {
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: image.url
                    }
                });
            });
        } else {
            content = textPrompt;
        }

        this.previousMessages = [
            ...this.previousMessageFormats,
            {
                role: 'user',
                content: content
            }
        ];

        return super.generate(message);
    }
}

