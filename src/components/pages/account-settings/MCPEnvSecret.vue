<template>
    <v-row class="justify-center">
        <v-col cols="12">
            <v-card flat class="mb-6">
                <v-card-item>
                    <h5 class="text-h5 mb-4">MCP Environments</h5>
                    <v-data-table
                        :headers="envHeaders"
                        :items="envItems"
                        class="elevation-1"
                        :loading="loading"
                        loading-text="Loading Enviroments..."
                    >
                        <template v-slot:item.actions="{ item }">
                            <v-icon size="small" class="me-2" @click="editEnv(item)"> mdi-pencil </v-icon>
                            <v-icon size="small" @click="deleteEnv(item)"> mdi-delete </v-icon>
                        </template>
                    </v-data-table>
                </v-card-item>
            </v-card>

            <v-card flat>
                <v-card-item>
                    <h5 class="text-h5 mb-4">MCP Secrets</h5>
                    <v-data-table
                        :headers="secretHeaders"
                        :items="secretItems"
                        class="elevation-1"
                        :loading="loading"
                        loading-text="Loading Secrets..."
                    >
                        <template v-slot:item.actions="{ item }">
                            <v-icon size="small" class="me-2" @click="editSecret(item)"> mdi-pencil </v-icon>
                            <v-icon size="small" @click="deleteSecret(item)"> mdi-delete </v-icon>
                        </template>
                    </v-data-table>
                </v-card-item>
            </v-card>
        </v-col>
    </v-row>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';

export default {
    data: () => ({}),
    async mounted() {},
    methods: {}
};
</script>

<style scoped>
.v-list-item {
    transition: background-color 0.2s ease;
}

.v-list-item:hover {
    background-color: rgba(var(--v-theme-primary), 0.1);
}

/* 모바일 다이얼로그 스타일 */
.dialog-bottom-transition-enter-active,
.dialog-bottom-transition-leave-active {
    transition: transform 0.3s ease-in-out;
}

.dialog-bottom-transition-enter-from,
.dialog-bottom-transition-leave-to {
    transform: translateY(100%);
}
</style>
