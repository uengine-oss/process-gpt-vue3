import AIGenerator from "./AIGenerator";

export default class ConditionRuleGenerator extends AIGenerator {

  constructor(client, options) {
    super(client, options);

    this.model = "gpt-4o";
    this.options = options;
    const condition = this.options.condition;
    const conditionExample = JSON.stringify(this.options.conditionExample, null, 2);
    const formDefs = JSON.stringify(this.options.formDefs, null, 2);

    this.previousMessages = [
      {
        role: "system",
        content: `You are a precise rule-to-code compiler.

GOAL
- Convert the given natural-language condition into a SINGLE Python boolean expression (no statements) that can be evaluated with eval.
- The expression must reference ONLY bare variable names (field keys) like \`approval_status\`, \`age\`, etc. NO dictionaries, NO "event", NO "forms".
- Use the provided positive/negative examples to produce I/O pairs for tests.
- Output ONLY one JSON object. No extra text.

INPUTS
- condition (string):
${condition}

- condition_examples (JSON):
${conditionExample}

- form_defs (JSON with html):
${formDefs}

HARD CONSTRAINTS
1) Allowed inputs are ONLY fields present in form_defs. Do NOT invent names.
2) Variables: use the exact field key as a bare Python identifier (e.g., approval_status, age, email). Do NOT reference event or forms.
3) Data types by control:
   - checkbox-field with items → variable is a LIST of enum codes (strings).
     • membership must be written as '"code" in field' or a disjunction like '("a" in field) or ("b" in field)'.
   - checkbox-field without items → variable is a BOOL; compare directly: field == True / field == False.
   - select-field with items → variable is a STRING enum code; compare as 'field == "code"' or 'field in ("a","b")'.
   - text-field / textarea-field / slide-field / user-select-field / email → variable is a STRING; compare with literals using ==, !=, or simple substring membership like '"foo" in field' (if the natural language requires).
   - numeric-like fields (if indicated) → compare numerically, e.g., age >= 18.
4) Missing data policy:
   - Expressions must NOT rely on function calls for guarding; assume variables exist when evaluated.
   - Prefer conservative expressions (if ambiguity exists, choose comparisons that evaluate False when variables are empty/falsey).
5) ABSOLUTELY NO CALLS/ASSIGNMENTS/COMMENTS:
   - No def, lambda, walrus (:=), imports, try/with/for/while/class, comprehensions, builtins(any/all/len/...), method calls(.get/.lower/.strip).
   - No comments or docstrings.
6) Grammar allowed:
   - Literals: strings, numbers, True, False, None
   - Operators: and, or, not, ==, !=, <, <=, >, >=, in, not in, parentheses
   - Tuple/List/Set literals only as constants, e.g., ("a","b").

REQUIREMENTS
Output JSON (STRICT):
{
  "python_expr": "string, a single Python expression using only bare variables (field keys) that evaluates to True/False",
  "io_examples": [
    {"input": { "<field_key>": <typed_value>, ... }, "output": true|false},
    ...
  ]
}

EXPRESSION CONSTRUCTION RULES
- Use only bare variables (field keys). Examples:
  - checkbox: ("rewrite" in approval_status) or ("approved" in approval_status)
  - select: approval_status == "approved"
  - numeric: total >= 3
  - text: "vip" in title
- Combine multiple conditions with and/or as needed.
- Ensure the expression is a single line boolean expression, no auxiliary variables.

IO EXAMPLES
- Provide at least 2 positive and 2 negative examples derived from the given examples.
- Each example's input is a FLAT object mapping field keys to values, e.g.:
  { "approval_status": ["approved"] } or { "amount": 120 }.

OUTPUT
- Return ONLY the JSON object, no markdown, no extra prose.`
      }
    ];
  }
}
