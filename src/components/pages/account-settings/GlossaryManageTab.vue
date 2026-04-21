<template>
    <div class="glossary-manage-tab pa-6">
        <v-alert type="info" variant="tonal" class="mb-4">
            {{ $t('accountTab.glossaryManageDesc') }}
        </v-alert>

        <div class="d-flex align-center ga-3">
            <v-btn color="primary" prepend-icon="mdi-open-in-new" @click="openGlossary">
                {{ $t('accountTab.openGlossaryManage') }}
            </v-btn>
            <span class="text-body-2 text-medium-emphasis">{{ glossaryUrl }}</span>
        </div>
    </div>
</template>

<script>
export default {
    name: 'GlossaryManageTab',
    props: {
        glossaryUrl: {
            type: String,
            required: true
        }
    },
    methods: {
        openGlossary() {
            window.open(this.glossaryUrl, '_blank', 'noopener,noreferrer');
        }
    }
};
</script>
