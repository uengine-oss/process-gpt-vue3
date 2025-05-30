<template>
    <v-card>
        <v-card-title class="d-flex justify-space-between">
            <div class="d-flex align-center">{{ $t('ProcessDefinitionMarketPlaceDialog.title') }}</div>
            <v-btn @click="close" icon variant="text" density="comfortable">
                <Icons :icon="'close'" :size="16" />
            </v-btn>
        </v-card-title>
        <v-card-text>
            <v-text-field v-model="newDefinition.id" :label="$t('ProcessDefinitionMarketPlaceDialog.processId')"
                disabled
            />
            <v-text-field v-model="newDefinition.name" :label="$t('ProcessDefinitionMarketPlaceDialog.processName')" 
                disabled
            />
            <v-textarea v-model="newDefinition.description" :label="$t('ProcessDefinitionMarketPlaceDialog.description')" rows="3" />
            <div class="d-flex justify-space-between">
                <v-text-field v-model="megaCategory" :label="$t('ProcessDefinitionMarketPlaceDialog.category1') + ' *'" class="mr-1" />
                <v-text-field v-model="majorCategory" :label="$t('ProcessDefinitionMarketPlaceDialog.category2') + ' *'" class="ml-1" />
            </div>
            <v-combobox
                v-model="tagsArray"
                :label="$t('ProcessDefinitionMarketPlaceDialog.tags') + ' *'"
                multiple
                chips
                clearable
                closable-chips
                variant="outlined"
                :items="availableTags"
            />
        </v-card-text>
        <v-card-actions class="d-flex justify-end">
            <v-btn @click="addDefinition" color="primary" rounded variant="flat" :disabled="!isFormValid">
                {{ $t('ProcessDefinitionMarketPlaceDialog.register') }}
            </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    props: {
        processDefinition: Object,
        bpmn: String,
    },
    data: () => ({
        newDefinition: {
            id: '',
            name: '',
            description: '',
            category: '',
            tags: '',
            author_name: '',
            author_email: '',
        },
        // category
        megaCategory: '',
        majorCategory: '',
        // tags
        tagsArray: [],
        availableTags: [],
    }),
    computed: {
        isFormValid() {
            return this.megaCategory && this.majorCategory && this.tagsArray.length > 0;
        }
    },
    mounted() {
        if (this.bpmn && this.processDefinition && this.processDefinition.processDefinitionId) {
            this.newDefinition = {
                id: this.processDefinition.processDefinitionId,
                name: this.processDefinition.processDefinitionName,
                definition: this.processDefinition,
                bpmn: this.bpmn,
                description: '',
                category: '',
                tags: '',
                author_name: '',
                author_email: '',
            };
            this.megaCategory = '';
            this.majorCategory = '';
        }
    },
    watch: {
        'tagsArray': {
            deep: true,
            handler(newVal) {
                this.newDefinition.tags = newVal ? newVal.join(',') : '';
            }
        },
        'megaCategory': {
            handler() {
                this.newDefinition.category = `${this.megaCategory}/${this.majorCategory}`;
            }
        },
        'majorCategory': {
            handler() {
                this.newDefinition.category = `${this.megaCategory}/${this.majorCategory}`;
            }
        }
    },
    methods: {
        async addDefinition() {
            await backend.putTemplateDefinition(this.newDefinition);
            this.close();
        },
        close() {
            this.$emit('toggleMarketplaceDialog', false);
        }
    }
};
</script>

<style scoped>
</style>
