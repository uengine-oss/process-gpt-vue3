<template>
    <div>
        <!-- 예시 생성 버튼 -->
        <div class="d-flex justify-end mt-4">
            <v-btn @click="generateExamples" color="primary" density="compact" rounded variant="flat" :disabled="isGenerating">
                <span v-if="isGenerating" class="thinking-wave-text">
                    <span
                        v-for="(char, index) in $t('ConditionExampleField.generatingExamples')"
                        :key="index"
                        :style="{ animationDelay: `${index * 0.1}s` }"
                        class="thinking-char"
                    >
                        {{ char === ' ' ? '\u00A0' : char }}
                    </span>
                </span>
                <span v-else>{{ $t('ConditionExampleField.generateExamples') }}</span>
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
import ChatModule from '@/components/ChatModule.vue';
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
        element: Object,
        processDefinitionId: String,
        condition: String
    },
    data() {
        return {
            header: [
                { key: 'when', name: this.$t('ConditionExampleField.when') },
                { key: 'then', name: this.$t('ConditionExampleField.then') }
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
        element: {
            async handler() {
                await this.getExamples();
            },
            deep: true
        }
    },
    async mounted() {
        this.backend = BackendFactory.createBackend();

        this.genenrator = new ConditionExampleGenenrator(this, {
            isStream: true,
            preferredLanguage: 'Korean',
            processDefinition: this.processDefinition,
            condition: this.condition
        });

        await this.getExamples();
    },
    methods: {
        async getExamples() {
            let process = null;
            try {
                process = await this.backend.getRawDefinition(this.processDefinitionId);
            } catch (e) {
                console.error('[ConditionExampleField] getRawDefinition 실패:', e);
            }
            this.processDefinition = (process && process.definition) || null;
            const sequences =
                this.processDefinition && Array.isArray(this.processDefinition.sequences) ? this.processDefinition.sequences : [];
            if (sequences.length && this.element && this.element.id) {
                // 디자이너는 시퀀스플로우 element id 를 'SequenceFlow_<src>_<tgt>' 로 재생성하므로
                // proc_def 의 sequence.id('seq_...' 등)와 일치하지 않을 수 있다.
                // → id 직접 매칭에 더해 source/target 으로도 매칭한다 ('id_' 접두사는 정규화).
                const norm = (v) => String(v || '').replace(/^id_/, '');
                const refId = (r) => (r && typeof r === 'object' ? r.id : r) || '';
                const el = this.element;
                const elSrc = norm(refId(el.source) || refId(el.sourceRef) || refId(el.businessObject && el.businessObject.sourceRef));
                const elTgt = norm(refId(el.target) || refId(el.targetRef) || refId(el.businessObject && el.businessObject.targetRef));
                const sequence = sequences.find(
                    (s) => s && (s.id === this.element.id || (elSrc && elTgt && norm(s.source) === elSrc && norm(s.target) === elTgt))
                );
                if (sequence) {
                    let properties = sequence.properties;
                    if (typeof properties === 'string') {
                        try {
                            properties = JSON.parse(properties || '{}');
                        } catch (e) {
                            properties = {};
                        }
                    }
                    if (!properties || typeof properties !== 'object') {
                        properties = {};
                    }
                    const today = new Date().toISOString();
                    if (properties.examples) {
                        this.goodExamples = properties.examples.good_examples || [];
                        this.goodExamples.forEach((example) => {
                            example.valid_at = example.valid_at ? example.valid_at : today;
                        });
                        this.badExamples = properties.examples.bad_examples || [];
                        this.badExamples.forEach((example) => {
                            example.invalid_at = example.invalid_at ? example.invalid_at : today;
                        });
                        return;
                    }
                }
            }
            this.goodExamples = [];
            this.badExamples = [];
        },
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
                this.goodExamples.forEach((example) => {
                    example.valid_at = example.valid_at ? example.valid_at : today;
                });
                this.badExamples = responseObj.bad_examples;
                this.badExamples.forEach((example) => {
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
