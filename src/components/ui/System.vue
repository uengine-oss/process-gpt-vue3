<template>
    <div v-if="systemInfo">
        <v-card elevation="10"
            style="height:200px;"
        >
            <v-card-title>
                {{ systemInfo.name }}
            </v-card-title>
            <v-card-text class="pa-0 pl-4">
                {{ $t('System.description') }}: {{ systemInfo.description }}
                <br>
                URL: {{ systemInfo.url }}
            </v-card-text>
            <v-btn @click="editSystem"
                color="primary"
                rounded
                style="position: absolute;
                bottom:10px; right:10px;"
            >
            {{ $t('System.edit') }}
            </v-btn>
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
