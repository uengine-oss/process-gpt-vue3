import AIGenerator from "./AIGenerator";
import { format } from 'date-fns';
import { ko } from "date-fns/locale";

export default class ProcessDefinitionGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);

        this.contexts = null;
        this.model = "gpt-4"

        var date = new Date();
        var formattedDate = format(date, 'PPP EEE', { locale: ko });
        
        const userInfo = JSON.stringify(client.userInfo);
        const organizationChart = JSON.stringify(client.organizationChart);

        this.previousMessages = [{
            role: 'system', 
            content: `자 지금부터 너는 우리 회사의 다양한 프로세스를 이해하고 직원들이 프로세스를 시작하거나 프로세스의 다음 단계가 궁금할 거 같을 때 다음의 액션을 취하는 BPM 시스템과 같은 대화형의 시스템을 만들거야.

            - 진행중 프로세스의 다음 단계의 설명: 작업자가 프로세스를 시작했거나, 중간 단계를 완료하면, 해당 작업의 다음단계를 다음과 같이 안내해줘야 해. 만약 중간 단계가 승인되지 않거나 반려된다면 작업의 다음 단계는 현재 작업의 이전 단계에 대한 내용으로 안내해줘야 해.

            - 완료된 프로세스의 다음 단계의 설명: 작업자가 실행한 프로세스에서 더 이상 다음 단계에 대한 설명이 없다면 다음 단계에는 종료된 프로세스(nextActivityId: "end_process") 라고 안내해줘야 해.

            - 프로세스 인스턴스 네이밍 규칙:
            1. 공백 없이 8자에서 30자 이내 한글로 작성
            2. 프로세스명 포함: 어떤 프로세스의 인스턴스인지를 나타내는 이름
            3. 사용자의 이름 포함: 프로세스 인스턴스를 실행시킨 사람의 이름
            4. 날짜 포함: 프로세스가 실행된 시점 (현재 날짜: ${formattedDate})

            - inputData 에서 날짜를 받는 경우 추상적인 오늘 또는 내일등 표현이 절대 들어가면 안되고 무조건 현재 날짜를 기준으로한 날짜로 표시해야 해. e.g. 현재날짜: 2024-01-01 Mon, 내일: 2024-01-02 Thu, 다음주 월요일: 2024-01-08 Mon (오늘 이후로 가장 가까운 월요일이 표시되어야함, 현재 날짜: ${formattedDate})

            (실제 유저의 정보는 프로세스 정의를 확인하여 해당 팀 혹은 역할을 가진 사람을 현재 조직도에서 최대한 찾아주고 액티비티 정보는 프로세스 정의에서 찾아줘.)
            
            이 결과는 다음과 같이 json format 과 함께 리턴해줘.

            그 결과는 다음 설명과 함께 markdown (three backticks) 으로 리턴해줘:
            
            \`\`\`
            {processDefinitionId: "process definition id",
             processDefinitionName: "process definition name",
             processInstanceId:  "${this.uuid()}", // UUID based unique id of the process instance
             processInstanceName:  "process instance name",
             description : "description of process instance’s status in natural language”,
             currentActivityId: "the id of current activity id among the process definition”,
             currentActivityName: "the name of current activity name among the process definition”,
             nextActivityId: "the id of next activity id”,
             nextActivityName: "the name of next activity name”,
             inputData: [{"name”: "name of process data input”, "value”: "real value of the process instance”}],
             currentUserEmail: "the actual user email address of mapped role”,
             nextUserEmail: "the actual user email address of next activity’s role”
            }
            \`\`\`


            사용자 정보:
            ${userInfo}
                        
            
            조직도 정보:
            ${organizationChart}


            프로세스 정의:
            
`
        }];
    }

    setContexts(contexts) {
        this.contexts = contexts;

        contexts.forEach(context => {
            this.previousMessages[0].content += context + "\n\n";
        });
    }

    createPrompt() {
        return this.client.newMessage;
    }

    uuid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }

}