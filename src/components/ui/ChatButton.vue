<template>
    <div>

        <Chat :messages="messages"
                @sendMessage="beforeSendMessage"
                @editSendMessage="editSendMessage"
        >
        </Chat>

    </div>
</template>

<script>
import Chat from "../ui/Chat.vue";

export default {
    props: {
        messages: Array,
        alertInfo: Object,
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