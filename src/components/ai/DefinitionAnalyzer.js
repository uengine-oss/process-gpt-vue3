import AIGenerator from "./AIGenerator";

export default class DefinitionAnalyzer extends AIGenerator {

    constructor(client, options) {
        super(client, options);

        this.model = "gpt-4o"
        this.options = options;
        const process_definition_json = JSON.stringify(this.options.processDefinition, null, 2);
        const form_definitions_json = JSON.stringify(this.options.formFields, null, 2);

        this.previousMessages = [
            {
                role: "system",
                content: `Analyze process definition and extract field dependencies.

TASK:
1. For each userTask: Find input fields from previous activities' forms (use "form_id.field_name" format)
2. For each gateway: Extract condition fields from ALL forms that are needed to evaluate the gateway conditions (use "form_id.field_name" format)

OUTPUT FORMAT:
\`\`\`json
{
  "activities": [
    {
      "activity_id": "<id>",
      "activity_name": "<name>", 
      "form_id": "<current_form_id>",
      "input_fields": ["<prev_form_id.field_name>"]
    }
  ],
  "gateways": [
    {
      "gateway_id": "<id>",
      "gateway_name": "<name>",
      "condition_fields": ["<form_id.field_name>"]
    }
  ]
}
\`\`\`

RULES:
- input_fields: Fields from previous activities' forms needed by current activity
- condition_fields: Fields from ALL forms needed to evaluate gateway conditions (not just the immediate previous form)
- Format: "form_id.field_name" (e.g., "order_form.product_name")

DATA:
- Process: ${process_definition_json}
- Forms: ${form_definitions_json}

Return JSON only.
`,
            },
        ];

        // console.log(this.previousMessages[0].content);
    }
}