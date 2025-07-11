import AIGenerator from "./AIGenerator";

export default class ProcessDefinitionGenerator extends AIGenerator {
  constructor(client, language) {
    super(client, language);

    const externalSystems = JSON.stringify(client.externalSystems);
    const jsonStructure = this.getJsonStructure();
    const systemInstructions = this.buildSystemInstructions(jsonStructure, externalSystems);

    this.previousMessages = [
      {
        role: "system",
        content: systemInstructions,
      },
    ];
  }

  createPrompt() {
    return this.client.newMessage;
  }

  setOrganizationChart(organizationChart) {
    this.previousMessages[0].content = this.previousMessages[0].content.replace(
      "{{ 회사 조직도 정보 }}",
      JSON.stringify(organizationChart)
    );
  }

  setProcessDefinitionMap(processDefinitionMap) {
    this.previousMessages[0].content = this.previousMessages[0].content.replace(
      "{{ 프로세스 정의 체계도 정보 }}",
      JSON.stringify(processDefinitionMap)
    );
  }

  setProcessDefinition(processDefinition) {
    this.previousMessages[0].content = this.previousMessages[0].content.replace(
      "{{ 기존 프로세스 정보 }}",
      JSON.stringify(processDefinition)
    );
  }

  setStrategy(strategy) {
    this.previousMessages[0].content = this.previousMessages[0].content.replace(
      "{{ 전략 맵 }}",
      JSON.stringify(strategy)
    );
  }

  buildSystemInstructions(jsonStructure, externalSystems) {
    return [
      this.getDefinitionGuideSection(jsonStructure),
      this.getModificationRulesSection(),
      this.getExternalSystemGuideSection(externalSystems),
      // this.getRoleDefinitionSection()
    ].join("\n\n");
  }

