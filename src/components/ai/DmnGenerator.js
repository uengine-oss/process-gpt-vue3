import AIGenerator from "@/components/ai/AIGenerator";
import BackendFactory from '@/components/api/BackendFactory';

const backend = BackendFactory.createBackend();

// 'DMN 정의' 메뉴에서 AI를 통한 DMN 생성/수정 및 추론을 위한 통합 생성기 클래스
export default class DmnDesignGenerator extends AIGenerator {
    constructor(client, options) {
        super(client, options);

        this.dmnXmlList = []; // DMN XML 리스트 저장 (추론용)
        this.isInferenceMode = false; // 추론 모드 플래그

        this.previousMessageFormats = [
            {
                role: 'system',
                content: `You are a DMN (Decision Model and Notation) expert specializing in creating business decision tables following DMN 1.3 standards AND analyzing DMN models to answer questions. You process both text descriptions and images (diagrams, tables, flowcharts, handwritten notes).

# MODE 1: DMN Generation/Modification
When creating or modifying DMN models, follow these guidelines:

## ⚠️ CRITICAL: Response Format for Generation Mode
You MUST return ONLY valid JSON in this exact format. No markdown, no explanations outside this structure:
\`\`\`json
{
  "dmnXml": "<complete DMN XML as a single-line escaped string>",
  "description": "<brief explanation in Korean>",
  "modifications": [{"action": "add|modify|delete", "element": "input|output|rule|decision", "description": "what changed"}]
}
\`\`\`

## Core Capabilities (Generation Mode)
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

## Processing Guidelines (Generation Mode)
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

# MODE 2: DMN Inference/Analysis
When answering questions about existing DMN models, follow these guidelines:

## ⚠️ CRITICAL: Response Format for Inference Mode
Return well-formatted **Markdown** with DETAILED step-by-step inference process including:
- Question analysis and understanding
- Input value extraction from the question
- DMN rule matching process
- Rule evaluation with conditions
- Final result with clear explanation
- Use rich markdown formatting (headers, lists, bold, tables, code blocks, etc.)

## Natural Language Processing (Inference Mode)
When a user asks a question about DMN rules, provide a DETAILED response following this structure:

**Section 1: Question Analysis (질문 분석)**
- State the user's question clearly
- List what information is needed to answer it

**Section 2: Input Extraction (입력값 추출)**  
- Extract all input parameters from the question
- Show the values found for each parameter

**Section 3: Rule Matching (규칙 매칭)**
- Name the decision table being consulted
- Create a TABLE showing ALL rules evaluated with columns: Rule ID, Input Conditions, Output, Match Status
- Mark matched rules clearly with emojis (✅/❌)

**Section 4: Condition Evaluation (조건 평가)**
- For matched rule(s), show detailed condition checking
- Explain how each input condition was satisfied
- Mention the hit policy used

**Section 5: Final Result (최종 결과)**
- State the final answer prominently with emojis
- Provide business context and rule name
- Include practical calculations if applicable (e.g., discount amounts)
- Explain the business policy behind the decision

Use headers (##, ###), bold text, tables, lists, code formatting for values, and emojis for visual appeal.

## If Information is Missing
If the question doesn't provide enough information, provide detailed markdown explaining:
- What information is missing
- Why it's needed for the decision
- Examples of complete questions
- Use lists and formatting for clarity

## Rule Evaluation Logic (Inference Mode)
- **Exact Match**: Input value exactly matches condition
- **Range Match**: Input value falls within specified range (>=, <=, <, >)
- **List Match**: Input value is in the list of allowed values
- **Expression Match**: Input value satisfies the expression condition
- **Default Rule**: Use "-" or empty condition as catch-all

## Hit Policy Handling (Inference Mode)
- **UNIQUE**: Exactly one rule must match
- **FIRST**: Use the first matching rule in order
- **ANY**: All matching rules must have same output
- **PRIORITY**: Use rule with highest priority
- **OUTPUT ORDER**: Use rule with highest output value priority

Generate complete, valid DMN 1.3 compliant XML OR provide clear markdown answers based on the mode.`
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

    /**
     * 추론 모드로 메시지 전송
     * DMN XML을 기반으로 사용자 질문에 답변 (마크다운 형식)
     */
    sendInferenceMessage(message) {
        this.isInferenceMode = true;
        
        const textPrompt = `
# MODE: Inference/Analysis (상세 추론)

The user is asking a question about the business rules defined in the DMN models.

## Your Task:
Provide a DETAILED, STEP-BY-STEP inference process showing:
1. **질문 분석**: Analyze what the user is asking
2. **입력값 추출**: Extract all input parameters from the question
3. **규칙 매칭**: Show which DMN rules were evaluated (use table format)
4. **조건 평가**: Detail how conditions were checked for matched rules
5. **최종 결과**: Provide final answer with business context

## User Question:
${message.text || '(이미지 참조)'}

## Requirements:
- Use rich Markdown formatting (headers, tables, lists, bold, emojis)
- Show the evaluation process for ALL rules in table format
- Explain WHY certain rules matched or didn't match
- Include practical calculations if applicable
- Respond in Korean with professional yet friendly tone
- Make it educational - help user understand the decision logic

Return a comprehensive, well-structured Markdown document.
`;

        const content = this.createMessageContent({
            text: textPrompt,
            images: message.images
        });
        
        this.previousMessages = [
            ...this.previousMessageFormats,
            {
                role: 'user',
                content: content
            }
        ];
        
        return super.generate(message);
    }

    /**
     * 메시지 생성 시 DMN XML을 자동으로 포함 (추론 모드용)
     */
    async createMessagesAsync() {
        // 원본을 변경하지 않도록 깊은 복사
        let messages = JSON.parse(JSON.stringify(this.previousMessages));
        
        // 추론 모드이고 DMN XML 리스트가 있으면 컨텍스트에 추가
        if (this.isInferenceMode && this.dmnXmlList && this.dmnXmlList.length > 0 && messages.length > 0) {
            // 첫 번째 시스템 메시지 찾기
            const systemMsgIndex = messages.findIndex(msg => msg.role === 'system');
            
            if (systemMsgIndex !== -1) {
                // 이미 DMN 컨텍스트가 추가되어 있는지 확인
                if (!messages[systemMsgIndex].content.includes('Available Business Rules')) {
                    let dmnContext = '\n\n# Available Business Rules (DMN Models)\n';
                    
                    this.dmnXmlList.forEach((dmn, index) => {
                        const modelName = dmn.name || 'Model_' + (index + 1);
                        dmnContext += '## DMN Model ' + (index + 1) + ': ' + modelName + '\n';
                        dmnContext += '```xml\n' + dmn.xml + '\n```\n\n';
                    });
                    
                    messages[systemMsgIndex].content += dmnContext;
                }
            }
        }
        
        // role이 'agent'인 경우 'system'으로 변환
        messages = messages.map(msg => {
            if (msg.role === 'agent') {
                return {
                    ...msg,
                    role: 'system'
                };
            }
            return msg;
        });
        
        // 연속된 동일 role의 시스템 메시지 병합
        messages = this._mergeConsecutiveSystemMessages(messages);
        
        return messages;
    }
    
    /**
     * 연속된 시스템 메시지를 병합하여 중복 제거
     */
    _mergeConsecutiveSystemMessages(messages) {
        const merged = [];
        let lastSystemMsg = null;
        
        for (const msg of messages) {
            if (msg.role === 'system') {
                if (lastSystemMsg) {
                    // 중복된 내용이 아니면 병합
                    if (!lastSystemMsg.content.includes(msg.content)) {
                        lastSystemMsg.content += '\n\n' + msg.content;
                    }
                } else {
                    lastSystemMsg = { ...msg };
                    merged.push(lastSystemMsg);
                }
            } else {
                lastSystemMsg = null;
                merged.push(msg);
            }
        }
        
        return merged;
    }
}

