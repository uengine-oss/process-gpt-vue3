import AIGenerator from "@/components/ai/AIGenerator";
import promptSnippetData from "./FormDesignGeneratorPromptSnipptsData";

// '화면 정의' 메뉴에서 AI를 통한 폼 생성을 위한 생성기 클래스
export default class FormDesignGenerator extends AIGenerator{

    constructor(client, language){
        super(client, language);


        // 유효한 컴포넌트 이름 목록을 형성해서 향후 유효성 검증시에 시용
        this.avaliableComponentTagNames = promptSnippetData.componentInfos.map((componentInfo) => componentInfo.tag.match(/\<\/(.*)\>/)[1].toLowerCase())
        

        // 컨테이너 조합, 컴포넌트 정보, 예시를 프롬프트에 적용하기 위한 문자열을 생성하기 위해서
        const containerSpaceSetsPromptStr = 
          promptSnippetData.containerSpaceSets.map((containerSpaceSet) => "{" + containerSpaceSet.join(", ") + "}").join(", ")

        const componentInfosPromptStr = "[" +
          promptSnippetData.componentInfos.map(
            (componentInfo) => `{태그: '${componentInfo.tag}', 목적: ${componentInfo.purpose}${(componentInfo.limit) ? `, 주의사항: ${componentInfo.limit}` : ""}}`)
            .join(",") + "]"
        
        const examplePromptStr = (promptSnippetData.examples && (promptSnippetData.examples.length > 0)) ? ("* 예시\n" + 
          promptSnippetData.examples.map((example) => `- 입력: ${example.input}\n- 출력: ${example.output}`).join("\n")) : ""

        
        this.prevMessageFormat = {
          role: 'system', 
          content: `
          너는 프로세스를 진행하기 위한 HTML 폼을 만들어주는 도우미야.
          너는 사용자가 지시한 사항에 따라서 폼을 만들 수 있고, 사용자가 폼과 관련된 이미지를 전달했을 경우, 최대한 유사하게 HTML 폼을 만들어줘야 해.
          단, 너는 주어진 메뉴얼에 있는 태그만을 활용해서 폼을 만들어야 해.

          메뉴얼:
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
                "tagValue": "하나의 단일 HTML 태그 값"
              }
            ]
          }
          \`\`\`

          {{prevMessageFormat}}

          ${examplePromptStr}
`
          }
    }

    /**
     * 이전에 이미 만들어 놓은 HTML 폼 데이터가 있을 경우, 이 데이터를 System 메세지에 포함시키기 위해서
     */
    sendMessageWithPrevFormOutput(newMessage) {
          const prevFormOutput = ((this.client.prevFormOutput !== '<section></section>') ? (
            `이전에 만들어진 폼이 있고, 현재 수정하려고 해.
            따라서, '기존의 폼 변경' 가이드를 활용해서 수정과 관련된 JSON 객체를 반환시켜줘.
            이 폼은 무조건 최신 결과라고 생각하면 돼.
            이 이후의 채팅과 관계없이 해당 폼 HTML을 기준으로 작업해줘.
            이전에 만들어진 폼은 다음과 같아.\n\`\`\`` + this.client.prevFormOutput) + `\`\`\`` : "")
          
          
          const copiedPrevMessageFormat = {...this.prevMessageFormat}
          copiedPrevMessageFormat.content = copiedPrevMessageFormat.content.replace("{{prevMessageFormat}}", prevFormOutput)
          this.previousMessages = [copiedPrevMessageFormat];
          
          
          console.log("### 전달되는 시스템상 AI 메시지 ###")
          console.log(this.previousMessages)
          this.client.sendMessage(newMessage);
    }

    createMessages() {
      let messages = super.createMessages();

      if(this.model.includes("vision"))
      {
        const textMessage = messages[messages.length - 1].content.filter((message) => message.type === "text")[0]
        if(textMessage.text.length <= 0) textMessage.text = "전달한 이미지를 활용해서 폼을 생성해주세요."
        textMessage.text = `- 입력: ${textMessage.text}\n- 출력: `
      }
      else
        messages[messages.length - 1].content = `- 입력: ${messages[messages.length - 1].content}\n- 출력: `

      return [messages[0], messages[messages.length - 1]];
    }

    createPrompt(){
       return this.client.newMessage
    }

}