  getDefinitionGuideSection(jsonStructure) {
    return `
    ### 프로세스 정의

    자 지금부터 너는 우리 회사의 다양한 프로세스를 이해하고 직원들이 프로세스를 시작하거나 프로세스의 다음 단계가 궁금할 거 같을 때 다음의 액션을 취하는 BPM 시스템과 같은 대화형의 시스템을 만들거야.
        
    - 프로세스 정의: 내가 업무 진행 중 프로세스 변경을 이렇게 하자고 말하면 해당 프로세스 정의가 그 때부터 바뀌는 거야.

    - 프로세스 정의 체계도: 우리 회사 프로세스는 Mega Process, Major Process, Sub Process 로 이루어진 프로세스 정의 체계도가 있어. 사용자가 정의하는 프로세스는 Sub Process 에 해당하고, 프로세스를 정의 할 때 Mega, Major Process 의 정보가 없다면 우리 회사의 프로세스 정의 체계도를 참고해서 최대한 유사한 카테고리에 해당하는 Mega, Major Process 의 정보도 함께 리턴해줘. 만약 유사한 Mega, Major Process 가 없다면 새로운 Mega, Major Process 를 리턴할 수 있도록 해.

    - 회사 조직도: 우리 회사의 조직도가 있어. 사용자가 정의하는 프로세스는 조직도에 해당하는 팀을 참고해서 프로세스 정의를 생성해줘 참고를 했다면 관련 설명 첨부.

    - 전략 맵: 우리 회사의 전략 맵이 있어. 사용자가 정의하는 프로세스는 전략 맵에 해당하는 전략을 참고해서 프로세스 정의를 생성해줘 참고를 했다면 관련 설명 첨부.

    만약 이미지를 입력 받았다면 받은 이미지를 분석해서 분석한 내용을 바탕으로 프로세스 정의를 생성해줘.

    프로세스 정의 체계도:
    {{ 프로세스 정의 체계도 정보 }}

    기존 프로세스 정보:
    {{ 기존 프로세스 정보 }}
    
    회사 조직도:
    {{ 회사 조직도 정보 }}

    전략 맵:
    {{ 전략 맵 }}

    사용자가 설명하는 프로세스를 분석하여 다음 구성요소를 포함한 비즈니스 프로세스 정의를 생성해야 합니다:
    - 프로세스 시작점과 종료점
    - 프로세스 내의 모든 활동(액티비티)
    - 활동 간의 흐름을 나타내는 시퀀스
    - 조건부 분기를 위한 게이트웨이
    - 각 액티비티의 담당자 역할
    - 프로세스에서 사용되는 데이터 변수
    
    The following rules must be strictly followed:
      1. All IDs must be written in lowercase English letters with underscores.
      2. All names and descriptions must be written in Korean.
      3. The process must always start with a StartEvent and end with an EndEvent.
      4. All elements must be connected via sequence flows.
      5. Each sequence must have both a source and a target.
      6. If a gateway is used, the sequence branching conditions must be clearly defined.
      7. All activities and gateways must have an assigned role.
      8. Role assignment rules:
         - First, check the organization chart for appropriate teams and prioritize using team members with type 'agent' as roles. If no suitable agents exist within the appropriate team, assign the team itself as the role. Team members who are not agents cannot be used as roles. Only create new teams if no suitable teams or agents exist in the organization chart
         - If a suitable role is found in the organization chart, use it and set origin as "used"
         - If no suitable role exists, create a new role and set origin as "created"
      9. Sequences with conditions must include a condition object.
      10. No comments are allowed within the JSON.
      11. Each element (event, activity, gateway) must be immediately followed by the sequence that connects it to the next element.
      12. If a non-sequence element includes a source, you must define a corresponding sequence element that connects from the source.
      13. If there is an external customer or participant in the role, the endpoint of that role is fixed as 'external_customer'.

    결과는 다음 JSON 형식을 따라야 합니다:
    \`\`\`
    ${jsonStructure}             
    \`\`\`

    - 프로세스 변경: 프로세스 정의의 일 부분이 변경될 때는 다음과 같이 변경된 부분만 리턴해줘:

      이때 지킬 사항:
       1.  {modifications: [..]} 내에 여러개의 항목으로 넣어줘.
       2.  액티비티, 게이트웨이, 이벤트 추가인 경우는 시퀀스도 꼭 연결해줘.
       3.  액티비티, 게이트웨이, 이벤트가 삭제되는 경우는 나와 연결된 앞뒤 액티비티 간의 시퀀스도 삭제하되, 삭제된 액티비티의 이전 단계와 다음단계의 액티비티를 시퀀스로 다시 연결해줘.
       4.  생성될 모든 값들은 기존 프로세스의 정보를 참고하여 생성해야한다.
       5.  추가되는 액티비티의 이전 단계 액티비티의 id도 beforeActivity에 반드시 넣어.
       6.  추가될 액티비티, 게이트웨이의 "role" 은 회사 조직도에서 해당 역할에 맞는 적절한 팀을 찾고 그 팀에 속한 type이 agent인 적절한 팀원을 우선적으로 찾아 사용하고, 역할에 맞는 팀 내 적절한 agent 가 존재하지 않는다면 팀을 역할로 할당한다. agent 가 아닌 팀원(사람)은 역할로써 사용할 수 없다. 그리고 적절한 팀이나 agent 모두 없는 경우에는 새로운 팀을 생성해야 한다.
       7.  기존 액티비티들의 위치정보는 바뀌면 안돼.
       8.  추가될 액티비티, 게이트웨이의 위치는 프로세스의 위치와 크기에 대한 설명을 참고하여 기존 액티비티의 위치를 참고하여 생성해줘.
       9.  이름이 들어가는것은 반드시 전부 한글로 할 것
       10. 절대로 JSON 내부에 주석이 있으면 안돼.
       11. 중간에 액티비티가 추가된다면, 추가된 액티비티의 앞뒤 액티비티 간의 Sequence도 반드시 삭제해.
       12. Sequence는 replace가 없어. add 혹은 delete 해야해.
       13. id는 반드시 영어로 들어가야 함
       14. 세로로 만들어 달라고 하면 반드시 isHorizontal을 false로 설정해줘.
    \`\`\`
      { 
        "modifications": [
          
          {
            "action": "replace" | "add" | "delete",
            "targetJsonPath": "$.activities[?(@.id=='request_vacation')]", // action 이 add 인 경우 "$.activities" 만 리턴. e.g. "$.sequences", action 이 add 가 아닌 경우 "$.activities[?(@.id=='request_vacation')]" 와 같이 수정, 삭제될 Path 의 상위 목록("activities", "sequences" 등...)을 참고하여 "$.activities" 뒤에 수정, 삭제될 값을 찾을 수 있는 필터("[?(@.id=='request_vacation')]") 를 반드시 포함하여 리턴.  // e.g. "$.sequences[?(@.source=='leave_request_activity' && @.target=='leave_approval_activity')].condition" // "$.elements" 로 생성 금지. "$.elements"가 아닌 elementType 을 알 수 있는 path(예시: $.activities)여야함. 기존 프로세스 정보중 activities, sequences 가 없는 경우에만 elements 를 포함한 path 생성 가능
            "value": {...}, //delete 인 경우에는 삭제 될 Sequence의 id를 {"id": "삭제 될 Sequence의 id"} 형식으로 리턴, replace의 경우 기존 value에서 변경된 부분을 수정하여 생략 하지 않고 value로 리턴
            "beforeActivity": "" // 추가 되거나 변경 되는 Activity의 이전 단계 Activity의 id
          }   
        ]
      }
    \`\`\`

    
    결과는 프로세스에 대한 설명과 함께 valid 한 json 으로 표현해줘. markdown 으로, three backticks 로 감싸. 예를 들면:

    \`\`\`
    ${jsonStructure}
    \`\`\`
    `.trim();
  }

  getModificationRulesSection() {
    return `
    ### 프로세스 변경
      프로세스 정의의 일 부분이 변경될 때는 다음과 같이 변경된 부분만 리턴해줘:

      { 
        "modifications": [
          {
            "action": "replace" | "add" | "delete",
            "targetJsonPath": "$.activities[?(@.id=='request_vacation')]", // "$.elements" 로 생성 금지. "$.elements"가 아닌 elementType 을 알 수 있는 path(예시: $.activities)여야함. 기존 프로세스 정보중 activities, sequences 가 없는 경우에만 elements 를 포함한 path 생성 가능
            "value": { ... },
            "beforeActivity": ""
          }   
        ]
      }`.trim();
  }

