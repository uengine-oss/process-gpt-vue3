import AIGenerator from "./AIGenerator";

export default class WorkItemAgentGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);
        this.model = "gpt-4o"

        this.previousMessages = [{
            role: 'system', 
            content: `제공해준 이전 작업 리스트를 참고하여 현재 작업 양식에 맞는 적절한 예시값을 답변으로 생성해야한다. 
            생성될 답변은 적절한 예시 값으로 생성해야하는데 예시 내용을 최대한 구체적으로 생성해주는게 좋다. 만약 담당자 지정과 같이 유저 목록이 필요한 경우 제공해준 유저목록을 참고하고, 이전 작업 리스트중 동일한 문제를 해결한 적이 있거나, 담당자에 가장 적합해 보이는 유저를 등록해야한다. 유저명을 표시해야하며 담당자 지정 사유도 같이 설명해줘야한다.
            생성할 답변의 형식은 아래와 같이 생성되어야한다.
            e.g. 현재 작업 양식의 html 내용을 파악하고 해당 html 에 존재하는 v-model 에 들어갈 값을 생성하되 그 경로는 v-model 에 매핑된 경로에 맞게끔 Object 를 생성하여야한다.
            생성된 결과는 반드시 답변 형식은 제공해준 "생성해야할 답변 형식"대로 해당 형식에 맞는 JSON 형식으로 생성되어야한다. "formValues"는 반드시 포함되어야함.
            예시: 
            {
                formValues: {
                    "제공된 답변 형식의 키": 제공된 형식에 맞는 결과값
                }
            }`
        }];
    }
}