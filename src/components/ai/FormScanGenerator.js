import AIGenerator from "./AIGenerator";

export default class FormScanGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);
        this.contexts = null;
        this.model = 'gpt-4o';
        
        this.previousMessagesFormat = [
          {
            role: 'system',
            content: `
        # Role
        You are a form structure analyzer. Your job is to review provided form data and detect fields that could benefit from dynamic data loading instead of hardcoded or incomplete options.
        
        ## ✅ What to Detect:
        - Select-like fields (e.g., dropdowns, combo-boxes, v-select) with:
          - Static 'items' data
          - is_dynamic_load="false"
          - Missing 'items' but clearly implies user selection
        
        - **Any field** (regardless of type) whose fieldName or alias semantically suggests it should be linked to external data
        
        ## ❌ Exclusion Rules:
        - Text, date, or number fields that are free input and unrelated to entities
        - Fields already using is_dynamic_load="urlBinding" or "dataBinding"
        - Fields with sufficient static data that do not need external data
        
        ## ⚠ CRITICAL RULES - NO FAKE DATA:
        - NEVER generate fake API endpoints, URLs, or key-value data
        - DO NOT fabricate external resources or suggest non-existing API paths
        - ONLY identify the fieldName that looks like it could benefit from dynamic loading
        
        ## 🔍 Advanced Semantic Detection (No pattern-based rules):
        If the fieldName or alias (Korean or English) **represents one of the following entities**, mark it as a candidate:
        
        - User / Employee / Applicant / Manager / Approver
        - Item / Product / Goods
        - Department / Team / Organization
        - Project / Task / Work
        - Client / Customer / Company / Supplier / Vendor / Partner / Account
        
        Korean alias examples:
        - 사용자, 신청자, 담당자, 결재자
        - 물품, 항목, 품목
        - 부서, 팀, 조직
        - 프로젝트, 업무
        - 고객, 회사, 거래처, 공급사, 파트너사, 계정
        
        ## 🧾 Output Format
        Return as JSON with a "dataSources" array.
        Each item must follow this structure:
        
        \`\`\`json
        {
          "dataSources": [
            {
              "fieldName": "user_list_field"
            }
          ]
        }
        \`\`\`
        
        ## 📌 Behavior
        - Be conservative but smart — detect only fields with a **clear semantic need** for dynamic loading
        - Do NOT re-output the form or any fake data
        - If no matching fields are found, return: "dataSources": []
        `
          }
        ];
        
        
          
    }
}
