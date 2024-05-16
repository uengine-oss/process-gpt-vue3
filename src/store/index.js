import { createStore } from 'vuex';

export default createStore({
    state: {
        messages: null
    },
    mutations: {
        setMessages(state, messages) {
            state.messages = messages;
        },
        clearMessages(state) {
            state.messages = null;  // or state.messages = [] if you prefer to reset to an empty array
        }
    },
    actions: {
        updateMessages({ commit }, messages) {
            commit('setMessages', messages);
        }
    }
});