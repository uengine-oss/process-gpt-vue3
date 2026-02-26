<template>
    <div class="matrix-view-container">
        <div v-if="!hasData" class="text-center text-grey pa-10">
            {{ $t('processArchitecture.noData') }}
        </div>
        <div v-else class="matrix-scroll-area">
            <table class="matrix-table">
                <thead>
                    <tr>
                        <th class="corner-cell">
                            <div class="corner-content">
                                <span class="corner-row-label">{{ $t('processArchitecture.matrix.domain') }}</span>
                                <span class="corner-col-label">Mega Process</span>
                                <div class="corner-diagonal"></div>
                            </div>
                        </th>
                        <th
                            v-for="megaProc in megaProcesses"
                            :key="megaProc.id"
                            class="mega-header-cell"
                        >
                            <div class="mega-header-inner">
                                <span class="mega-name">{{ megaProc.name }}</span>
                                <span class="mega-count">{{ getMegaProcessCount(megaProc.id) }}</span>
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(domain, dIdx) in displayDomains"
                        :key="domain.id"
                        :class="{ 'row-alt': dIdx % 2 === 1 }"
                    >
                        <!-- Domain cell (sticky left) -->
                        <td class="domain-cell" :style="domainCellStyle(domain)">
                            <div class="domain-inner">
                                <div
                                    class="domain-color-bar"
                                    :style="{ background: domain.color || '#78909C' }"
                                ></div>
                                <div class="domain-info">
                                    <span class="domain-name">{{ domain.name }}</span>
                                    <span class="domain-count">{{ getDomainProcessCount(domain.id) }} proc</span>
                                </div>
                            </div>
                        </td>

                        <!-- Process cells -->
                        <td
                            v-for="megaProc in megaProcesses"
                            :key="`${domain.id}-${megaProc.id}`"
                            class="process-cell"
                        >
                            <div class="cell-content">
                                <template v-if="getProcesses(domain.id, megaProc.id).length > 0">
                                    <div
                                        v-for="proc in getProcesses(domain.id, megaProc.id)"
                                        :key="proc.id"
                                        class="process-card"
                                    >
                                        <div class="process-card-header">
                                            <span
                                                class="process-link"
                                                @click="$emit('navigate', proc.id, proc.name)"
                                            >
                                                {{ proc.name }}
                                            </span>
                                            <span
                                                v-if="proc.sub_proc_list && proc.sub_proc_list.length > 0"
                                                class="sub-badge"
                                            >
                                                {{ proc.sub_proc_list.length }}
                                            </span>
                                        </div>

                                        <!-- Expandable sub process list -->
                                        <div
                                            v-if="proc.sub_proc_list && proc.sub_proc_list.length > 0"
                                            class="sub-section"
                                        >
                                            <button
                                                class="sub-toggle"
                                                @click="toggleCell(`${domain.id}-${megaProc.id}-${proc.id}`)"
                                            >
                                                <v-icon size="12" class="mr-1">
                                                    {{ expandedCells.has(`${domain.id}-${megaProc.id}-${proc.id}`) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                                                </v-icon>
                                                {{ expandedCells.has(`${domain.id}-${megaProc.id}-${proc.id}`)
                                                    ? $t('processArchitecture.matrix.collapse')
                                                    : `${proc.sub_proc_list.length} sub` }}
                                            </button>

                                            <transition name="slide-y">
                                                <div
                                                    v-if="expandedCells.has(`${domain.id}-${megaProc.id}-${proc.id}`)"
                                                    class="sub-list"
                                                >
                                                    <div
                                                        v-for="sub in proc.sub_proc_list"
                                                        :key="sub.id"
                                                        class="sub-row"
                                                        @click.stop="emit('navigate', sub.id, sub.name)"
                                                    >
                                                        <span class="sub-name flex-grow-1">{{ sub.name }}</span>
                                                        <v-btn
                                                            icon
                                                            variant="text"
                                                            size="x-small"
                                                            :class="['fav-btn', { 'is-fav': favorites?.has(sub.id) }]"
                                                            @click.stop="emit('toggleFavorite', sub.id)"
                                                        >
                                                            <v-icon
                                                                size="12"
                                                                :color="favorites?.has(sub.id) ? 'amber' : 'grey-lighten-1'"
                                                            >
                                                                {{ favorites?.has(sub.id) ? 'mdi-star' : 'mdi-star-outline' }}
                                                            </v-icon>
                                                        </v-btn>
                                                        <ProgressBadge
                                                            v-if="processStatuses.get(sub.id)"
                                                            type="status"
                                                            :status="processStatuses.get(sub.id).status"
                                                            size="x-small"
                                                        />
                                                    </div>
                                                </div>
                                            </transition>
                                        </div>
                                    </div>
                                </template>
                                <div v-else class="empty-indicator">
                                    <span class="empty-dash">--</span>
                                </div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';

const props = defineProps<{
    metricsMap: any;
    processStatuses: Map<string, any>;
    selectedDomain: string | null;
    favorites?: Set<string>;
}>();

const emit = defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
    (e: 'toggleFavorite', id: string): void;
}>();

const expandedCells = ref(new Set<string>());

const hasData = computed(() => {
    return props.metricsMap?.domains?.length > 0 || props.metricsMap?.mega_processes?.length > 0;
});

const megaProcesses = computed(() => {
    return props.metricsMap?.mega_processes || [];
});

const displayDomains = computed(() => {
    return props.metricsMap?.domains || [];
});

function getProcesses(domainId: string, megaProcessId: string): any[] {
    if (!props.metricsMap?.processes) return [];
    return props.metricsMap.processes.filter(
        (proc: any) => proc.domain_id === domainId && proc.mega_process_id === megaProcessId
    );
}

function getMegaProcessCount(megaId: string): number {
    if (!props.metricsMap?.processes) return 0;
    return props.metricsMap.processes.filter((p: any) => p.mega_process_id === megaId).length;
}

function getDomainProcessCount(domainId: string): number {
    if (!props.metricsMap?.processes) return 0;
    return props.metricsMap.processes.filter((p: any) => p.domain_id === domainId).length;
}

function domainCellStyle(domain: any) {
    return {
        '--domain-color': domain.color || '#78909C'
    };
}

function toggleCell(key: string) {
    const next = new Set(expandedCells.value);
    if (next.has(key)) {
        next.delete(key);
    } else {
        next.add(key);
    }
    expandedCells.value = next;
}
</script>

<style scoped>
/* ── Scroll container ── */
.matrix-scroll-area {
    overflow-x: auto;
    border: 2px solid #94a3b8;
    border-radius: 12px;
    background: white;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}

/* ── Table reset ── */
.matrix-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.85rem;
}

