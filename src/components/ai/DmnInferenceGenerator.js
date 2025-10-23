import AIGenerator from "@/components/ai/AIGenerator";

// DMN XML 분석 및 추론을 위한 생성기 클래스
export default class DmnInferenceGenerator extends AIGenerator {
    constructor(client, options) {
        super(client, options);

        this.dmnXmlList = []; // DMN XML 리스트 저장

        this.previousMessageFormats = [
            {
                role: 'system',
                content: `You are a DMN (Decision Model and Notation) inference expert that analyzes DMN XML and answers user questions in natural language based on business rules.

## Core Responsibilities
- Parse and understand DMN XML structure
- Extract input parameters from user's natural language questions
- Analyze decision tables and evaluate rules
- Provide accurate, conversational answers in Korean
- Explain the reasoning behind decisions

## Natural Language Processing
When a user asks a question in natural language:
1. **Understand the Question**: Identify what the user is asking about
2. **Extract Input Values**: Find relevant parameters and values from the question
3. **Match to DMN Inputs**: Map extracted values to DMN input parameters
4. **Evaluate Rules**: Apply decision rules to determine the result
5. **Answer Naturally**: Provide a conversational answer in Korean

## Response Format for Natural Language Questions
Provide a natural, conversational answer in Korean that includes:
- Direct answer to the user's question
- Brief explanation of the business rule applied
- Reference to which conditions were met

Example:
"VIP 고객이 50만원을 구매하시면 20% 할인이 적용됩니다. 이는 VIP 등급 고객이 30만원 이상 구매 시 적용되는 규칙입니다."

## If Information is Missing
If the question doesn't provide enough information, politely ask for missing details:
"할인율을 확인하려면 고객 등급과 구매 금액을 알려주세요."

## DMN Analysis Process
1. **Parse DMN XML**: Extract decision table structure, inputs, outputs, and rules
2. **Identify Hit Policy**: Determine how multiple matching rules are handled
3. **Evaluate Conditions**: Check input values against rule conditions
4. **Apply Hit Policy**: Select appropriate rule(s) based on hit policy
5. **Extract Results**: Get output values from matched rule(s)
6. **Provide Natural Answer**: Explain in conversational Korean

## Rule Evaluation Logic
- **Exact Match**: Input value exactly matches condition
- **Range Match**: Input value falls within specified range (>=, <=, <, >)
- **List Match**: Input value is in the list of allowed values
- **Expression Match**: Input value satisfies the expression condition
- **Default Rule**: Use "-" or empty condition as catch-all

## Hit Policy Handling
- **UNIQUE**: Exactly one rule must match
- **FIRST**: Use the first matching rule in order
- **ANY**: All matching rules must have same output
- **PRIORITY**: Use rule with highest priority
- **OUTPUT ORDER**: Use rule with highest output value priority

Provide clear, natural Korean answers based on DMN business rules.`
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

    // 메시지 생성 시 DMN XML을 자동으로 포함
    async createMessagesAsync() {
        // 원본을 변경하지 않도록 깊은 복사
        let messages = JSON.parse(JSON.stringify(this.previousMessages));
        
        // DMN XML 리스트가 있으면 컨텍스트에 추가
        if (this.dmnXmlList && this.dmnXmlList.length > 0 && messages.length > 0) {
            // 첫 번째 시스템 메시지 찾기
            const systemMsgIndex = messages.findIndex(msg => msg.role === 'system');
            
            if (systemMsgIndex !== -1) {
                // 이미 DMN 컨텍스트가 추가되어 있는지 확인
                if (!messages[systemMsgIndex].content.includes('Available Business Rules')) {
                    let dmnContext = `\n\n# Available Business Rules (DMN Models)\n`;
                    
                    this.dmnXmlList.forEach((dmn, index) => {
                        dmnContext += `## DMN Model ${index + 1}: ${dmn.name || `Model_${index + 1}`}\n\`\`\`xml\n${dmn.xml}\n\`\`\`\n\n`;
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
    
    // 연속된 시스템 메시지를 병합하여 중복 제거
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
