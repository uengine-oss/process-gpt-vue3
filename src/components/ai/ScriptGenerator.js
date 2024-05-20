import AIGenerator from "@/components/ai/AIGenerator";

export default class ScriptGenerator extends AIGenerator{

    constructor(client, language){
        super(client, language);
        
        this.previousMessages = [{
          role: 'system', 
          content: `사용자가 입력한 프롬프트를 따라서 그대로 응답해줘.`
        }]
    }

    generateScript(prompt, prevScript) {
        // const prevFormOutput = ((this.client.prevFormOutput !== '<section></section>') ? (
        //   `이전에 만들어진 폼이 있고, 현재 수정하려고 해.
        //   따라서, '기존의 폼 변경' 가이드를 활용해서 수정과 관련된 JSON 객체를 반환시켜줘.
        //   이 폼은 무조건 최신 결과라고 생각하면 돼.
        //   이 이후의 채팅과 관계없이 해당 폼 HTML을 기준으로 작업해줘.
        //   이전에 만들어진 폼은 다음과 같아.\n\`\`\`` + this.client.prevFormOutput) + `\`\`\`` : "")
        
        
        // const copiedPrevMessageFormat = {...this.prevMessageFormat}
        // copiedPrevMessageFormat.content = copiedPrevMessageFormat.content.replace("{{prevMessageFormat}}", prevFormOutput)
        // this.previousMessages = [copiedPrevMessageFormat];
        
        
        console.log("### 전달되는 시스템상 AI 메시지 ###")
        console.log(this.previousMessages)
        this.client.sendMessage({
            image: null,
            text: prompt,
            mentionedUsers: null
        });
  }

  createMessages() {
    // let messages = super.createMessages();
    // messages[messages.length - 1].content = `- 입력: ${messages[messages.length - 1].content}\n- 출력: `
    // return [messages[0], messages[messages.length - 1]];
    return super.createMessages();
  }

  createPrompt(){
     return this.client.newMessage
  }
}