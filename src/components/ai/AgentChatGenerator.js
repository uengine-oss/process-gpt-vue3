import AIGenerator from "./AIGenerator";

export default class AgentChatGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);
        this.model = "gpt-4o"
        this.chatRoomId = this.client.currentChatRoom.id;
        this.options = {};
    }

    beforeGenerate(message) {
        this.message = message.text;
        if (this.client.agentInfo && this.client.agentInfo.url && this.client.agentInfo.url !== '') {
            this.type = 'a2a';
            this.options = {
                agent_url: this.client.agentInfo.url,
                stream: true
            }
        } else {
            this.type = 'mem0';
            this.options = {
                agent_id: this.client.agentInfo.id
            }
        }
    }

    async generate() {
        this.state = 'running';
        try {
            const data = {
                text: this.message,
                type: this.type,
                chat_room_id: this.chatRoomId,
                options: this.options
            }
            const response = await fetch('/execution/multi-agent/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                if (this.type === 'a2a') {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    let content = '';
    
                    while (true) {
                        const { value, done } = await reader.read();
                        
                        if (done) {
                            break;
                        }
    
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';
    
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = line.slice(6); // 'data: ' 제거
                                
                                if (data === '[DONE]') {
                                    break;
                                }

                                try {
                                    const parsed = JSON.parse(data);
                                    if (parsed.error) {
                                        console.error('Stream error:', parsed.error);
                                        if (this.client.onError) {
                                            this.client.onError(parsed.error);
                                        }
                                    } else {
                                        const model = this.createModelJson(this.type, parsed.response);
                                        if (this.client.afterModelCreated) {
                                            this.client.afterModelCreated(model);
                                            content += model.content;
                                        }
                                    }
                                } catch (e) {
                                    console.error('Error parsing JSON:', e);
                                }
                            }
                        }
                    }
    
                    const model = this.createModel({
                        work: 'A2AResponse',
                        content: content
                    });
    
                    this.state = 'end';
                    if (this.client.onGenerationFinished) {
                        this.client.onGenerationFinished(model);
                    }
                } else {
                    const data = await response.json();
                    const result = data.response;
                    let responseObj = this.createModelJson(this.type, result);
                    this.modelJson = JSON.stringify(responseObj);
                    const model = this.createModel(this.modelJson);
                    
                    this.state = 'end';
                    if (this.client.onModelCreated) {
                        this.client.onModelCreated(model);
                    }
                    if (this.client.onGenerationFinished) {
                        this.client.onGenerationFinished(model);
                    }
                }
            } else {
                throw new Error('Failed to fetch data');
            }
        } catch (error) {
            console.error('Error in generate:', error);
            this.state = 'error';
            if (this.client.onError) {
                this.client.onError(error);
            }
            throw error;
        }
    }
    
    createModel(data) {
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error('Error parsing model JSON:', e);
                return data;
            }
        }
        return data;
    }

    createModelJson(agentType, result) {
        let modelJson = {};

        if (agentType === 'a2a') {
            if (result.status && result.status.state && result.status.state === 'working') {
                if (result.status.message && result.status.message.role && result.status.message.role === 'agent') {
                    let content = result.status.message.parts[0].text;
                    if (!content.includes('Using tool:')) {
                        content = content.replaceAll('undefined', '')
                        modelJson = {
                            work: 'A2AResponse',
                            content: content
                        }
                    }
                }
            }
        } else if (agentType === 'mem0') {
            if (result.type === 'query') {
                modelJson = {
                    work: 'Mem0AgentQuery',
                    content: result.content,
                    htmlContent: result.html_content,
                    searchResults: result.search_results
                }
            } else if (result.type === 'information') {
                modelJson = {
                    work: 'Mem0AgentInformation',
                    content: result.content
                }
            } else {
                modelJson = {
                    work: 'Mem0AgentResponse',
                    content: result.content
                }
            }
        }
        return modelJson;
    }

    setContexts(contexts) {}

    setChatRoomData(chatRoom) {}

    setCalendarData(calendar) {}

    setWorkList() {}

    createPrompt() {}
}