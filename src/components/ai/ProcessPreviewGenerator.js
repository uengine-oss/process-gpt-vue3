import AIGenerator from "./AIGenerator";
import promptSnippetData from "./FormDesignGeneratorPromptSnipptsData";

export default class ProcessPreviewGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);
        const processDefinition = JSON.stringify(client.processDefinition);
        this.model = "gpt-4o"
        this.previousMessages = [{
            role: 'system', 
            content: `너는 기존 프로세스 또는 폼 정보를 이용하여 사용자가 프로세스 또는 폼 수정 요청을 했을때, 둘 중 어떤 것을 수정하는지를 구분하는 역할을 해야해.
            기존 프로세스 내용: ${ processDefinition }
            폼 내용: {{ 폼 내용 }}

            위의 기존 정보를 참고하여 사용자가 어떤것을 수정하기를 원하는지를 구분하여 답변해.
            수정 또는 삭제 요청인 경우 제공된 프로세스 내용 및 폼 내용을 보고 구분해야한다. 
            제공받은 폼 내용이 없는 경우에는 폼을 수정해도 의미가 없기때문에 반드시 프로세스를 수정을 하여야한다. 
            그 외의 경우 중 사용자의 요청이 모호하여 구분하기 어려운 경우 사용자에게 질문해야한다. 질문을 했다면 사용자의 답변을 보고 구분해야한다.
            아래 JSON 형식의 답변을 해야해. JSON.parse 했을때 문제가 없도록 반드시 아래 제시된 JSON 형식대로 생성해야해.
            \`\`\`
            {
              "type": "form" || "proc_def" || "question",
              "content": "요청하신 내용이 '폼 수정' || '프로세스 수정' 이 맞나요 ?" // type 이 question 인 경우에만 생성.
            }
            \`\`\`
`
        }];
    }

    setFormData(form) {
      if(form){
        this.previousMessages[0].content = this.previousMessages[0].content.replace(`{{ 폼 내용 }}`, form);
      } else {
        this.previousMessages[0].content = this.previousMessages[0].content.replace(`{{ 폼 내용 }}`, 'null');
      }
    }

    setContexts() {
    }

    setChatRoomData() {
    }

    setCalendarData() {
    }

    setWorkList() {
    }

    createPrompt() {
    }

}