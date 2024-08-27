<template>
    <div>
        <v-row class="ma-0 pa-0">
            <v-col v-for="system in systemList" :key="system.name" 
                cols="12" sm="6" md="4" lg="3"
            >
                <template v-if="systemList">
                    <System :system="system.name" v-on:edit-system="$evt => editSystem($evt)" />
                </template>
            </v-col>
            <v-col cols="12" sm="6" md="4" lg="3">
                <v-card elevation="10" 
                    @click="openDialog = !openDialog"
                    style="height:300px;
                    display: flex; justify-content: center; align-items: center;"
                >
                    <Icons :icon="'plus'"/>
                </v-card>
            </v-col>
        </v-row>
        <v-dialog v-model="openDialog" width="auto">
            <v-card style="width: 70vh; height: 80vh">
                <v-card-title> Add System </v-card-title>
                <v-card-item>
                    <v-text-field v-model="addSystem.name" style="margin-top: 10px" label="Name" />
                    <v-text-field v-model="addSystem.description" label="Description" />
                    <v-text-field v-model="addSystem.url" label="API URL" />
                    Open API Spec
                    <vue-monaco-editor
                        style="width: 100%; height: 100%; min-height: 300px"
                        v-model:value="addSystem.spec"
                        theme="vs-dark"
                        language="json"
                        :options="MONACO_EDITOR_OPTIONS"
                    />
                </v-card-item>
                <v-card-actions>
                    <v-btn @click="putSystem"> Add </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <!-- </v-card> -->
    </div>
</template>

<script>
import System from '@/components/ui/System.vue';
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    name: 'system-list',
    components: {
        System
    },
    data: () => ({
        MONACO_EDITOR_OPTIONS: {
            automaticLayout: true,
            formatOnType: true,
            formatOnPaste: true
        },
        addSystem: {},
        openDialog: false,
        systemList: null
    }),
    async created() {
        await this.loadSystems();
    },
    mounted() {},
    computed: {},
    watch: {
        openDialog(newVal) {
            if (!newVal) {
                setTimeout(() => {
                    this.addSystem = {};
                }, 500);
            }
        }
    },
    methods: {
        async loadSystems() {
            let result = await backend.getSystemList();
            console.log(result);
            this.systemList = result;
        },
        async putSystem() {
            await backend.putSystem(this.addSystem);

            this.loadSystems();

            this.openDialog = false;
        },
        editSystem(system) {
            this.addSystem = JSON.parse(JSON.stringify(system));
            this.openDialog = true;
        }
    }
};
</script>