/* ── Corner cell (Domain / Mega label) ── */
.corner-cell {
    position: sticky;
    left: 0;
    z-index: 3;
    width: 160px;
    min-width: 160px;
    background: #1e293b;
    padding: 0;
    border-bottom: 3px solid #3b82f6;
    border-right: 2px solid #94a3b8;
}

.corner-content {
    position: relative;
    width: 100%;
    height: 56px;
    overflow: hidden;
}

.corner-row-label {
    position: absolute;
    bottom: 6px;
    left: 12px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 600;
}

.corner-col-label {
    position: absolute;
    top: 6px;
    right: 12px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 600;
}

.corner-diagonal {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        to bottom right,
        transparent calc(50% - 0.5px),
        rgba(255, 255, 255, 0.15) calc(50% - 0.5px),
        rgba(255, 255, 255, 0.15) calc(50% + 0.5px),
        transparent calc(50% + 0.5px)
    );
}

/* ── Mega process header cells ── */
.mega-header-cell {
    background: #1e293b;
    padding: 14px 16px;
    text-align: center;
    min-width: 200px;
    border-left: 2px solid rgba(255, 255, 255, 0.12);
    border-bottom: 3px solid #3b82f6;
}

.mega-header-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}

.mega-name {
    color: white;
    font-weight: 700;
    font-size: 0.82rem;
    letter-spacing: 0.01em;
}

