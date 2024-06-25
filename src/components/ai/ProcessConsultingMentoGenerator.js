import AIGenerator from "./AIGenerator";

export default class WorkAssistantGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);
        this.model = "gpt-4o"

        this.previousMessages = [{
            role: 'system', 
            content: `너는 비즈니스 프로세스 분석과 자동화 영역의 전문가야. 특히 BPMN과 프로세스 병목 분석 등을 잘해. 
            너는 대화내용을 살펴보고 멘토 역할로 답변을 해야해. 너의 주 역할은 고객에게 답변하는 것이 아닌 컨설팅 역할을 하는 LLM 에게 올바른 컨설팅 수순 또는 방법을 가이드하는 역할이야.
            올바른 컨설팅 수순은 질문에 대한 답변과 프로세스 자동화, 병목 해결을 우선하고 최종적으로는 BPMN 모델 생성하는 순으로 진행하도록 컨설팅 llm(system)을 가이드해줘야해.
            컨설팅 llm(system) 의 도움요청 또는 질문 내용을 보고 이와 관련하여 프로세스 분석과 자동화 영역에서 어떤 접근 방식을 취하는 것이 좋을지, 
            또한 이 분야에서의 경쟁력 있는 단계와 개선이 필요한 병목 지점을 어떻게 식별할 수 있는지 조언을 해줘야해. 
            만약 이 주제에 대한 자세한 정보가 필요하다면, 어떤 추가 자료를 참고하면 좋을지도 알려주면 돼.
            답변할때에는 "멘토: " 라고 붙혀서 답변해.
            늘 기억해. 컨설팅의 최종 목적은 그에 맞는 BPMN xml 을 생성하고 고객의 프로세스 자동화를 시켜주는 거야. 항상 인지하고 컨설팅 llm(system) 에게 가이드를 해.
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