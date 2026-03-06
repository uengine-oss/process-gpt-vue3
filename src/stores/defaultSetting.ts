import { defineStore } from 'pinia';

function t(key: string): string {
    const i18n = (window as any).$i18n;
    return i18n?.global?.t(key) || key;
}

export const useDefaultSetting = defineStore({
    id: 'defaultSetting',
    state: () => ({
        agentList: [
            {
                id: '973c62b9-4a53-f793-b91e-6c151edbb0f0',
                usernameKey: 'defaultSetting.defaultLLM.username',
                username: '',
                profile: '/images/chat-icon.png',
                email: null,
                role: '',
                goal: '',
                persona: '',
                descriptionKey: 'defaultSetting.defaultLLM.description',
                description: '',
                tools: '',
                skills: null,
                is_agent: true,
                model: null,
                endpoint: '',
                agent_type: 'pgagent',
                alias: 'default',
                is_default: true,
                is_hidden: true
            },
            {
                id: '8e9df0ec-142b-3ba3-518b-b49395592187',
                usernameKey: 'defaultSetting.openaiDeepResearch.username',
                username: '',
                profile: '/images/chat-icon.png',
                email: null,
                role: '',
                goal: '',
                persona: '',
                descriptionKey: 'defaultSetting.openaiDeepResearch.description',
                description: '',
                tools: '',
                skills: null,
                is_agent: true,
                model: null,
                endpoint: '',
                agent_type: 'pgagent',
                alias: 'openai-deep-research',
                is_default: true
            },
            {
                id: '79014ea6-ba74-5a8c-9293-cacd516c83e0',
                usernameKey: 'defaultSetting.browserAutomation.username',
                username: '',
                profile: '/images/chat-icon.png',
                email: null,
                role: '',
                goal: '',
                persona: '',
                descriptionKey: 'defaultSetting.browserAutomation.description',
                description: '',
                tools: '',
                skills: null,
                is_agent: true,
                model: null,
                endpoint: '',
                agent_type: 'pgagent',
                alias: 'browser-automation-agent',
                is_default: true
            },
            {
                id: '97e74b9e-44c9-0451-762e-38c8055017c3',
                usernameKey: 'defaultSetting.visionparse.username',
                username: '',
                profile: '/images/chat-icon.png',
                email: null,
                role: '',
                goal: '',
                persona: '',
                descriptionKey: 'defaultSetting.visionparse.description',
                description: '',
                tools: '',
                skills: null,
                is_agent: true,
                model: null,
                endpoint: '',
                agent_type: 'pgagent',
                alias: 'visionparse',
                is_default: true
            }
        ]
    }),
    actions: {
        setAgentList(agentList: any) {
            this.agentList = agentList;
        }
    },
    getters: {
        getAgentList: (state) => {
            return state.agentList.map((agent) => ({
                ...agent,
                username: agent.usernameKey ? t(agent.usernameKey) : agent.username,
                description: agent.descriptionKey ? t(agent.descriptionKey) : agent.description
            }));
        },
        getAgentById: (state) => (agentId: string) => {
            const agent = state.agentList.find((agent) => agent.id === agentId);
            if (!agent) return null;
            return {
                ...agent,
                username: agent.usernameKey ? t(agent.usernameKey) : agent.username,
                description: agent.descriptionKey ? t(agent.descriptionKey) : agent.description
            };
        }
    }
});
