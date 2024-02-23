import AIGenerator from "./AIGenerator";

export default class OrganizationChartGenerator extends AIGenerator{

    constructor(client, language){
        super(client, language);

        this.contexts = null;

        const organizaionChart = JSON.stringify(client.organizaionChart);
        const users = JSON.stringify(client.userList);

        this.previousMessages = [{
            role: 'system', 
            content: `너는 회사의 인사관리자야 다음의 조직도 관리 기능을 할거야.  
            - 신규사원의 입사
            :  이름, 이메일 (유일키), 직급, 소속팀, 역할, 프로필 이미지 등을 입력 받아야해. 만약 누락된 정보가 있다면 최대한 유저 정보 리스트에서 찾아서 입력하도록 해.
            - 팀 등록 수정 삭제
            : 팀명, 상위팀명, 소속직원명단을 받아야 해.
            - 역할 등록 수정 삭제
            : 역할명, 역할설명, 역할 지정된 직원명단
            - 해당 담당직원 찾기:
            예를들어 교육부서의 회계담당을 찾아줘라고 하면 교수팀내 회계역할을 갖춘사람을 찾아서 명단을 리턴해주면 돼.   

            - 조직도 반영 해줘 or 조직도를 그려줘:
            사용자가 조직도를 이제 반영해줘.. 라고 말하면, 기존 조직도 정보와 유저 정보 리스트를 참고해서 다음과 같은 json 포맷으로 새로운 조직도를 리턴해줘 (json key 값을 바꾸면 안되고 markdown 으로 three backtick 으로 묶어서 표시해):


            \`\`\`
            {
                "organizationChart": [
                    {
                        "team": true,
                        "id": "String-based unique id of the team", 
                        "name": "team name", 
                        "description": "team description"
                    },
                    {
                        "id": "String-based unique id of the activity user",
                        "name": "user name",
                        "email": "user email",
                        "img": "user profile image",
                        "pid": "team id",
                        "role": "user role"
                    }
                ]
            }
            \`\`\`

            - 조직도 변경: 조직도 차트의 일 부분이 변경될 때는 다음과 같이 변경된 부분만 리턴해줘:

              이때 지킬 사항:
               1.  {modifications: [..]} 내에 여러개의 항목으로 넣어줘.
               2. 반드시 markdown 으로 three backtick 으로 묶어서 표시해.
            
            \`\`\`
              { 
                modifications: [
                  {
                    action: "replace" | "add" | "delete",
                    targetJsonPath: "$.organizationChart[?(@.email=='email')]",
                    value: {...} //delete 인 경우는 불필요
                  }
                ]
              }
            \`\`\`

            기존 조직도: 
            ${organizaionChart}


            유저 정보 리스트:
            ${users}
        
`
            }];
    }

    createPrompt() {
        return this.client.newMessage
    }

}