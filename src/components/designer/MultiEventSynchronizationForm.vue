<template>
    <div v-if="!isLoading">
        <!-- 이벤트 1개: 이벤트 타입 입력 오른쪽에 추가 버튼. 2개 이상: 탭 영역(스크롤 + 좌우 버튼) + 추가 버튼 -->
        <div class="d-flex align-center flex-nowrap mb-3 event-sync-tabs-row">
            <template v-if="eventList.length === 1">
                <v-text-field
                    v-if="currentEventSyncModel && eventList.length > 0"
                    :model-value="currentEventSyncModel.eventSynchronization?.eventType"
                    @update:model-value="onEventTypeInput"
                    :label="$t('EventSynchronizationForm.eventType')"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="event-type-single flex-grow-1 mr-2"
                />
                <v-btn
                    size="small"
                    color="primary"
                    variant="tonal"
                    @click="addEventSync"
                >
                    <v-icon start size="small">mdi-plus</v-icon>
                    {{ $t('EventSynchronizationForm.addEvent') }}
                </v-btn>
            </template>
            <template v-else>
                <v-btn
                    icon
                    size="small"
                    variant="text"
                    :disabled="selectedEventIndex <= 0"
                    @click="selectPrevTab"
                >
                    <v-icon>mdi-chevron-left</v-icon>
                </v-btn>
                <div class="event-tabs-scroll flex-grow-1" ref="tabsScrollRef">
                    <v-tabs
                        v-model="selectedEventIndex"
                        density="compact"
                        hide-slider
                        class="event-sync-tabs"
                        align-tabs="start"
                    >
                        <v-tab
                            v-for="(sync, i) in eventList"
                            :key="'tab-' + i"
                            :value="i"
                            class="text-none"
                        >
                            <span class="tab-label">{{ tabLabel(sync, i) }}</span>
                            <v-btn
                                icon
                                size="x-small"
                                variant="text"
                                class="ml-1 tab-remove"
                                @click.stop="removeEventSync(i)"
                            >
                                <v-icon size="small">mdi-close</v-icon>
                            </v-btn>
                        </v-tab>
                    </v-tabs>
                </div>
                <v-btn
                    icon
                    size="small"
                    variant="text"
                    :disabled="selectedEventIndex >= eventList.length - 1"
                    @click="selectNextTab"
                >
                    <v-icon>mdi-chevron-right</v-icon>
                </v-btn>
                <v-btn
                    size="small"
                    color="primary"
                    variant="tonal"
                    class="ml-2"
                    @click="addEventSync"
                >
                    <v-icon start size="small">mdi-plus</v-icon>
                    {{ $t('EventSynchronizationForm.addEvent') }}
                </v-btn>
            </template>
        </div>

        <!-- 탭 모드(2개 이상)일 때 선택된 탭의 이벤트 타입 입력 -->
        <v-text-field
            v-if="eventList.length >= 2 && currentEventSyncModel"
            :model-value="currentEventSyncModel.eventSynchronization?.eventType"
            @update:model-value="onEventTypeInput"
            :label="$t('EventSynchronizationForm.eventType')"
            variant="outlined"
            density="compact"
            hide-details
            class="mb-3"
        />

        <EventSynchronizationForm
            v-if="currentEventSyncModel && eventList.length > 0"
            v-model="currentEventSyncModel"
            :roles="roles"
            :taskName="taskName"
            :definition="definition"
            :selectedActivity="selectedActivity"
            :showAttributes="showAttributes"
            :showMapper="showMapper"
            :hideEventType="true"
            @update:model-value="onFormUpdate"
        />
    </div>
</template>

<script>
import EventSynchronizationForm from '@/components/designer/EventSynchronizationForm.vue';

/** mappingContext를 이벤트별로 분리된 복사본으로 만듦 (깊은 복사) */
function copyMappingContext(mc) {
    if (!mc || typeof mc !== 'object') return { mappingElements: [] };
    try {
        return JSON.parse(JSON.stringify(mc));
    } catch (_) {
        return { mappingElements: [] };
    }
}

