<template>
    <div>
        <!-- 예시 생성 버튼 -->
        <div class="d-flex justify-end mt-4">
            <v-btn @click="generateExamples" color="primary" density="compact" :disabled="isGenerating">
                <span v-if="isGenerating" class="thinking-wave-text">
                    <span v-for="(char, index) in '예시 생성 중...' " :key="index" :style="{ animationDelay: `${index * 0.1}s` }" class="thinking-char">
                        {{ char === ' ' ? '\u00A0' : char }}
                    </span>
                </span>
                <span v-else>예시 생성</span>
            </v-btn>
        </div>

        <!-- 좋은 예시 섹션 -->
        <ExampleTable
            :type="'good'"
            :examples="goodExamples"
            :headers="header"
            @update:examples="updateGoodExamples"
            @add-row="addNewRow('good')"
            @remove-row="removeRow($event, 'good')"
        />

        <!-- 나쁜 예시 섹션 -->
        <ExampleTable
            :type="'bad'"
            :examples="badExamples"
            :headers="header"
            @update:examples="updateBadExamples"
            @add-row="addNewRow('bad')"
            @remove-row="removeRow($event, 'bad')"
        />
    </div>
</template>

<script>
import ChatModule from "@/components/ChatModule.vue";
import ConditionExampleGenenrator from '@/components/ai/ConditionExampleGenenrator';
import BackendFactory from '@/components/api/BackendFactory';
import ExampleTable from './ExampleTable.vue';

export default {
    mixins: [ChatModule],
    components: {
        ExampleTable
    },
    props: {
        value: Object,
        processDefinitionId: String,
        condition: String
    },
    data() {
        return {
            header: [
                { key: 'given', name: 'Given' },
                { key: 'when', name: 'When' },
                { key: 'then', name: 'Then' },
                { key: 'valid_at', name: 'Valid At' },
                { key: 'invalid_at', name: 'Invalid At' }
            ],
            goodExamples: [],
            badExamples: [],
            backend: null,
            genenrator: null,
            processDefinition: null,
            isGenerating: false
        };
    },
    watch: {
        value: {
            handler(newVal) {
                if (newVal.good_examples) {
                    this.goodExamples = newVal.good_examples.map(example => ({
                        ...example,
                        valid_at: example.valid_at ? example.valid_at : null,
                        invalid_at: example.invalid_at ? example.invalid_at : null
                    }));
                }
                if (newVal.bad_examples) {
                    this.badExamples = newVal.bad_examples.map(example => ({
                        ...example,
                        valid_at: example.valid_at ? example.valid_at : null,
                        invalid_at: example.invalid_at ? example.invalid_at : null
                    }));
                }
            },
            deep: true
        }
    },
    async mounted() {
        this.backend = BackendFactory.createBackend();

        if (this.value) {
            const today = new Date().toISOString();
            if (this.value.good_examples) {
                this.goodExamples = this.value.good_examples;
                this.goodExamples.forEach(example => {
                    example.valid_at = example.valid_at ? example.valid_at : today;
                });
            }
            if (this.value.bad_examples) {
                this.badExamples = this.value.bad_examples;
                this.badExamples.forEach(example => {
                    example.invalid_at = example.invalid_at ? example.invalid_at : today;
                });
            }
        } else {
            this.examples = [];
        }

        const process = await this.backend.getRawDefinition(this.processDefinitionId);
        this.processDefinition = process.definition;

        this.genenrator = new ConditionExampleGenenrator(this, {
            isStream: true,
            preferredLanguage: "Korean",
            processDefinition: this.processDefinition,
            condition: this.condition
        });
    },  
    methods: {
        async generateExamples() {
            this.isGenerating = true;
            await this.genenrator.generate();
        },
        afterModelStopped(response) {
            // console.log(response)
        },
        afterModelCreated(response) {
            // console.log(response)
        },
        async afterGenerationFinished(responseObj) {
            this.isGenerating = false;
            if (responseObj) {
                const today = new Date().toISOString();
                this.goodExamples = responseObj.good_examples;
                this.goodExamples.forEach(example => {
                    example.valid_at = example.valid_at ? example.valid_at : today;
                });
                this.badExamples = responseObj.bad_examples;
                this.badExamples.forEach(example => {
                    example.invalid_at = example.invalid_at ? example.invalid_at : today;
                });
                this.$emit('update:value', {
                    good_examples: this.goodExamples,
                    bad_examples: this.badExamples
                });
            }
        },
        updateGoodExamples(examples) {
            this.goodExamples = examples;
            this.$emit('update:value', {
                good_examples: this.goodExamples,
                bad_examples: this.badExamples
            });
        },
        updateBadExamples(examples) {
            this.badExamples = examples;
            this.$emit('update:value', {
                good_examples: this.goodExamples,
                bad_examples: this.badExamples
            });
        },
        addNewRow(type) {
            if (type === 'good') {
                this.goodExamples.push({
                    given: '',
                    when: '',
                    then: '',
                    valid_at: '',
                    invalid_at: ''
                });
            } else {
                this.badExamples.push({
                    given: '',
                    when: '',
                    then: '',
                    valid_at: '',
                    invalid_at: ''
                });
            }
            this.$emit('update:value', {
                good_examples: this.goodExamples,
                bad_examples: this.badExamples
            });
        },
        removeRow(index, type) {
            if (type === 'good') {
                this.goodExamples.splice(index, 1);
            } else {
                this.badExamples.splice(index, 1);
            }
            this.$emit('update:value', {
                good_examples: this.goodExamples,
                bad_examples: this.badExamples
            });
        }
    }
};
</script>
