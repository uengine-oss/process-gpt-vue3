<template>
    <div class="card-view-container">
        <div v-if="!procMap.mega_proc_list || procMap.mega_proc_list.length === 0"
            class="text-center text-grey pa-10"
        >
            {{ $t('processArchitecture.noData') }}
        </div>
        <div v-else class="columns-wrapper">
            <div
                v-for="mega in procMap.mega_proc_list"
                :key="mega.id"
                class="mega-column"
            >
                <!-- Column Header -->
                <div class="column-header">
                    <h6 class="text-subtitle-1 font-weight-bold">{{ mega.name }}</h6>
                    <v-chip size="x-small" variant="tonal" color="primary">
                        {{ getMajorCount(mega) }}
                    </v-chip>
                </div>

                <!-- Major Process Cards -->
                <div class="cards-list">
                    <v-card
                        v-for="major in (mega.major_proc_list || [])"
                        :key="major.id"
                        variant="outlined"
                        class="major-card mb-3"
                        rounded="lg"
                    >
                        <div class="card-header pa-3 pb-2">
                            <div class="d-flex align-center justify-space-between">
                                <span class="text-subtitle-2 font-weight-semibold">{{ major.name }}</span>
                                <v-chip
                                    v-if="getDomainForMajor(major)"
                                    :color="getDomainColor(getDomainForMajor(major))"
                                    size="x-small"
                                    variant="tonal"
                                >
                                    {{ getDomainForMajor(major) }}
                                </v-chip>
                            </div>
                        </div>
                        <v-divider />
                        <div class="sub-list pa-2">
                            <div
                                v-for="sub in (major.sub_proc_list || [])"
                                :key="sub.id"
                                class="sub-item d-flex align-center pa-2 rounded cursor-pointer"
                                @click="$emit('navigate', sub.id, sub.name)"
                            >
                                <v-icon size="14" class="mr-2 text-grey">mdi-file-document-outline</v-icon>
                                <span class="text-body-2 flex-grow-1 text-truncate">{{ sub.name }}</span>
                                <ProgressBadge
                                    v-if="getStatus(sub.id)"
                                    type="status"
                                    :status="getStatus(sub.id).status"
                                    size="x-small"
                                    class="ml-1"
                                />
                                <span
                                    v-if="getStatus(sub.id)?.version"
                                    class="text-caption text-grey ml-1"
                                >
                                    v{{ getStatus(sub.id).version }}
                                </span>
                            </div>
                            <div v-if="!major.sub_proc_list || major.sub_proc_list.length === 0"
                                class="text-caption text-grey-lighten-1 pa-2 text-center"
                            >
                                {{ $t('processArchitecture.noSubProcesses') }}
                            </div>
                        </div>
                    </v-card>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import ProgressBadge from '@/components/ui/ProgressBadge.vue';

const props = defineProps<{
    procMap: any;
    domains: any[];
    processStatuses: Map<string, any>;
    selectedDomain: string | null;
}>();

defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
}>();

function getMajorCount(mega: any): number {
    return (mega.major_proc_list || []).length;
}

function getStatus(subId: string) {
    return props.processStatuses.get(subId);
}

function getDomainForMajor(major: any): string | null {
    return major.domain || major.domain_id || null;
}

function getDomainColor(domainName: string): string {
    const d = props.domains.find((d: any) => d.name === domainName || d.id === domainName);
    return d?.color || 'grey';
}
</script>

<style scoped>
.columns-wrapper {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding-bottom: 8px;
}

.mega-column {
    min-width: 280px;
    max-width: 320px;
    flex-shrink: 0;
}

.column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 4px;
    margin-bottom: 8px;
    border-bottom: 2px solid #e0e0e0;
}

.major-card {
    transition: box-shadow 0.2s ease;
}

.major-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
    background: #fafafa;
}

.sub-item {
    transition: background-color 0.15s ease;
}

.sub-item:hover {
    background-color: #f5f5f5;
}
</style>