function normalizeSync(sync) {
    if (!sync) return { eventType: '', attributes: [], mappingContext: { mappingElements: [] } };
    return {
        eventType: sync.eventType ?? '',
        attributes: Array.isArray(sync.attributes) ? sync.attributes.map((a) => ({ ...a })) : [],
        mappingContext: copyMappingContext(sync.mappingContext)
    };
}

function ensureEventSynchronizationsArray(props) {
    const p = props || {};
    let list = p.eventSynchronizations;
    if (Array.isArray(list) && list.length > 0) {
        return list.map(normalizeSync);
    }
    const single = p.eventSynchronization;
    if (single && typeof single === 'object') {
        return [normalizeSync(single)];
    }
    return [normalizeSync(null)];
}

export default {
    name: 'MultiEventSynchronizationForm',
    components: { EventSynchronizationForm },
    props: {
        modelValue: {
            type: Object,
            default: () => ({})
        },
        roles: Array,
        taskName: String,
        definition: Object,
        selectedActivity: String,
        showAttributes: { type: Boolean, default: true },
        showMapper: { type: Boolean, default: true }
    },
    emits: ['update:modelValue'],
    data() {
        return {
            isLoading: false,
            selectedEventIndex: 0
        };
    },
    computed: {
        eventList() {
            const list = ensureEventSynchronizationsArray(this.modelValue);
            return list.length ? list : [normalizeSync(null)];
        },
        currentEventSyncModel() {
            const list = this.eventList;
            const idx = Math.min(this.selectedEventIndex, list.length - 1);
            if (idx < 0) return null;
            const sync = list[idx];
            const base = { ...this.modelValue };
            base.eventSynchronization = { ...sync };
            return base;
        }
    },
    watch: {
        modelValue: {
            handler() {
                const list = this.eventList;
                this.selectedEventIndex = Math.min(this.selectedEventIndex, Math.max(0, list.length - 1));
            },
            deep: true
        }
    },
    methods: {
        tabLabel(sync, i) {
            if (sync && sync.eventType && String(sync.eventType).trim()) {
                return sync.eventType;
            }
            return this.$t('EventSynchronizationForm.eventTabLabel', { n: i + 1 });
        },
        selectPrevTab() {
            if (this.selectedEventIndex > 0) this.selectedEventIndex--;
        },
        selectNextTab() {
            if (this.selectedEventIndex < this.eventList.length - 1) this.selectedEventIndex++;
        },
        addEventSync() {
            const list = ensureEventSynchronizationsArray(this.modelValue);
            const next = [...list, normalizeSync(null)];
            this.syncBack(next);
            this.selectedEventIndex = next.length - 1;
        },
        removeEventSync(index) {
            const list = ensureEventSynchronizationsArray(this.modelValue);
            if (list.length <= 1) return;
            const next = list.filter((_, i) => i !== index);
            this.syncBack(next);
            this.selectedEventIndex = Math.min(this.selectedEventIndex, Math.max(0, next.length - 1));
        },
        syncBack(eventSynchronizationsList) {
            const payload = { ...this.modelValue };
            payload.eventSynchronizations = eventSynchronizationsList;
            payload.eventSynchronization = eventSynchronizationsList[0] || normalizeSync(null);
            this.$emit('update:modelValue', payload);
        },
        onEventTypeInput(value) {
            const list = this.eventList.map((sync, i) =>
                i === this.selectedEventIndex ? { ...sync, eventType: value ?? '' } : sync
            );
            this.syncBack(list);
        },
        onFormUpdate(updated) {
            const list = [...this.eventList];
            const idx = Math.min(this.selectedEventIndex, list.length - 1);
            if (idx < 0) return;
            list[idx] = normalizeSync(updated.eventSynchronization);
            const payload = { ...updated };
            payload.eventSynchronizations = list;
            payload.eventSynchronization = list[0];
            this.$emit('update:modelValue', payload);
        }
    }
};
</script>

<style scoped>
.event-tabs-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    scroll-behavior: smooth;
}
.event-sync-tabs :deep(.v-tab) {
    min-width: auto;
    text-transform: none;
}
.tab-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
}
</style>
