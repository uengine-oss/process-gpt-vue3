<template>
    <v-dialog :model-value="modelValue" max-width="520" persistent @update:model-value="onDialogModel">
        <v-card>
            <v-card-title class="d-flex align-center">
                <v-icon start size="20" color="success">mdi-ray-start-arrow</v-icon>
                시작 이벤트 선택
            </v-card-title>
            <v-card-subtitle class="text-wrap">
                이 프로세스에는 시작 이벤트가 {{ startEvents.length }}개 있습니다. 어떤 이벤트로 인스턴스를 시작할지 선택하세요.
            </v-card-subtitle>
            <v-card-text class="pt-2">
                <v-radio-group v-model="selectedId" hide-details density="comfortable">
                    <v-radio v-for="ev in displayEvents" :key="ev.id" :value="ev.id">
                        <template #label>
                            <div class="start-event-option">
                                <span class="font-weight-medium">{{ ev.displayName }}</span>
                                <code class="start-event-option__id">{{ ev.id }}</code>
                            </div>
                        </template>
                    </v-radio>
                </v-radio-group>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="cancel">취소</v-btn>
                <v-btn color="success" variant="flat" :disabled="!selectedId" @click="confirm">
                    <v-icon start size="16">mdi-play</v-icon>
                    이 이벤트로 시작
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
/**
 * 다중 시작 정의 실행 시 시작 이벤트 선택 다이얼로그 (specs/010 contracts/ui-start-selection.md)
 * - startEvents: 실행 정의(definition.events)의 startEvent 목록
 * - definition: 무명 이벤트 표시명 폴백("{직후 요소 이름} 경유 시작") 생성용 정의 전체
 */
export default {
    name: 'StartEventSelectDialog',
    props: {
        modelValue: { type: Boolean, default: false },
        startEvents: { type: Array, default: () => [] },
        definition: { type: Object, default: null }
    },
    emits: ['update:modelValue', 'select', 'cancel'],
    data() {
        return { selectedId: '' };
    },
    computed: {
        displayEvents() {
            return this.startEvents.map((ev) => ({ id: ev.id, displayName: this.resolveDisplayName(ev) }));
        }
    },
    watch: {
        modelValue(open) {
            if (open) {
                this.selectedId = this.startEvents.length > 0 ? this.startEvents[0].id : '';
            }
        }
    },
    methods: {
        resolveDisplayName(ev) {
            const name = (ev?.name || '').trim();
            if (name) return name;
            // 무명 시작 이벤트: 직후 요소 이름으로 폴백 표시명 생성
            const def = this.definition;
            const seq = (def?.sequences || []).find((s) => s?.source === ev?.id);
            if (seq) {
                const pools = [...(def?.activities || []), ...(def?.gateways || []), ...(def?.events || [])];
                const target = pools.find((n) => n?.id === seq.target);
                if (target?.name) return `${target.name} 경유 시작`;
            }
            return `${ev.id} 시작`;
        },
        onDialogModel(v) {
            if (!v) this.cancel();
        },
        confirm() {
            if (!this.selectedId) return;
            this.$emit('select', this.selectedId);
            this.$emit('update:modelValue', false);
        },
        cancel() {
            this.$emit('cancel');
            this.$emit('update:modelValue', false);
        }
    }
};
</script>

<style scoped>
.start-event-option {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 2px 0;
}
.start-event-option__id {
    font-size: 11px;
    opacity: 0.6;
}
</style>
