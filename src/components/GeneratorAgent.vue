<template></template>

<script>
export default {
    data() {
        return {
            ws: null,
            inputRegex: /Agent: ([^\n|]+)[|\n]Tool: ([^\n|]+)[|\n]Input: ([\s\S]+)/,
            outputRegex: /Agent: ([^\n]+)\nTool Output: ([\s\S]+)/,
            agentInfo: null,
        };
    },
    methods: {
        requestAgent(str){
            this.ws.send(str);
        },
        connectAgent(url){
            if(!url) url = `ws://localhost:6789`
            this.ws = new WebSocket(url);
        },
        receiveAgent(callback){
            var me = this
        
            me.ws.onopen = () => {
                callback({connection: true, data: null})
            };

            me.ws.onmessage = (event) => {
                if(!this.agentInfo) this.agentInfo = {}
                let result = null

                if (event.data.startsWith("Chain started with inputs: ")) {

                } else if(event.data.includes("{'text': ") || event.data.includes("You are a tool for") || event.data.includes("{'topic'")){
                    if(event.data.includes("{'topic'")){
                         // setting 
                        me.agentInfo.topic = this.parseJsonString(event.data)
                    }
                } else if(event.data.includes("Prompt after formatting:")){
                    var summaryIndex = event.data.indexOf("Current summary:");
                    if (summaryIndex !== -1) {
                        var summaryText = event.data.substring(summaryIndex).replace(/\n/g, "<br>");
                        // me.log += summaryText + "<br>";
                    }
                } else if (event.data.includes('"agents":')) {
                    try {
                        let data = JSON.parse(event.data);
                        // setting 
                        me.agentInfo.agents = data.agents.map((agent, index) => ({ ...agent, profile: `/src/assets/images/profile/user-${index + 1}.jpg`}));
                        me.agentInfo.tools = {
                            "Search the internet": '인터넷 검색',
                            "Search Internal Documents": '외부 문서 검색',
                            "Search news on the internet": '인터넷 뉴스 검색'
                        }

                        result = me.convertAgentsContent(event.data, me.agentInfo.agents)
                    } catch (e) {
                        console.error("Error parsing JSON:", e);
                    }
                } else if(event.data.match(me.inputRegex)){
                    result = me.convertInputContent(event.data, me.agentInfo.agents, me.agentInfo.tools)
                } else if (event.data.match(me.outputRegex)) {
                    result = me.convertSearchOutputContent(event.data, me.agentInfo.agents)
                } else {
                    result = me.convertSystemContent(event.data)
                }

                callback({connection: true, data: result}) 
            };

            me.ws.onclose = () => {
                callback({connection: false, data: null})
            }; 
        },
        getAgentInfo(){
            return this.agentInfo
        },
        convertSystemContent(data){
            if(!data) return null;
            const urlRegex = /(출처:\s*https?:\/\/[^\s]+)/g;
            var formattedMessage = data.replace(/\n/g, "<br>");
        
            formattedMessage.replace(urlRegex, (url) => {
                const cleanUrl = url.replace('출처:', '').trim();
                return `<a href="${cleanUrl}" target="_blank">${url}</a>`;
            });

           return {
                "name": 'System',
                "role": 'system',
                "email": "system@uengine.org",
                "content":  {
                    "type": "system",
                    "data": formattedMessage
                },
                "profile": "@/assets/images/chat/chat-icon.png",
                "timeStamp": 1708491834047
            }
        },
        convertAgentsContent(data, agents){
            if(!data) return null;
            if(!agents) agents = []
            if(typeof data == 'string') data = JSON.parse(data)
   
            let content = agents.map((agent, index) => ({
                ...agent,
                explanation: `${agent.name}은 ${agent.backstory}을 바탕으로 ${agent.goal}을 목표를 가진다.<br/><br/>` +
                             `${data.tasks.filter(task => task.agent === agent.name).map(task => `* 업무내용 <br/> - ${task.description}`).join("\n") || ''}`
            }));

            return {
                "name": "System",
                "role": "system",
                "email": "agent@uengine.org",
                "content": {
                    "type": "agents",
                    "data": content
                },
                "profile": "@/assets/images/chat/chat-icon.png",
                "timeStamp": 1708491834047
            }
        },
        convertInputContent(data, agents, tools){
            if(!data) return null;
            if(!agents) agents = []
            if(!tools) tools = {}

            const match = data.match(this.inputRegex);
            const agent = match[1];
            const tool = match[2];
            const input = match[3];
            const toolName = tools && tools[tool] ? tools[tool] : tool
            const agentInfo = agents.find(x=> (x.role == agent) || (x.name == agent))
            const profile = agentInfo ? agentInfo.profile : `/src/assets/images/profile/user-9.jpg`

            let result = {}

            if(input.includes('|') && (toolName.toLowerCase().includes("delegate") || toolName.toLowerCase().includes("co-worker"))) {
                let parseInput = input.split('|')
                let toAgent = parseInput[0] //클라우드 보안 전문가'
                let title = parseInput[1] //'클라우드 네이티브 앱의 보안 이슈 및 적절한 대책 분석하기
                let detail = parseInput[2] // '인터넷에서 찾은 클라우드 네이티브 앱의 보안 이슈 및 대책에 대한 정보를 바탕으로 분석을 … 문제 등에 대한 보안 대책이 어떻게 마련되어야 하는지 중점적으로 살펴주시면 좋겠습니다.'
                let delegateInfo = agents.find(x=> (x.role == toAgent) || (x.name == toAgent))
                let message = `
                    <h3>${title}</h3>
                    <p>${detail}</p>
                `
                result = {
                    "name": agent,
                    "role": agent,
                    "email": "agent@uengine.org",
                    "content": {
                        "type": "delegate",
                        "data": message,
                        "delegate": toAgent,
                        "delegateProfile": delegateInfo ? delegateInfo.profile : `/src/assets/images/profile/user-9.jpg`,
                    },
                    "profile": profile, //"/src/assets/images/profile/user-2.jpg",
                    "timeStamp": 1708491834047
                }
            } else {
                let message =`"${input}"을(를) ${toolName}...`
                result = {
                    "name": agent,
                    "role": agent,
                    "email": "agent@uengine.org",
                    "content": {
                        "type": "search",
                        "data": message
                    },
                    "profile": profile, //"/src/assets/images/profile/user-2.jpg",
                    "timeStamp": 1708491834047
                }
            }

            return result
        },
        convertSearchOutputContent(data, agents){
            if(!data) return null;
            if(!agents) agents = []

            const agentMatch = data.match(this.outputRegex);
            const agent = agentMatch ? agentMatch[1] : "Unknown"; // Agent 정보가 없는 경우 대비
            const agentInfo = agents.find(x=> (x.role == agent) || (x.name == agent))
            const profile = agentInfo ? agentInfo.profile : `/src/assets/images/profile/user-9.jpg`
            let output = null


            if(agentMatch[2].includes('-----------------')){
                if(!output) output = []

                const entries = agentMatch[2].split('-----------------\n').filter(entry => entry.trim() !== '');
                // 각 항목에 대해 반복 처리
                entries.forEach(entry => {
                    const titleMatch = entry.match(/Title: (.+)/);
                    const linkMatch = entry.match(/Link: (.+)/);
                    const snippetMatch = entry.match(/Snippet: (.+)/);
                    if (titleMatch && linkMatch && snippetMatch) {
                        output.push({
                            title: titleMatch[1],
                            link: linkMatch[1],
                            snippet: snippetMatch[1]
                        });
                    }
                });
            } else {
                output = agentMatch[2].replace(/\n/g, "<br>"); // string
            }
        
            return {
                "name": agent,
                "role": agent,
                "email": "agent@uengine.org",
                "content": {
                    "type": "searchOutput",
                    "data": output
                },
                "profile": profile,
                "timeStamp": 1708491834047
            }
        },
        transformLinks(content) {
            const urlRegex = /(출처:\s*https?:\/\/[^\s]+)/g;
            return content.replace(urlRegex, (url) => {
                const cleanUrl = url.replace('출처:', '').trim();
                return `<a href="${cleanUrl}" target="_blank">${url}</a>`;
            });
        },
        parseJsonString(str) {
            try {
                const fixedStr = str.replace(/'/g, '"').replace(/\\n/g, "\\n");
                const jsonObject = JSON.parse(fixedStr);
                return jsonObject;
            } catch (e) {
                return str; // 또는 적절한 에러 처리
            }
        }
    }
};
</script>

<style lang="scss">
.w-90 {
    width: 90% !important;
}

.edit-btn {
    position: relative;
    left: -5px;
}

pre {
    width: 100%;
    white-space: pre-wrap;
    word-wrap: break-word;
}

.rightpartHeight {
    height: 530px;
}

.badg-dotDetail {
    left: -9px;
    position: relative;
    bottom: -10px;
}

.toggleLeft {
    position: absolute;
    right: 15px;
    top: 15px;
}

.HideLeftPart {
    display: none;
}

@media (max-width: 960px) {
    .right-sidebar {
        position: absolute;
        right: -320px;

        &.showLeftPart {
            right: 0;
            z-index: 2;
            box-shadow: 2px 1px 20px rgba(0, 0, 0, 0.1);
        }
    }

    .boxoverlay {
        position: absolute;
        height: 100%;
        width: 100%;
        z-index: 1;
        background: rgba(0, 0, 0, 0.2);
    }
}

.shadow-none .v-field--no-label {
    --v-field-padding-top: -7px;
}

.my-progress-linear .v-progress-linear__indeterminate {
    background: linear-gradient(to right, #E1F5FE, #80DEEA, #1565C0) !important;
}
</style>
