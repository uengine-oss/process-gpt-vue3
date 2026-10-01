<template>
    <div class="mandatory-rule-checklist">
        <div class="d-flex align-center mb-1">
            <v-icon color="primary" size="18" class="mr-1">mdi-clipboard-check-outline</v-icon>
            <span class="text-subtitle-2">{{ $t('validation.mandatoryRules') || '필수 Rule 체크리스트' }}</span>
            <v-spacer />
            <v-chip size="x-small" :color="allChecked ? 'success' : 'grey'" variant="tonal">
                {{ checkedCount }}/{{ entries.length }} {{ $t('validation.ruleConfirmed') || '확인' }}
            </v-chip>
        </div>
        <div class="text-caption text-medium-emphasis mb-2">
            {{ $t('validation.mandatoryRulesHint') || 'Rule을 선택하면 해당 태스크로 이동하고 속성값을 함께 표시합니다.' }}
        </div>
        <v-expansion-panels v-model="expandedPanels" multiple variant="accordion" class="rule-checklist">
            <v-expansion-panel v-for="entry in entries" :key="entry.elementId" :value="entry.elementId">
                <v-expansion-panel-title class="rule-panel-title" @click="$emit('focus', entry.elementId)">
                    <v-checkbox-btn
                        :model-value="!!checked[entry.elementId]"
                        color="success"
                        density="compact"
                        class="flex-grow-0 mr-1"
                        @update:model-value="(v) => setChecked(entry.elementId, v)"
                        @click.stop
                    />
                    <div class="rule-title-text">
                        <div class="text-body-2 font-weight-medium">
                            {{ entry.elementName }}
                            <span v-if="entry.taskCode" class="text-caption text-medium-emphasis ml-1">{{ entry.taskCode }}</span>
                        </div>
                        <div class="text-caption text-medium-emphasis rule-summary">{{ entry.rules[0] }}</div>
                    </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                    <div class="rule-detail">
                        <div class="rule-detail-label">{{ $t('validation.ruleFullText') || '필수 Rule' }}</div>
                        <ul class="rule-detail-rules">
                            <li v-for="(r, i) in entry.rules" :key="i">{{ r }}</li>
                        </ul>
                        <template v-if="entry.props.raci && formatRaciSummary(entry.props.raci)">
                            <div class="rule-detail-label">RACI</div>
                            <div class="text-body-2">{{ formatRaciSummary(entry.props.raci) }}</div>
                        </template>
                        <template v-if="entry.props.input.length">
                            <div class="rule-detail-label">Input</div>
                            <div class="text-body-2">{{ entry.props.input.join(', ') }}</div>
                        </template>
                        <template v-if="entry.props.output.length">
                            <div class="rule-detail-label">Output</div>
                            <div class="text-body-2">{{ entry.props.output.join(', ') }}</div>
                        </template>
                        <template v-if="entry.props.procedure.length">
                            <div class="rule-detail-label">{{ $t('taskIo.procedure') || '업무 수행 절차' }}</div>
                            <ol class="rule-detail-procedure">
                                <li v-for="(p, i) in entry.props.procedure" :key="i">{{ p }}</li>
                            </ol>
                        </template>
                    </div>
                </v-expansion-panel-text>
            </v-expansion-panel>
        </v-expansion-panels>
    </div>
</template>

<script>
/**
 * 필수 Rule 체크리스트 — 검증 다이얼로그와 "Rule 모아보기" 다이얼로그가 공유하는 확인 UI.
 * entries 는 collectMandatoryRuleChecklist() 결과. 체크/펼침 상태는 내부에서 관리하므로
 * 새 검증·새 열림마다 초기화하려면 부모에서 :key 를 바꿔 리마운트한다.
 */
export default {
    name: 'MandatoryRuleChecklist',
    props: {
        entries: { type: Array, default: () => [] }
    },
    emits: ['focus'],
    data() {
        return {
            checked: {},
            expandedPanels: []
        };
    },
    computed: {
        checkedCount() {
            return this.entries.filter((e) => this.checked[e.elementId]).length;
        },
        allChecked() {
            return this.entries.length > 0 && this.checkedCount === this.entries.length;
        }
    },
    methods: {
        setChecked(elementId, value) {
            this.checked = { ...this.checked, [elementId]: !!value };
        },
        /** RACI 객체를 "R: TQM혁신팀 · A: —" 형태의 한 줄 요약으로 */
        formatRaciSummary(raci) {
            if (!raci || typeof raci !== 'object') return '';
            return ['R', 'A', 'S', 'C', 'I']
                .map((k) => {
                    const list = Array.isArray(raci[k]) ? raci[k].filter(Boolean) : [];
                    return list.length ? `${k}: ${list.join(', ')}` : null;
                })
                .filter(Boolean)
                .join(' · ');
        }
    }
};
</script>

<style scoped>
.rule-panel-title {
    min-height: 48px;
}
.rule-title-text {
    min-width: 0;
    flex: 1;
}
.rule-summary {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 440px;
}
.rule-detail-label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: rgba(var(--v-theme-primary), 0.9);
    margin: 10px 0 2px;
}
.rule-detail-label:first-child {
    margin-top: 0;
}
.rule-detail-rules,
.rule-detail-procedure {
    margin: 0;
    padding-left: 18px;
    font-size: 0.875rem;
    line-height: 1.55;
}
.rule-detail-rules li,
.rule-detail-procedure li {
    margin: 2px 0;
}
</style>
