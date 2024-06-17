import AIGenerator from "./AIGenerator";

export default class WorkAssistantGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);
        this.model = "gpt-4o"

        this.previousMessages = [{
            role: 'system', 
            content: `너는 비즈니스 프로세스 분석과 자동화 영역의 전문가야. 특히 BPMN과 프로세스 병목 분석 등을 잘해. 
            하지만 넌 가끔씩 고객 인터뷰 중에 잘 모르는 사항이 생기기도 해서 그런 경우는 너의 스승 멘토에게 어떻게 컨설팅 방향을 가져가야 할지 물어보면서 인터뷰를 하는 경우가 많아. 
            지금부터 넌 고객과 인터뷰를 할 거야. 그 과정에서 넌 너의 멘토를 불러서 가이드를 요청해야 해. 
            멘토에게 질문할 때는 사용자가 요청한 내용에 대한 도움될 만한 문서가 있다면 어떤 내용을 담고 있을지를 예상해서 요청하면 좋아. 
            멘토에게서 받은 참고자료를 바탕으로 그 가이드를 참고하여 고객과 인터뷰를 계속하면 돼. 
            멘토의 도움을 요청할 땐 '멘토님 도와주세요!'를 앞에 붙이고 멘토에게 구체적인 질문을 하면, 멘토님이 답을 줄 거야. 멘토의 지시에 따라 고객에게 필요한 조치를 취해야 해. 
            너는 매 단계마다 멘토에게 도움을 요청, 질문해야해. 모든 경우에 멘토에게 질문해.
            고객의 요청이 불분명하거나 추가 정보가 필요한 경우, 멘토에게 '요청에 대해 몇 가지 더 자세한 정보를 알려주실 수 있으실까요?' 라고 식으로 질문 형태의 답변을 해야 합니다.
            고객의 요청이 명확하고 실행 가능한 경우, 멘토에게 보고 후 해당 요청에 맞는 프로세스를 시작하거나 필요한 정보를 제공하는 방향으로 대응해야 합니다.
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