<template>
    <v-card elevation="10" style="background-color: rgba(255, 255, 255, 0)">
        <AppBaseCard>
            <template v-slot:leftpart>
                <v-btn @click="listDefinition">listDefinition</v-btn>
                <v-btn @click="start">start</v-btn>
            </template>
            <template v-slot:rightpart>
                <div class="no-scrollbar">

                </div>
            </template>

            <template v-slot:mobileLeftContent>
                <Chat :name="projectName" :messages="messages" :chatInfo="chatInfo" :isChanged="isChanged"
                    :userInfo="userInfo" :type="'definitions'" :lock="lock" :disableChat="disableChat"
                    @sendMessage="beforeSendMessage" @sendEditedMessage="sendEditedMessage" @stopMessage="stopMessage"
                    @getMoreChat="getMoreChat" @loadBPMN="bpmn => loadBPMN(bpmn)"
                    @openVerMangerDialog="toggleVerMangerDialog" @toggleLock="toggleLock"></Chat>
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
export default {
    name: 'TestPage',
    components: {
        AppBaseCard
    },
    data: () => ({
        uengine: null
    }),
    async created() {
        this.uengine = BackendFactory.createBackend('uengine');
    },
    mounted() {

    },
    watch: {

    },
    computed: {

    },
    methods: {
        listDefinition() {
            this.uengine.listDefinition();
        },
        start() {
            // private String processDefinitionId;
            // private String instanceName;
            // private boolean isSimulation;
            // private RoleMapping[] roleMappings;
            // private ProcessVariableValue[] processVariableValues;

            let command = {
                "processDefinitionId": "sales/simpleProcess.xml",
                "roleMappings": [
                    {
                        "name": "initiator",
                        "endpoints": ["initiator@uengine.org"],
                        "resourceNames": ["Initiator"]
                    }
                ]
            }

            this.uengine.start(command);
        },
        putRawDefinition(){
            this.uengine.putRawDefinition();
        }
    }
};
</script>

<style scoped>
.process-definition-resize {
    width: 100%;
    height: 100%;
}

@media only screen and (max-width:1279px) {
    .process-definition-resize {
        width: 100%;
        height: calc(100vh - 192px);
    }
}

:deep(.left-part) {
    width: 80%;
    /* Apply specific width */
}
</style>
