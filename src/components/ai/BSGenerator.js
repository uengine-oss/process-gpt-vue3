import AIGenerator from "./AIGenerator";

export default class BSGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);
        const jsonData = this.client.jsonData;

        this.contexts = null;
        this.model = 'gpt-4o';

        
        this.previousMessages = [{
          role: 'system',
          content: `
        당신은 Balanced Scorecard 기반의 전략맵 생성 도우미입니다.
        
        다음 4가지 관점이 있으며, 나열 순서에 따라 상위 → 하위 관계입니다:
        1. 재무
        2. 고객
        3. 내부 프로세스
        4. 학습 및 성장
        
        사용자가 입력한 자연어 설명에는 각 관점에 해당하는 목표들이 등장합니다.  
        당신의 역할은 이 목표들을 분석하여 아래 JSON 형태로 출력하거나, 수정, 삭제, 연결 추가 요청에 맞게 전략 정보를 업데이트하는 것입니다.
        
        - 각 전략은 다음 필드를 가집니다:
          - id: 고유 ID (예: "s1", "s2" 등)
          - name: 전략명 (간결한 요약)
          - description: 전략 설명 (조금 더 구체적으로)
          - perspective: 관점 (예: "재무", "고객", "내부 프로세스", "학습 및 성장")
          - parents: 바로 상위 관점의 관련 전략 ID 목록
        
        - 관점 구조 규칙:
          - 상위 관점 → 하위 관점으로만 연결합니다.
            예: 재무 → 고객 → 내부 프로세스 → 학습 및 성장
          - 같은 관점끼리는 연결하지 않으며, 두 단계를 건너뛰는 연결은 허용되지 않습니다.
          - 입력에 명시된 연결이 없으면 가능한 구조를 추론하여 parents를 배정합니다.
        
        ⚠️ **기본 규칙**:
        - 기존 전략맵이 존재하는 경우, 사용자가 **"초기화", "새로 시작"** 등을 명시적으로 지시하지 않는 이상 전략맵을 새로 생성하지 마십시오.
        - 새 전략은 기존 구조에 **병합**해야 하며, 기존 전략 ID는 유지되어야 합니다.
        - 전략 ID는 고유해야 하며, 기존 ID와 충돌하지 않도록 주의해야 합니다.
        
        ✅ **사용자가 요청할 수 있는 행동**:
        1. **전략 추가**: 새로운 전략을 기존 전략에 연결하여 삽입합니다.
        2. **전략 수정**: 특정 ID 또는 이름의 전략의 이름/설명을 수정합니다.
        3. **전략 삭제**: 특정 ID 또는 이름의 전략을 제거합니다.
        4. **전략 연결 추가**: 특정 전략 A → B로 연결을 추가합니다. 단 관점 규칙을 위반해서는 안 됩니다.
        
        📦 예시 출력 형식:
        \`\`\`json
        {
          strategies: [
            { "id": "s1", "name": "영업이익률 40% 달성", "description": "올해 영업이익률 40% 목표", "perspective": "재무", "parents": [] },
            { "id": "s2", "name": "고객 유치율 20% 증가", "description": "전년 대비 고객 유치율 20% 증가", "perspective": "고객", "parents": ["s1"] },
            { "id": "s3", "name": "Agile 개발 도입", "description": "전사 agile 개발 도입 및 생산성 30% 향상", "perspective": "내부 프로세스", "parents": ["s2"] },
            { "id": "s4", "name": "클라우드 학습 완료", "description": "모든 개발자의 클라우드 학습 완료", "perspective": "학습 및 성장", "parents": ["s3"] }
          ]
        }
        \`\`\`
        
            - 기존 전략맵: 
            ${JSON.stringify(jsonData)}
        
        이제 사용자의 다음 입력을 받아 전략 JSON을 적절히 생성, 수정, 삭제 또는 연결 추가하세요.
          `
        }];
        
    }


    createPrompt() {
      const newMessage = this.client.newMessage;
      const message = `
            - 사용자의 입력:
            ${newMessage}
            `;
      return message;
    }
      

}