  getExternalSystemGuideSection(externalSystems) {
    return `
    ### 외부 시스템 가이드
      외부 시스템 목록:
      \`\`\`
      ${externalSystems}
      \`\`\`

      외부 시스템과 연결 되는 Element는 ServiceTask 로 설정해줘.
      ServiceTask 구조는 다음과 같아:

      \`\`\`
      {
        "id": "event_id",
        "name": "event name",
        "componentType": "ServiceTask",
        "description": "프로세스의 시작, 종료 또는 중간 이벤트 설명",
        "trigger": "이벤트 트리거 조건 (if applicable)",
        "participants": "연결 될 Participant 의 이름",
        "spec": {
          "systemName": "사용 할 시스템",
          "method": "사용 될 실제 Methods Type을 무조건 대문자로 작성해줘.",
          "inputPayloadTemplate": {
            "key": "value"
          },
          "uriTemplate": "호출 할 API 전체 경로"
        }
      }
      \`\`\`
      `.trim();
  }

  getRoleDefinitionSection() {
    return `
    사용자들의 역할은 다음과 같아:
    - 직원: 업무를 지시 받고 처리하는 사람
    - 프로세스 관리자: 프로세스 정의의 변경 권한을 갖고 있는 사람
    - BPM시스템: 이 시스템은 Business Process Management 기능을 수행하는 바로 너가 해야 할 일이야.`.trim();
  }

  getJsonStructure() {
    const baseStructure = `
        {
            "megaProcessId": "메가 프로세스 ID(한글)",
            "majorProcessId": "메이저 프로세스 ID(한글)",
            "processDefinitionName": "프로세스 명(한글)",
            "processDefinitionId": "process_definition_id(영문 스네이크 케이스)",
            "description": "프로세스 설명(한글)",
            "isHorizontal": true,
            "data": [
              {
                "name": "변수명(한글)",
                "description": "변수 설명(한글)",
                "type": "Text" | "Number" | "Date" | "Attachment" | "Form"
              }
            ],
            "roles": [
              {
                "name": "역할명(한글)", // 조직도에 존재하는 팀 또는 agent 의 이름, 없다면 임의로 생성
                "endpoint": "역할 엔드포인트", // 조직도에 존재하는 팀 또는 agent 의 id, 없다면 임의로 생성. 영어로 생성할 것.
                "resolutionRule": "역할 매핑 방법",
                "origin": "used" | "created",  // 조직도에서 가져온 역할이라면 used, 새로 생성된 역할이라면 created
              }
            ],
            "elements": [
              {
                "elementType": "Event",
                "id": "event_id(영문)",
                "name": "이벤트명(한글)",
                "role": "역할명",
                "source": "이전_컴포넌트_id",
                "type": "StartEvent" | "EndEvent" | "IntermediateCatchEvent",
                "description": "이벤트 설명(한글)",
                "trigger": "트리거 조건"
              }
            ]
          }

          ## 템플릿 elements

          # 이벤트
              {
                "elementType": "Event",
                "id": "event_id(영문)",
                "name": "이벤트명(한글)",
                "role": "역할명",
                "source": "이전_컴포넌트_id",
                "type": "StartEvent" | "EndEvent" | "IntermediateCatchEvent",
                "eventType": "Timer" | "Signal" | "Message" | "Conditional",
                "expression": "타이머 설정(cron 표현식) eventType이 Timer 인 경우에만 사용",
                "description": "이벤트 설명(한글)",
                "trigger": "트리거 조건"
              }
          # 시퀀스
              {
                "elementType": "Sequence",
                "id": "sequence_id(영문)",
                "name": "시퀀스명(한글)",
                "source": "시작_컴포넌트_id",
                "target": "도착_컴포넌트_id",
                "condition": ${window.$mode !== 'ProcessGPT' ? `{
                  "key": "데이터변수명",
                  "condition": "==", // ==, !=, >, <, >=, <= 중 하나
                  "value": "비교값"
                }` : '"조건문(한글)"'}
              }
          # 액티비티
              {
                "elementType": "Activity",
                "id": "activity_id(영문)",
                "name": "액티비티명(한글)",
                "type": "UserActivity" | "EmailActivity",
                "source": "이전_컴포넌트_id",
                "description": "액티비티 설명(한글)",
                "instruction": "사용자 지침(한글)",
                "role": "역할명",
                "inputData": ["입력 데이터명"],
                "outputData": ["출력 데이터명"],
                "checkpoints": ["체크포인트1", "체크포인트2"],
                "duration": "5"
              }
          # 게이트웨이
              {
                "elementType": "Gateway",
                "id": "gateway_id(영문)",
                "name": "게이트웨이명(한글)",
                "role": "역할명",
                "source": "이전_컴포넌트_id",
                "type": "ExclusiveGateway" | "ParallelGateway" | "InclusiveGateway",
                "description": "게이트웨이 설명(한글)"
              }
        `
    return baseStructure;
  }
}
