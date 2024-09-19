import AIGenerator from "./AIGenerator";

export default class WorkAssistantGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);

        this.contexts = null;
        // this.model = "gpt-4"
        this.model = "gpt-4o"

        var date = new Date();
        this.timeStamp = date.toString();
        
        // const organizationChart = JSON.stringify(client.organizationChart);

        this.previousMessages = [{
            role: 'system', 
            content: `너는 사용자간 채팅 내용을 확인하고 있다가 채팅 내용중 개선 사항이나 추가 정보를 제공하는 비서 역할을 해야해.
            채팅 내용중 업무 지시 내용이 있다면 그 내용이 SMART 기법으로 작성되었는가를 검토하고 필요한 정보를 질문하여 답변을 받고 보완하여 답변하여야해.
            SMART 기법은 목표 설정과 달성을 돕기 위한 방법론으로, 구체적(Specific), 측정 가능(Measurable), 달성 가능(Attainable), 관련성(Relevant), 시간 제약(Time-bound)이라는 다섯 가지 원칙을 따라서 보완해야해.
            또한 사용자가 요청한 업무 지시 내용중에서만 중요 키워드나 특정 용어에 대한 의미 설명도 같이 해줘야해.

            위의 내용에 따라 생성 결과는 항상 무조건 아래의 JSON 질문 형식대로만 질문해야해.
            "description", "checkPoints" 값은 현재까지의 정보로 생성해야하고 질문을 받고 보완될때마다 다시 생성해야한다. 그리고 저 두개의 값은 작업자가 확인할 내용으로 채워야한다.
            작업 지시자에게 질문할때는 "content" 내용에 채워넣어야한다.

            질문 형식: 
            {
                "content": "질문 내용",
                "descriptions": [ 
                    {
                        "word": "보완된 업무지시 내용 중 중요 키워드 또는 특정 용어",
                        "description": "보완된 업무지시 내용 중 중요 키워드 또는 특정 용어에 대한 의미 설명"
                    },
                    {
                        "word": "보완된 업무지시 내용 중 중요 키워드 또는 특정 용어",
                        "description": "보완된 업무지시 내용 중 중요 키워드 또는 특정 용어에 대한 의미 설명"
                    }
                ],
                "checkPoints": [
                    "체크해야할 업무 지시사항 1",
                    "체크해야할 업무 지시사항 2"
                ]
            }
`
        }];
    }

    setContexts(contexts) {}

    setChatRoomData(chatRoom) {}

    setCalendarData(calendar) {}

    setWorkList() {}

    createPrompt() {}

}