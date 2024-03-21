<template>
    <v-card elevation="10" style="background-color: rgba(255, 255, 255, 0)">
        <AppBaseCard>
            <template v-slot:leftpart>
                <div class="no-scrollbar">
                    <Chat :name="projectName" :messages="messages" :chatInfo="chatInfo" :isChanged="true"
                        :userInfo="userInfo" :type="'definitions'" @sendMessage="beforeSendMessage"
                        @sendEditedMessage="sendEditedMessage" @stopMessage="stopMessage" @getMoreChat="getMoreChat"
                        @save="$app.try(saveModel)"></Chat>
                </div>
            </template>
            <template v-slot:rightpart>
                <mashup v-model="src" @change="checkHTML"/>
            </template>

            <template v-slot:mobileLeftContent>
                <Chat :name="projectName" :messages="messages" :chatInfo="chatInfo" :isChanged="isChanged"
                    :userInfo="userInfo" :type="'definitions'" @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage" @stopMessage="stopMessage" @getMoreChat="getMoreChat"
                    @save="saveModel"></Chat>
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>

import ChatDetail from '@/components/apps/chats/ChatDetail.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import Mashup from '@/components/designer/Mashup.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import * as jsondiff from 'jsondiffpatch';
import ChatModule from './ChatModule.vue';
import ChatGenerator from './ai/ProcessDefinitionGenerator';
import Chat from './ui/Chat.vue';
// import BpmnModelingCanvas from '@/components/designer/bpmnModeling/BpmnModelCanvas.vue';
var jsondiffpatch = jsondiff.create({
    objectHash: function (obj, index) {
        return '$$index:' + index;
    },
});
export default {
    mixins: [ChatModule],
    name: 'ProcessDefinitionChat',
    components: {
        Chat,
        AppBaseCard,
        ChatListing,
        ChatDetail,
        ChatProfile,
        Mashup,
        // BpmnModelingCanvas,
        ChatGenerator
    },
    data: () => ({
        uiCode: null,
        changedXML: "",
        projectName: '',
        path: 'ui',
        isChanged: false,
        chatInfo: {
            title: 'processDefinition.cardTitle',
            text: "processDefinition.processDefinitionExplanation"
        },
        processDefinitionMap: null,
        modeler: null,
        src:null,
    }),
    async created() {
        await this.init();
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
        this.src = localStorage["keditor.editing.content"]
    },
    beforeDestroy() {
        this.src = null;
    },
    mounted() {
        // if (this.$route.query && this.$route.query.id) {
        //     this.processDefinition = {
        //         processDefinitionId: this.$route.query.id
        //     }
        //     if (this.$route.query.name) {
        //         this.projectName = this.$route.query.name;
        //         this.processDefinition.processDefinitionName = this.projectName;
        //     }
        // }
    },
    watch: {
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (newVal.path !== oldVal.path) {
                    if (newVal.params.id && newVal.params.id != 'chat') {
                        this.loadData();
                    }
                }
            }
        },
       
    },
    computed: {
        
    },
    methods: {
        checkHTML(html) {
            localStorage["keditor.editing.content"] = html;
        },
  
    }
};
</script>

<style scoped></style>
