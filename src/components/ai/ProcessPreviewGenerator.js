import AIGenerator from "./AIGenerator";
import promptSnippetData from "./FormDesignGeneratorPromptSnipptsData";

export default class ProcessPreviewGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);
        this.model = "gpt-4o"

        const processDefinition = JSON.stringify(client.processDefinition);

        this.avaliableComponentTagNames = promptSnippetData.componentInfos.map((componentInfo) => componentInfo.tag.match(/\<\/(.*)\>/)[1].toLowerCase())
        

        // 컨테이너 조합, 컴포넌트 정보, 예시를 프롬프트에 적용하기 위한 문자열을 생성하기 위해서
        const containerSpaceSetsPromptStr = 
          promptSnippetData.containerSpaceSets.map((containerSpaceSet) => "{" + containerSpaceSet.join(", ") + "}").join(", ")

        const componentInfosPromptStr = "[" +
          promptSnippetData.componentInfos.map(
            (componentInfo) => `{태그: '${componentInfo.tag}', 목적: ${componentInfo.purpose}${(componentInfo.limit) ? `, 주의사항: ${componentInfo.limit}` : ""}}`)
            .join(",") + "]"
        
        const examplePromptStr = (promptSnippetData.examples && (promptSnippetData.examples.length > 0)) ? ("* 예시\n- 이 설명은 예시일 뿐이며, 실제 출력 내용은 사용자가 전달한 정보를 기반으로 생성되는 것이니, 주의해야 해.\n" + 
          promptSnippetData.examples.map((example) => `- 입력: ${example.input}\n- 출력: ${example.output}`).join("\n")) : ""

        this.previousMessages = [{
            role: 'system', 
            content: `너는 기존 프로세스 또는 폼 정보를 이용하여 사용자가 프로세스 또는 폼 수정 요청을 했을때, 아래의 규칙에 맞게 결과를 생성해줘야해.
            기존 프로세스 내용: ${ processDefinition }
            폼 내용: { 폼 내용 }

            프로세스 변경: 프로세스 정의의 일 부분이 변경될 때는 다음과 같이 변경된 부분만 리턴해야해.
              이때 지킬 사항:
               1.  {modifications: [..]} 내에 여러개의 항목으로 넣어줘.
               2.  액티비티, 게이트웨이, 이벤트 추가인 경우는 시퀀스도 꼭 연결해줘.
               3.  액티비티, 게이트웨이, 이벤트가 삭제되는 경우는 나와 연결된 앞뒤 액티비티 간의 시퀀스도 삭제하되, 삭제된 액티비티의 이전 단계와 다음단계의 액티비티를 시퀀스로 다시 연결해줘.
               4.  생성될 모든 값들은 기존 프로세스의 정보를 참고하여 생성해야한다.
               5.  추가되는 액티비티의 이전 단계 액티비티의 id도 beforeActivity에 반드시 넣어.
               6.  추가될 액티비티, 게이트웨이의 "role" 은 기존에 존재하는 "roles" 에 존재하는 role 중 하나를 사용해야한다. "roles" 에 존재하지 않는 role 을 사용할 수는 없다.
               7.  기존 액티비티들의 위치정보는 바뀌면 안돼.
               8.  추가될 액티비티, 게이트웨이의 위치는 프로세스의 위치와 크기에 대한 설명을 참고하여 기존 액티비티의 위치를 참고하여 생성해줘.
               9.  이름이 들어가는것은 반드시 전부 한글로 할 것
               10. 절대로 JSON 내부에 주석이 있으면 안돼.
               11. 중간에 액티비티가 추가된다면, 추가된 액티비티의 앞뒤 액티비티 간의 Sequence도 반드시 삭제해.
               12. Sequence는 replace가 없어. add 혹은 delete 해야해.
               13. id는 반드시 영어로 들어가야 함
            \`\`\`
              { 
                "modifications": [
                  
                  {
                    "action": "replace" | "add" | "delete",
                    "targetJsonPath": "$.activities[?(@.id=='request_vacation')]", // action 이 add 인 경우 "$.activities" 만 리턴. e.g. "$.sequences", action 이 add 가 아닌 경우 "$.activities[?(@.id=='request_vacation')]" 와 같이 수정, 삭제될 Path 의 상위 목록("activities", "sequences" 등...)을 참고하여 "$.activities" 뒤에 수정, 삭제될 값을 찾을 수 있는 필터("[?(@.id=='request_vacation')]") 를 반드시 포함하여 리턴.  // e.g. "$.sequences[?(@.source=='leave_request_activity' && @.target=='leave_approval_activity')].condition"
                    "value": {...}, //delete 인 경우에는 삭제 될 Sequence의 id를 {"id": "삭제 될 Sequence의 id"} 형식으로 리턴, replace의 경우 기존 value에서 변경된 부분을 수정하여 생략 하지 않고 value로 리턴
                    "beforeActivity": "" // 추가 되거나 변경 되는 Activity의 이전 단계 Activity의 id,
                    "messageForUser": "사용자 요청에 의해 변경되었다는 내용의 메시지, // 각 변경점 또는 상황에 맞게 최대한 짧게 작문할 것"
                  }   
                ]
              }
            \`\`\`

            폼 변경: 
            - 처음으로 폼 생성
            이미 만들어진 폼에 관련된 정보가 없을 경우에는 다음과 같은 지시에 따라서 반환해야 해.

            * 레이아웃 구성
            맨 처음에는 각 컴포넌트를 넣기 위한 레이아웃을 만들어줘야 해.
            레이아웃의 구성 예는 다음과 같아.
            """
            <section>
              <div class='row' name='<이 레이아웃의 고유한 이름>' alias='<이 레이아웃의 별명>' is_multidata_mode='<true|false>'>
                  <div class='col-sm-6'>
                  </div>
                  <div class='col-sm-6'>
                  </div>
              </div>
            </section>
            """
            다음과 같이 section으로 감싸진 "class='row'"가 선언된 div안에 "class='col-sm-{숫자}'"로 지정된 div들을 생성해서 각 칼럼이 차지하는 공간을 각각 만들어주면 돼.
            하나의 section은 자식 요소로 하나의 "class='row'"가 선언된 div를 가질 수 있음에 주의해야해.
            하나의 "class='row'"가 선언된 div안에 들어가는 "class='col-sm-{숫자}'"에서 '{숫자}'의 총합은 12가 되어야 하고, 반드시 아래에 제시되는 숫자 조합 중에 하나를 사용해야 해.
            > 허용되는 숫자 조합: ${containerSpaceSetsPromptStr}

            class='row'로 선언된 div 안에는 name, alias 이외에도 is_multidata_mode 속성을 설정할 수 있어.
            is_multidata_mode이 true인 경우에는 내부에서 사용되는 컴포넌트들을 사용해서 마치 테이블의 행을 추가하는 것 처럼 사용할 수 있어.
            is_multidata_mode이 false인 경우에는 일반적인 레이아웃과 동일하게 동작해.

            레이아웃은 중첩해서도 사용할 수 있어.
            중첩해서 사용할 경우에는 반드시 'col-sm-{숫자}'로 지정된 div안에 이전과 같이 section 태그를 사용해서 넣어줘야 해.
            예를 들어 다음과 같이 이중으로 레이아웃을 중첩시킬 수 있어.
            """
            <section>
              <div class='row' name='<이 레이아웃의 고유한 이름>' alias='<이 레이아웃의 별명>' is_multidata_mode='<true|false>'>
                <div class='col-sm-12'>
                  <section>
                    <div class='row' name='<이 레이아웃의 고유한 이름>' alias='<이 레이아웃의 별명>' is_multidata_mode='<true|false>'>
                      <div class='col-sm-6'>
                      </div>
                      <div class='col-sm-6'>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </section>
            """

            * 컴포넌트 추가
            레이아웃을 만들었다면, 이제 각 컴포넌트를 추가해 줘야 해.
            컴포넌트에는 다음과 같은 주의 사항이 있어.
            1. 만약에 태그의 속성이 "<>"로 감싸져 있다면, 너는 그 속성을 "<>"에 적혀있는 지시를 따라서 교체해 줘야 해.
            2. 만약에 태그의 속성이 "<>"로 감싸져 있지 않다면, 너는 그것이 상수라고 생각하고 그 속성을 그대로 적어줘야 해.
            3. "<>" 안에 값이 '|'로 나열된 경우, 너는 그 값 중 하나를 선택해서 적어줘야 해.(예 : "<값1>|<값2>|<값3>")
            4. 배열이 아닌 문자열이 태그의 속성에 들어가는 경우, 값은 한글, 숫자, 영문자, 공백, 밑줄(_), 대시(-), 점(.)만 가능해.
            5. items과 같은 배열인 문자열이 들어가는 경우에는 각각의 키와 값이 한글, 숫자, 영문자, 공백, 밑줄(_), 대시(-), 점(.)만 가능해.
            6. items과 같은 배열에 '...'과 같이 나열하는 문자는 쓸 수 없어. 나열해야 할 정도로 긴 경우에는 그냥 text-field 태그를 써줘.
            7. items에 들어가는 각각의 키는 고유해야 해. 즉, 중복된 키가 존재하면 안돼.
            8. 모든 컴포넌트는 반드시 'col-sm-{숫자}'로 지정된 div 안에 들어가야 해.
            9. 여기서 제시한 태그의 속성만을 적어야 하고, 반드시 전부 다 적어줘야 해.

            사용해야 하는 컴포넌트는 다음과 같아.
            ${componentInfosPromptStr}

            응답 시에는 절차나 과정 같은 것은 따로 설명하지 말고, 바로 JSON 응답만 출력하도록 하면 돼.
            JSON 응답은 markdown 으로, three backticks 로 감싸줘야 내가 이 결과를 사용해야 한다는 걸 알 수 있으니까 명심해.
            \`\`\`
            {
              "htmlOutput": "생성된 폼 HTML 코드"
            }
            \`\`\`
            
            - 기존의 폼 변경
            이미 만들어진 폼이 있는 경우에는 변경을 하기위한 지시사항들을 생성해줘야 해.
            변경인 경우도 변경된 최종 결과가 '처음으로 폼 생성'에서 했던 주의 사항을 지켜줘야 한다는 점을 명심해야 해.

            변경에 대한 지시사항은 action, targetCSSSelector 속성을 반드시 사용해야 하고 추가 및 변경시에는 tagValue라는 속성을 반드시 사용해야 해.
            action은 변경에 대한 종류이고, targetCSSSelector는 변경시에 사용하게 되는 CSS 선택자이고, tagValue는 변경시에 활용되는 태그 값이야. 삭제시에는 사용하지 않아도 돼.
            targetValue에는 하나의 태그 값만 넣을 수 있어. 여러개의 태그를 활용하고 싶을 경우에는 각 태그에 대해서 지시사항을 여러개 생성해주면 돼.

            변경되는 타입은 action이라는 속성으로 addAsChild, addAfter, replace, delete라는 값을 사용해서 지정할 수 있어.
            addAsChild는 targetCSSSelector 속성에 부모 태그의 CSS 선택자를 넣어서 그 부모 태그의 자식 태그로 tagValue를 추가할 수 있어.
            addAfter는 targetCSSSelector 속성에 추가 시킬 위치 앞의 태그의 CSS 선택자를 넣어서 선택된 태그의 뒤에 tagValue를 추가할 수 있어.
            replace는 targetCSSSelector 속성에 변경시킬 태그의 CSS 선택자를 넣어서 그 태그를 tagValue로 교체시킬 수 있어.
            delete는 targetCSSSelector 속성에 삭제시킬 태그의 CSS 선택자를 넣어서 그 태그를 삭제시킬 수 있어.

            응답 시에는 절차나 과정 같은 것은 따로 설명하지 말고, 바로 JSON 응답만 출력하도록 하면 돼.
            JSON 응답은 markdown 으로, three backticks 로 감싸줘야 내가 이 결과를 사용해야 한다는 걸 알 수 있으니까 명심해.
            \`\`\`
            {
              "modifications":[
                {
                  "action": "addAsChild" | "addAfter" | "replace" | "delete",
                  "targetCSSSelector": "CSS 선택자",
                  "tagValue": "하나의 단일 HTML 태그 값",
                  "messageForUser": "사용자 요청에 의해 변경되었다는 내용의 메시지, // 각 변경점 또는 상황에 맞게 최대한 짧게 작문할 것"
                }
              ]
            }
            \`\`\`
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