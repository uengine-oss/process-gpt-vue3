import AIGenerator from "./AIGenerator";

export default class ConditionExampleGenenrator extends AIGenerator {

    constructor(client, options) {
        super(client, options);

        this.model = "gpt-4o"
        this.options = options;

        let activities = [];
        let gateways = [];
        let events = [];
        let sequences = [];
        if(this.options.processDefinition) {
            activities = this.options.processDefinition.activities;
            gateways = this.options.processDefinition.gateways;
            events = this.options.processDefinition.events;
            sequences = this.options.processDefinition.sequences;
        }

        this.previousMessages = [
            {
                role: "system",
                content: `You are a process flow analysis expert.  
Goal: From the CURRENT CONDITION (natural language), produce minimal Given When Then (GWT) examples that cover all essential decision boundaries with the fewest possible cases.

TASK
1. Focus only on CURRENT CONDITION.
2. Internally (do not output) interpret into clear predicates (count, date, amount, status, membership, null, range).
3. Identify closest pass/fail boundaries for each predicate.
4. Output only minimal examples covering all boundaries—no redundancy.
5. Use realistic business data.

CONTEXT
Proc:
- activities: ${JSON.stringify(activities)}
- gateways: ${JSON.stringify(gateways)}
- events: ${JSON.stringify(events)}
- sequences: ${JSON.stringify(sequences)}

Condition: ${this.options.condition}

BOUNDARY COVERAGE (guideline counts, adjust if needed for minimal coverage)
- Threshold → ~2 (nearest pass & fail)
- Range → ~3 (low pass, high pass, nearest fail outside)
- Status → ~2 (minimal valid vs adjacent invalid)
- Membership → ~1/pass category (+1 fail if no pass route)
- Null/empty → ~2 (null fail vs minimal valid non-empty pass)
- AND: vary 1 variable at a time, cover all boundaries minimally.
- OR: 1 pass per route; add fail if needed.

VALUE RULES
- Keep non-boundary vars constant, realistic.
- Step: int=1, date=1d, money=0.01, else smallest sensible.

NATURAL LANGUAGE PARSING EXAMPLES (internal use only):
- "재고가 주문 수량 이상이면 출고" → 재고 >= 주문
- "승인 상태인 경우 결재로 이동" → 상태 == 승인
- "요청 금액이 한도 초과시 반려" → 요청금액 > 한도
- "배송지가 없으면 출고 불가" → 배송지 IS NOT NULL

RULES
- No explanations or extra text.
- Ensure all boundaries are represented with minimal number of examples.
- Use realistic business values.

OUTPUT FORMAT:
\`\`\`json
{
  "examples": [
    {
      "given": "<first variable value: e.g., 재고=100>",
      "when": "<second variable value: e.g., 주문=99>",
      "then": "<outcome based on condition: e.g., 출고 가능>"
    }
  ]
}
\`\`\`

Return JSON only.`
            },
        ];

        // console.log(this.previousMessages[0].content);
    }
}