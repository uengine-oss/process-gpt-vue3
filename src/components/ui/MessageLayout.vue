<template>
    <div>
        <slot name="contents">
            <div v-for="(message, index) in filterMessages" :key="index">
                <slot name="messageProfile">
                    <v-row class="ma-0 pa-0" style="margin-bottom:10px !important;">
                        <v-avatar class="pr-2" size="40">
                            <img v-if="!message.profile" src="@/assets/images/chat/chat-icon.png" alt="pro" width="50">
                            <img v-else :src="message.profile" alt="pro" width="50">
                        </v-avatar>
                        <div v-if="message.timeStamp" style="font-size:12px; padding-top:20px;">
                            {{ message.roleName }} 
                            {{ formatTime(message.timeStamp) }}
                        </div>     
                    </v-row>
                </slot>
                <slot name="messageContent">
                    <div class="w-100 pb-5">
                        <v-sheet class="bg-lightsecondary rounded-md px-3 py-2" style="width: 50vw;">
                            <div v-html="message.content" @click="clickContent(message)"></div>
                            <v-btn class="mt-2" elevation="0" @click="openDescription(index)">View Detail</v-btn>
                            
                            <div style="margin-top: 20px;">
                                <div v-if="toolFormat(message).includes('formHandler')">
                                    <DynamicForm class="message-layout-dyna" v-if="message.open" :formHTML="message.html" v-model="message.formData"></DynamicForm>
                                </div>
                                <div v-else-if="toolFormat(message) == 'DefaultHandler'">
                                    <DefaultForm :inputItems="message.formData"></DefaultForm>
                                </div>
                                <div v-else>
                                    <div v-html="message.description"></div>
                                </div>
                            </div>
                        </v-sheet>
                    </div>
                </slot>
            </div>
        </slot>
        <slot name="input"></slot>
    </div>
</template>

<script>
import DynamicForm from '@/components/designer/DynamicForm.vue';
import BackendFactory from '@/components/api/BackendFactory';

const backend = BackendFactory.createBackend()
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
    components: {
        DynamicForm
    },
    created(){
        this.init()
    },
    methods: {
         init(){
            this.filterMessages = this.messages.map(message => {
                // default Value
                message.open = false
                message.html = null
                message.formData = null
                
                return message
            })
        },
        toolFormat(message){
            if(!message._item) return null;

            if(message._item.tool.includes('formHandler')){
                return 'formHandler'
            }
            return message._item.tool 
        },
        async openDescription(index){
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    if(me.filterMessages[index].open) { me.filterMessages[index].open = false; return; } // only close
                    if(me.filterMessages[index].html && me.filterMessages[index].formData) { me.filterMessages[index].open = true; return; } // only open

                    const workHistory = me.filterMessages[index]._item 
                    if(workHistory.tool.includes('formHandler')){
                        // FormHandler
                        const workItem = await backend.getWorkItem(workHistory.taskId);
                        let varName = workItem.activity.variableForHtmlFormContext.name 
                        
                        // get form html
                        let formName = workHistory.tool.split(':')[1];
                        me.filterMessages[index].html = await backend.getRawDefinition(formName, {'type': 'form'});   

                        // get variable
                        let variable = await backend.getVariable(workHistory.instId, varName) 
                        me.filterMessages[index].formData = variable ? variable.valueMap : {}
                    } else {
                        // DefaultHandler
                    }
                   

                    me.filterMessages[index].open = true
                }
            })
           
        },
        clickContent(message){
            this.$emit('clickMessage', message)
        },
        formatTime(timeStamp) {
            var date = new Date(timeStamp);
            var dateString = date.toString();
            var timeString = dateString.split(' ')[4].substring(0, 5);
            return timeString;
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
