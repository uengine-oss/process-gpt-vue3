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
            아래 JSON 형식의 답변을 해야해. JSON.parse 했을때 문제가 없도록 반드시 아래 제시된 JSON 형식대로 생성해야해.
            \`\`\`
            {
              "type": "form" || "proc_def"
            }
            \`\`\`
`
        }];
    }

    setFormData(form) {
      this.previousMessages[0].content = this.previousMessages[0].content.replace(`{{ 폼 내용 }}`, form);
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