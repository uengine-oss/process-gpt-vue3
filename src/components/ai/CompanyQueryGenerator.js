import AIGenerator from "./AIGenerator";

export default class CompanyQueryGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);

        this.model = "gpt-4o"
        this.simplifiedProcesses = null;
        this.detailedData = null;
        this.queryType = 'general';
        
        this.previousMessages = [{
            role: 'system', 
            content: `너는 회사 내 정보를 조회하는 AI 어시스턴트야.
사용자의 질문에 정확하고 친절하게 답변해야 해.

## 제공된 기본 정보:
- 간소화된 프로세스 목록 (id, name, description만 포함): {{ 간소화된 프로세스 목록 }}
- 현재 사용자 정보: {{ 사용자 정보 }}
- 오늘 날짜: {{ 오늘 날짜 }}

## 상세 정보 (2단계에서 제공됨):
{{ 상세 정보 }}

## 답변 규칙:
1. **1단계 (기본 정보만 있을 때)**:
   - 간소화된 프로세스 목록만으로 답변 가능하면 바로 답변
   - 추가 정보가 필요하면 어떤 정보가 필요한지 명확히 지정
   
2. **2단계 (상세 정보가 추가된 경우)**:
   - 상세 정보를 활용하여 최종 답변 생성
   - 표 형식이나 목록 형식으로 정리하여 제공

3. **답변은 반드시 JSON 형식**:
   - 기본 정보만으로 답변 가능한 경우:
   {
       "answer": "사용자 질문에 대한 완전한 답변",
       "needMoreInfo": false
   }
   
   - 추가 정보가 필요한 경우:
   {
       "answer": "현재까지 파악한 내용 (간단히)",
       "needMoreInfo": true,
       "requiredDataType": "processDetail" | "instances" | "organization",
       "requiredProcessIds": ["process_id1", "process_id2"]  // processDetail이나 instances 타입일 때만
   }

## 추가 정보 타입 설명:
- **processDetail**: 특정 프로세스의 전체 정의 정보 (activities, sequences, roles 등)
- **instances**: 실행 중인 프로세스 인스턴스 목록 (전체 또는 특정 프로세스의)
- **organization**: 조직도 정보

반드시 JSON 형식으로만 답변하고, 추가 설명은 하지 마.
`
        }];
    }

    setSimplifiedProcesses(processes) {
        this.simplifiedProcesses = processes;
        const processListStr = JSON.stringify(processes);
        this.previousMessages[0].content = this.previousMessages[0].content.replace(
            `{{ 간소화된 프로세스 목록 }}`, 
            processListStr
        );
    }

    setUserInfo(userInfo) {
        const userInfoStr = JSON.stringify({
            id: userInfo.uid || userInfo.id,
            name: userInfo.name,
            email: userInfo.email,
            department: userInfo.department || ''
        });
        this.previousMessages[0].content = this.previousMessages[0].content.replace(`{{ 사용자 정보 }}`, userInfoStr);
    }

    setToday() {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')} (${['일', '월', '화', '수', '목', '금', '토'][today.getDay()]}요일)`;
        this.previousMessages[0].content = this.previousMessages[0].content.replace(`{{ 오늘 날짜 }}`, todayStr);
    }

    setDetailedData(data) {
        this.detailedData = data;
        const dataStr = JSON.stringify(data);
        this.previousMessages[0].content = this.previousMessages[0].content.replace(
            `{{ 상세 정보 }}`, 
            dataStr || '없음'
        );
    }

    setQueryType(type) {
        this.queryType = type;
    }

    createPrompt() {
        const lastMessage = this.previousMessages[this.previousMessages.length - 1];
        if (lastMessage.role === 'user') {
            lastMessage.content = `${lastMessage.content}. 위의 JSON 형식으로 답변해.`;
        }
        return this.client.newMessage;
    }

}

