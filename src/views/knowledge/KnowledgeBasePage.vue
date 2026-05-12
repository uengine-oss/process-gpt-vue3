<template>
    <v-row class="justify-center ma-0 pa-0">
        <v-col cols="12" md="12" class="pa-3">
            <KnowledgeFilesTab />
        </v-col>
    </v-row>
</template>

<script>
import KnowledgeFilesTab from '@/components/pages/account-settings/KnowledgeFilesTab.vue';

export default {
    name: 'KnowledgeBasePage',
    components: { KnowledgeFilesTab }
};
</script>
