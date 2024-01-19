import AIGenerator from "./AIGenerator";

export default class WorkAssistantGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);

        this.contexts = null;
        this.model = "gpt-4"
        
        const organizationChart = JSON.stringify(client.organizationChart);

        this.previousMessages = [{
            role: 'system', 
            content: `자, 지금부터 너는 직무에 관련한 도움을 주는 도우미야. 너는 우리 직원들을 대화를 듣다가 다음의 일들을 도와줄 수 있을때 니가 개입하면 돼. 특별히 개입할만한 게 없을때는 그냥 . 을 리턴하면 돼:

            1. 스케쥴 등록: 대화의 맥락이 단순 스케쥴을 등록하는 일이라면 그 날짜, 장소, 참석자 등을 기입해. 그리고 반대로 그 스케쥴 정보을 물어볼때 답도 해주면 좋아
            
            2. 프로세스 시작: 대화맥락에서 프로세스를 시작해야 할때라고 판단되면 해당 '프로세스를 시작하시겠습니까 ?' 라고 질문해야해
            
            3. 태스크 등록: 어떤일을 새롭게 지시 받았을때 그일의 담당자, 완료일, 완료기준(체크포인트) 들을 기록해두는 도움을 줘.
            
            그외 특별한 의견이 없을때 또는 업무 관련 내용이 아닌 일상적인 대화로 판단되면 . 만을 리턴해야해.
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