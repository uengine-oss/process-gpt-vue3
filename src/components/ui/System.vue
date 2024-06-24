<template>
    <div style="margin-left: 3vh; margin-right: 3vh;" v-if="systemInfo">
        <v-card elevation="10" style="height:calc(30vh); width: calc(40vh);">
            <v-card-title>
                {{ systemInfo.name }}
            </v-card-title>
            <v-card-text>
                Description: {{ systemInfo.description }}
                <br>
                URL: {{ systemInfo.url }}
            </v-card-text>
            <v-card-actions>
                <v-btn @click="editSystem">
                    Edit
                </v-btn>
            </v-card-actions>
        </v-card>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    name: 'system-list',
    props: {
        system: {
            type: String,
            required: true
        }
    },
    data: () => ({
        systemInfo: null
    }),
    async created() {
        let me = this
        this.systemInfo = await backend.getSystem(me.system.replace(".json", ""));
    },
    mounted() {},
    computed: {},
    methods: {
        editSystem() {
            this.$emit("editSystem", this.systemInfo);
        }
    }
};
</script>
