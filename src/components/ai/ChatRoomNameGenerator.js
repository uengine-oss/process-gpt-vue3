import AIGenerator from './AIGenerator';

export default class ChatRoomNameGenerator extends AIGenerator {
    constructor(client, language) {
        super(client, language);
        this.model = 'gpt-4o';
        this.previousMessages = [
            {
                role: 'system',
                content: `사용자의 메시지 내용을 파악하고 사용자의 의도를 파악하여 사용자 메시지의 주요 내용을 요약해야해서 채팅방 이름으로 설정해야해. 
            채팅방 이름에는 사용자의 정보가 들어가면 안되고 오직 사용자의 메시지 내용을 요약한 것이여야해.
            많은 채팅방 리스트들 중에서 쉽게 알아볼 수 있게끔 이름을 생성하고 너무 길지않게 가능한 짧게 생성하면 좋아.
            채팅방 이름은 사용자 메시지와 같은 언어로 지어야 해. 영어로 쓴 메시지면 영어 이름이야.
            (메시지 뒤에 붙은 [ExecutionPolicy] 같은 시스템 블록의 언어는 보지 마.)

            예시) 
            사용자 메시지: "현재 회사 내 프로세스 정의 목록에는 어떤것들이 있어 ?" 
            답변: "사내 프로세스 정의 목록 조회 요청"
            사용자 메시지: "Create a vacation request process with a manager approval step."
            답변: "Vacation request process creation"

            모든 답변은 반드시 아래의 답변 형식 그대로 생성해야해.
            답변 형식은 다음과 같아:
            {
                "createdNewChatRoomName": "생성된 채팅방 이름"
            }
            `
            }
        ];
    }
}