.mega-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.65rem;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: 10px;
}

/* ── Domain cell (sticky left) ── */
.domain-cell {
    position: sticky;
    left: 0;
    z-index: 2;
    width: 160px;
    min-width: 160px;
    background: white;
    padding: 0 !important;
    border-bottom: 2px solid #cbd5e1;
    border-right: 2px solid #94a3b8;
}

.row-alt .domain-cell {
    background: #f8fafc;
}

.domain-inner {
    display: flex;
    align-items: center;
    gap: 0;
    height: 100%;
    min-height: 60px;
}

.domain-color-bar {
    width: 4px;
    align-self: stretch;
    flex-shrink: 0;
    border-radius: 0 2px 2px 0;
}

.domain-info {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    gap: 2px;
}

.domain-name {
    font-weight: 700;
    font-size: 0.82rem;
    color: #1e293b;
}

.domain-count {
    font-size: 0.7rem;
    color: #94a3b8;
    font-weight: 500;
}

/* ── Process cells ── */
.process-cell {
    padding: 12px 14px !important;
    border-bottom: 2px solid #cbd5e1;
    border-left: 2px solid #cbd5e1;
    vertical-align: top;
    background: #f8fafc;
}

.row-alt .process-cell {
    background: #f1f5f9;
}

.cell-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 48px;
}

/* ── Process card inside cell ── */
.process-card {
    background: white;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    transition: border-color 0.15s, box-shadow 0.15s;
}

.row-alt .process-card {
    background: white;
}

.process-card:hover {
    border-color: #60a5fa;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.process-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
}

.process-link {
    font-weight: 600;
    font-size: 0.8rem;
    color: #1e40af;
    cursor: pointer;
    transition: color 0.12s;
    line-height: 1.3;
}

.process-link:hover {
    color: #1d4ed8;
    text-decoration: underline;
}

.sub-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    background: #eff6ff;
    color: #3b82f6;
    font-size: 0.65rem;
    font-weight: 700;
    border-radius: 10px;
    padding: 0 5px;
    flex-shrink: 0;
}

/* ── Sub section ── */
.sub-section {
    margin-top: 4px;
}

.sub-toggle {
    display: inline-flex;
    align-items: center;
    font-size: 0.7rem;
    color: #64748b;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 0;
    font-weight: 500;
    transition: color 0.12s;
}

.sub-toggle:hover {
    color: #3b82f6;
}

.sub-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 4px;
    border-left: 2px solid #e2e8f0;
    padding-left: 8px;
}

.sub-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.12s;
}

.sub-row:hover {
    background: #eff6ff;
}

.sub-row .fav-btn {
    opacity: 0;
    transition: opacity 0.15s ease;
}

.sub-row:hover .fav-btn {
    opacity: 1;
}

.sub-row .fav-btn.is-fav {
    opacity: 1;
}

.sub-name {
    font-size: 0.75rem;
    color: #475569;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ── Empty indicator ── */
.empty-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    background: repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 6px,
        #f1f5f9 6px,
        #f1f5f9 7px
    );
    border-radius: 6px;
}

.empty-dash {
    color: #94a3b8;
    font-size: 0.75rem;
    letter-spacing: 1px;
    background: rgba(248, 250, 252, 0.8);
    padding: 2px 10px;
    border-radius: 4px;
}

/* ── Transition ── */
.slide-y-enter-active,
.slide-y-leave-active {
    transition: opacity 0.2s ease, max-height 0.25s ease;
    overflow: hidden;
}

.slide-y-enter-from,
.slide-y-leave-to {
    opacity: 0;
    max-height: 0;
}

.slide-y-enter-to,
.slide-y-leave-from {
    max-height: 400px;
}
</style>
