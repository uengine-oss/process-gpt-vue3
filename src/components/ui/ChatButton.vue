<template>
    <div>
        <Chat 
            :messages="messages"
            :userInfo="userInfo"
            @sendMessage="beforeSendMessage"
            @editSendMessage="editSendMessage"
        >
            <template v-slot:alert>
                <v-alert
                        icon="mdi-info"
                        :title="alertInfo.title"
                        :text="alertInfo.text"
                ></v-alert>
            </template>
        </Chat>
    </div>
</template>

<script>
import Chat from "../ui/Chat.vue";

export default {
    props: {
        messages: Array,
        alertInfo: Object,
        userInfo: Object,
    },
    components: {
        Chat,
    },
    methods: {
        beforeSendMessage(message) {
            this.$emit("beforeSendMessage", message);
        },
        editSendMessage(index) {
            this.$emit("editSendMessage", index);
        }
    }
}
</script>

<style scoped>
.chat-btn {
    position: absolute;
    bottom: 20px;
    right: 20px;
}

.chat-dialog {
    z-index: 999;
    position: absolute;
    bottom: 90px;
    right: 20px;
}
</style>