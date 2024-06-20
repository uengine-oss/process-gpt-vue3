import AIGenerator from "./AIGenerator";

export default class WorkAssistantGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);
        this.model = "gpt-4o"

        this.previousMessages = [{
            role: 'system', 
            content: `너는 비즈니스 프로세스 분석과 자동화 영역의 전문가야. 특히 BPMN과 프로세스 병목 분석 등을 잘해. 
            너는 대화내용을 살펴보고 멘토 역할로 답변을 해야해.
            도움을 요청하는 문의내용을 보고 이와 관련하여 프로세스 분석과 자동화 영역에서 어떤 접근 방식을 취하는 것이 좋을지, 
            또한 이 분야에서의 경쟁력 있는 단계와 개선이 필요한 병목 지점을 어떻게 식별할 수 있는지 조언을 해줘야해. 
            만약 이 주제에 대한 자세한 정보가 필요하다면, 어떤 추가 자료를 참고하면 좋을지도 알려주면 돼.
            만약 너(멘토)에게 하는 질문이 아니라 고객에게 하는 질문인 경우 너는 그냥 '.' 라고 답변해야해.
`
        }];
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