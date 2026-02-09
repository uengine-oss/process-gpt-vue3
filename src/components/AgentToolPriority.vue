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
const TOOL_PRIORITY_FIXED = ['dmn_rule', 'mem0', '*'];

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
        dynamicResources() {
            const agent = this.agentInfo || {};
            const tools = (agent.tools || '')
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean);
            const skills = (agent.skills || '')
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean);
            return [...new Set([...tools, ...skills])];
        }
    },
    watch: {
        modelValue(val) {
            if (val) {
                this.rebuildOrder();
            }
        },
        dynamicResources: {
            handler() {
                if (this.modelValue) {
                    this.rebuildOrder();
                }
            },
            deep: true
        }
    },
    mounted() {
        if (this.modelValue) {
            this.rebuildOrder();
        }
    },
    methods: {
        getDisplayLabel(id) {
            if (id === 'dmn_rule') return this.$t('agentField.resourceLabelDmnRule');
            if (id === 'mem0') return this.$t('agentField.resourceLabelMem0');
            if (id === '*') return this.$t('agentField.resourceLabelOthers');
            return id;
        },
        getLineLabel(id) {
            if (id === 'dmn_rule' || id === 'mem0' || id === '*') {
                return this.getDisplayLabel(id);
            }
            return this.$t('agentField.resourceLabelSkill');
        },
        getDisplayDescription(id) {
            if (id === 'dmn_rule') return this.$t('agentField.resourceDescDmnRule');
            if (id === 'mem0') return this.$t('agentField.resourceDescMem0');
            if (id === '*') return this.$t('agentField.resourceDescOthers');
            return this.$t('agentField.resourceDescSkill');
        },
        rebuildOrder() {
            const dynamic = this.dynamicResources;
            const allItems = [...dynamic, ...TOOL_PRIORITY_FIXED];
            const saved = this.agentInfo?.tool_priority;
            if (Array.isArray(saved) && saved.length > 0) {
                const order = [...saved];
                const seen = new Set(order);
                for (const item of allItems) {
                    if (!seen.has(item)) {
                        order.push(item);
                        seen.add(item);
                    }
                }
                this.toolPriorityOrder = order.filter((x) => allItems.includes(x));
            } else {
                this.toolPriorityOrder = [...allItems];
            }
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
            const payload = {
                ...this.agentInfo,
                name: this.agentInfo?.username || this.agentInfo?.name,
                img: this.agentInfo?.profile || this.agentInfo?.img,
                type: this.agentInfo?.agent_type || this.agentInfo?.type || 'agent',
                isAgent: true,
                tool_priority: this.toolPriorityOrder.length > 0 ? [...this.toolPriorityOrder] : null
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
