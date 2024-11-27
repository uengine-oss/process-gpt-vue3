<template>
    <div>
        <!-- <cron-vuetify v-model="cron" :chip-props="{ color: 'success', textColor: 'white' }" @error="error = $event" /> -->
        <!-- <v-text-field class="mt-4" v-model="copyUengineProperties.expression" :label="$t('TimerEventDefinitionPanel.cron')"></v-text-field> -->
        
        <cron-core v-model="expression" format="quartz" v-slot="{fields, period, error}">
            <div>

                <!-- period selection -->
                {{period.prefix}}
                <v-chip>
                {{period.attrs.modelValue}}
                <v-menu activator="parent">
                    <v-list>
                    <v-list-item v-for="item in period.items"  :key="item.id" @click="period.events['update:model-value'](item.id)">
                        {{item.text}}
                    </v-list-item>
                    </v-list>
                </v-menu>
                <v-icon small @click="period.events['update:model-value']('')">mdi-close</v-icon>
                </v-chip>
                {{period.suffix}}

                <!-- cron expression fields -->
                <template v-for="f in fields" :key="f.id">
                {{f.prefix}}

                    <v-chip>
                    {{f.selectedStr}}
                    <v-menu activator="parent" :close-on-content-click="false">

                        <!-- list of field items -->
                        <v-list :selected="f.attrs.modelValue" @update:selected="f.events['update:model-value']" select-strategy="multiple">
                        <v-list-item v-for="item in f.items" :value="item.value" :key="item.value">
                            {{item.text}}
                        </v-list-item>
                        </v-list>

                    </v-menu>
                    <v-icon small @click="f.events['update:model-value']([])">mdi-close</v-icon>
                    </v-chip>
                {{f.suffix}}
                </template>

                <!-- editable cron expression -->
                <v-text-field
                class="mt-4"
                :modelValue="expression"
                @update:model-value="nextValue = $event"
                @blur="value = nextValue"
                label="cron expression"
                :error-messages="error" />

            </div>
        </cron-core>
        <DetailComponent
            :title="$t('TimerEventDefinitionPanel.cronDescriptionTitle')"
            :details="cronDescription"
        />
    </div>
</template>
<script>
import { CronCore } from '@vue-js-cron/core'
import { useBpmnStore } from '@/stores/bpmn';
import { Icon } from '@iconify/vue';
// import { setPropeties } from '@/components/designer/bpmnModeling/bpmn/panel/CommonPanel.ts';
export default {
    name: 'timer-event-definition-panel',
    components: {
        CronCore
    },
    props: {
        element: Object,
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean
    },
    created() {
        // console.log(this.element.eventDefinitions);
        // if (this.element.eventDefinitions.length > 0) {
        //     this.eventType = this.element.eventDefinitions[0].$type;
        // }
        this.copyUengineProperties = this.uengineProperties;
        // Object.keys(this.requiredKeyLists).forEach((key) => {
        //     this.ensureKeyExists(this.copyUengineProperties, key, this.requiredKeyLists[key]);
        // });
    },
    data() {
        return {
            methodList: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
            copyUengineProperties: null,
            name: '',
            checkpoints: [],
            editCheckpoint: false,
            checkpointMessage: {
                $type: 'uengine:Checkpoint',
                checkpoint: ''
            },
            code: '',
            description: '',
            selectedDefinition: '',
            bpmnModeler: null,
            stroage: null,
            editParam: false,
            paramKey: '',
            paramValue: '',
            eventType: null,
            expression: '* * * * * *',
            error: '',
            cronDescription: [
                {
                    title: 'TimerEventDefinitionPanel.cronDescriptionSubTitle',
                },
            ],
        };
    },
    mounted() {
        if(!this.copyUengineProperties.expression) {
            this.copyUengineProperties.expression = "* * * * * *";
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
        } else {
            this.expression = this.copyUengineProperties.expression.slice(0, -2);
        }
    },
    computed: {
    },
    watch: {
        expression(newVal) {
            this.copyUengineProperties.expression = newVal;
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
        }
    },
    methods: {
    }
};
</script>
