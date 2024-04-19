<template>
    <div>
        <slot name="contents">
            <div v-for="(message, index) in filterMessages" :key="index" class="d-flex">
                <slot name="messageProfile">
                    <v-avatar class="pr-2" size="40">
                        <img v-if="!message.profile" src="@/assets/images/chat/chat-icon.png" alt="pro" width="50">
                        <img v-else :src="message.profile" alt="pro" width="50">
                    </v-avatar>
                </slot>
                <slot name="messageContent">
                    <v-sheet class="bg-lightsecondary rounded-md px-3 py-2">
                        <div v-html="message.content"></div>
                        <v-btn v-if="message.description" class="mt-2" elevation="0" @click="openDescription(index)">View Detail</v-btn>
                        <pre v-if="message.open" class="text-body-1">{{ message.description }}</pre>
                    </v-sheet>
                </slot>
            </div>
        </slot>
        <slot name="input"></slot>
    </div>
</template>

<script>

export default {
    props: {
        messages: Array,
        lock: Boolean,
    },
    data() {
        return {
            filterMessages: [],
            
        };
    },
    watch:{
        "messages":function(){
            this.convertMessages()
        },
    },
    methods: {
        convertMessages(){
            this.filterMessages = this.messages.map(message => {
                message.open = message.open ? true : false
                return message
            })
        },
        openDescription(index){
            this.filterMessages[index].open = this.filterMessages[index].open ? false : true
        }
    }
};
</script>

<style lang="scss">
.message-input-box .v-field__input {
    font-size: 16px;
    padding-left: 12px;
}

.message-input-box .v-field {
    padding: 0px;
}

.message-input-box .v-field__append-inner,
.v-field__prepend-inner {
    padding: 0px !important;
}

.prompt-edit-textarea textarea {
    padding: 5px !important;
}

.chat-reply-icon {
    position: absolute;
    bottom: -5px;
    right: 0px;
    z-index: 1;
    background-color: white;
}

.w-90 {
    width: 90% !important;
}

pre {
    width: 100%;
    white-space: pre-wrap;
    word-wrap: break-word;
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

.user-list {
    border: 1px solid #ddd;
    max-height: 300px;
    overflow-y: auto;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
</style>
