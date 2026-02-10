<template>
    <v-card class="pa-0" flat>
        <v-row class="ma-0 pa-4">
            <v-card-title class="text-h6 pa-0">{{ $t('agentField.resourcePriority') }}</v-card-title>
            <v-spacer></v-spacer>
            <v-btn
                @click="close"
                class="ml-auto"
                variant="text"
                density="compact"
                icon
            >
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-row>

        <v-card-text class="ma-0 pa-4 pb-0 pt-1 organization-edit-dialog-contents">
            <div class="text-caption text-disabled mb-3">{{ $t('agentField.resourcePriorityHint') }}</div>
            <div v-if="toolPriorityOrder.length === 0" class="text-caption text-medium-emphasis">
                도구/스킬을 먼저 설정해주세요.
            </div>
            <v-list v-else class="pa-0" density="compact">
                <v-list-item
                    v-for="(item, index) in toolPriorityOrder"
                    :key="item"
                    class="tool-priority-list-item px-0"
                    rounded
                >
                    <template v-slot:prepend>
                        <span class="text-body-2 text-medium-emphasis mr-2" style="min-width: 20px;">{{ index + 1 }}</span>
                    </template>
                    <div class="d-flex flex-column py-1 flex-grow-1 min-width-0">
                        <span class="text-body-2">{{ getLineLabel(item) }}</span>
                        <span class="text-caption text-disabled mt-0">{{ getDisplayDescription(item) }}</span>
                    </div>
                    <template v-slot:append>
                        <v-btn
                            icon
                            variant="text"
                            size="x-small"
                            density="compact"
                            :disabled="index === 0"
                            @click="moveUp(index)"
                        >
                            <v-icon size="small">mdi-chevron-up</v-icon>
                            <v-tooltip activator="parent" location="top">{{ $t('agentField.moveUp') }}</v-tooltip>
                        </v-btn>
                        <v-btn
                            icon
                            variant="text"
                            size="x-small"
                            density="compact"
                            :disabled="index === toolPriorityOrder.length - 1"
                            @click="moveDown(index)"
                        >
                            <v-icon size="small">mdi-chevron-down</v-icon>
                            <v-tooltip activator="parent" location="top">{{ $t('agentField.moveDown') }}</v-tooltip>
                        </v-btn>
                    </template>
                </v-list-item>
            </v-list>
        </v-card-text>

        <v-card-actions class="ma-0 pa-4 pt-2">
            <v-spacer></v-spacer>
            <v-btn
                @click="save"
                color="primary"
                variant="flat"
                rounded
            >{{ $t('organizationChartDefinition.save') }}</v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
const TOOL_PRIORITY_CATEGORIES = ['skill', 'dmn_rule', 'mem0', '*'];

export default {
    name: 'AgentToolPriority',
    props: {
        modelValue: {
            type: Boolean,
            default: false
        },
        agentInfo: {
            type: Object,
            required: true,
            default: () => ({})
        }
    },
    emits: ['update:modelValue', 'agentUpdated', 'close'],
    data() {
        return {
            toolPriorityOrder: []
        };
    },
    computed: {
        agentSkills() {
            const agent = this.agentInfo || {};
            return (agent.skills || '')
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean);
        }
    },
    watch: {
        modelValue(val) {
            if (val) {
                this.rebuildOrder();
            }
        }
    },
    mounted() {
        if (this.modelValue) {
            this.rebuildOrder();
        }
    },
    methods: {
        getDisplayLabel(id) {
            if (id === 'skill') return this.$t('agentField.resourceLabelSkill');
            if (id === 'dmn_rule') return this.$t('agentField.resourceLabelDmnRule');
            if (id === 'mem0') return this.$t('agentField.resourceLabelMem0');
            if (id === '*') return this.$t('agentField.resourceLabelOthers');
            return id;
        },
        getLineLabel(id) {
            return this.getDisplayLabel(id);
        },
        getDisplayDescription(id) {
            if (id === 'skill') return this.$t('agentField.resourceDescSkill');
            if (id === 'dmn_rule') return this.$t('agentField.resourceDescDmnRule');
            if (id === 'mem0') return this.$t('agentField.resourceDescMem0');
            if (id === '*') return this.$t('agentField.resourceDescOthers');
            return '';
        },
        rebuildOrder() {
            const saved = this.agentInfo?.tool_priority;
            const categories = [...TOOL_PRIORITY_CATEGORIES];

            // 기존 포맷(스킬 이름/도구 이름이 섞여 있는 배열)을
            // 새 포맷(카테고리 배열)으로 매핑
            const skills = new Set(this.agentSkills || []);
            const order = [];
            const seen = new Set();

            if (Array.isArray(saved) && saved.length > 0) {
                for (const item of saved) {
                    let cat = null;

                    if (item === 'skill' || item === 'dmn_rule' || item === 'mem0' || item === '*') {
                        cat = item;
                    } else if (skills.has(item)) {
                        // 예전 포맷에서 스킬 이름 → skill 카테고리로 매핑
                        cat = 'skill';
                    } else {
                        // 예전 포맷에서 스킬/고정값이 아닌 나머지 → others 로 매핑
                        cat = '*';
                    }

                    if (cat && !seen.has(cat)) {
                        order.push(cat);
                        seen.add(cat);
                    }
                }
            }

            // 누락된 카테고리는 기본 순서대로 뒤에 추가
            for (const cat of categories) {
                if (!seen.has(cat)) {
                    order.push(cat);
                    seen.add(cat);
                }
            }

            this.toolPriorityOrder = order;
        },
        moveUp(index) {
            if (index <= 0) return;
            const arr = [...this.toolPriorityOrder];
            [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
            this.toolPriorityOrder = arr;
        },
        moveDown(index) {
            if (index >= this.toolPriorityOrder.length - 1) return;
            const arr = [...this.toolPriorityOrder];
            [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
            this.toolPriorityOrder = arr;
        },
        save() {
            // 카테고리 배열(this.toolPriorityOrder)을 실제 저장 포맷으로 변환
            // - skill: 에이전트가 가진 스킬명을 지정된 스킬 우선순위대로 펼침
            // - dmn_rule, mem0, *: 그대로 한 칸씩 추가
            const expandedPriority = [];
            const skills = this.agentSkills || [];

            for (const item of this.toolPriorityOrder) {
                if (item === 'skill') {
                    // 스킬 카테고리는 실제 스킬 ID 배열로 확장
                    for (const s of skills) {
                        if (!expandedPriority.includes(s)) {
                            expandedPriority.push(s);
                        }
                    }
                } else {
                    if (!expandedPriority.includes(item)) {
                        expandedPriority.push(item);
                    }
                }
            }

            const payload = {
                ...this.agentInfo,
                name: this.agentInfo?.username || this.agentInfo?.name,
                img: this.agentInfo?.profile || this.agentInfo?.img,
                type: this.agentInfo?.agent_type || this.agentInfo?.type || 'agent',
                isAgent: true,
                tool_priority: expandedPriority.length > 0 ? expandedPriority : null
            };
            this.$emit('agentUpdated', payload);
            this.$toast?.success?.('도구 우선순위가 저장되었습니다.');
            this.close();
        },
        close() {
            this.$emit('update:modelValue', false);
            this.$emit('close');
        }
    }
};
</script>

<style scoped>
.tool-priority-list-item {
    min-height: 48px;
    align-items: flex-start;
}
.tool-priority-list-item .min-width-0 {
    min-width: 0;
    word-break: break-word;
}
</style>
