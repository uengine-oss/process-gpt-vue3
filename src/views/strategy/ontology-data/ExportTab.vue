<script setup lang="ts">
// 실행 이력 연동 탭 — Process-GPT 의 프로세스 정의·인스턴스·업무(폼 값)를 Ontology Studio 로 보내 분석에 쓴다(spec 020).
// 송신은 strategy-service 가 주기적으로(사용 중일 때) 하고, 여기서 대상·사용 여부를 정하고 바로 보낼 수 있다.
import { computed, onMounted, ref } from 'vue';
import { ontologyDataApi, apiError, studioWebUrl } from './ontologyDataApi';

const emit = defineEmits<{ (e: 'browse'): void; (e: 'use-class', cls: string): void }>();

const loading = ref(false);
const settings = ref<any | null>(null);
const enabled = ref(false);
const selected = ref<string[]>([]);
const allProcesses = ref(true);
const search = ref('');
const running = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const confirmClear = ref(false);
const snack = ref<{ show: boolean; text: string; color: string }>({ show: false, text: '', color: 'success' });

async function load() {
    loading.value = true;
    error.value = null;
    try {
        settings.value = await ontologyDataApi.exportSettings();
        enabled.value = !!settings.value.enabled;
        selected.value = [...(settings.value.proc_def_ids || [])];
        allProcesses.value = !selected.value.length;
    } catch (e) {
        error.value = apiError(e);
    } finally {
        loading.value = false;
    }
}

const dirty = computed(
    () =>
        !!settings.value &&
        (enabled.value !== !!settings.value.enabled ||
            JSON.stringify([...(allProcesses.value ? [] : selected.value)].sort()) !== JSON.stringify([...(settings.value.proc_def_ids || [])].sort()))
);

const processes = computed(() => {
    const q = search.value.trim().toLowerCase();
    return (settings.value?.processes || []).filter((p: any) => !q || `${p.name} ${p.id}`.toLowerCase().includes(q));
});

async function saveSettings() {
    saving.value = true;
    try {
        settings.value = await ontologyDataApi.saveExportSettings(enabled.value, allProcesses.value ? [] : selected.value);
        snack.value = { show: true, text: enabled.value ? '저장했습니다 — 주기적으로 Studio 에 보냅니다' : '저장했습니다 — 주기 송신을 껐습니다', color: 'success' };
    } catch (e) {
        snack.value = { show: true, text: apiError(e), color: 'error' };
    } finally {
        saving.value = false;
    }
}

async function runNow(full = false) {
    if (dirty.value) await saveSettings();
    running.value = true;
    try {
        const r = await ontologyDataApi.runExport(full);
        await load();
        if (r.error) snack.value = { show: true, text: r.error, color: 'error' };
        else snack.value = { show: true, text: `보냈습니다 — 인스턴스 ${r.counts?.PgInstance ?? 0}건 · 업무 ${r.counts?.PgWorkItem ?? 0}건 반영`, color: 'success' };
    } catch (e) {
        snack.value = { show: true, text: apiError(e), color: 'error' };
    } finally {
        running.value = false;
    }
}

async function clearData() {
    confirmClear.value = false;
    try {
        const r = await ontologyDataApi.clearExport();
        await load();
        snack.value = r.error ? { show: true, text: r.error, color: 'error' } : { show: true, text: 'Studio 에서 이 테넌트가 보낸 노드를 지웠습니다', color: 'success' };
    } catch (e) {
        snack.value = { show: true, text: apiError(e), color: 'error' };
    }
}

const last = computed(() => settings.value?.last_result || null);
const CLASS_LABEL: Record<string, string> = {
    PgProcess: '프로세스 정의',
    PgActivity: '활동',
    PgInstance: '인스턴스',
    PgWorkItem: '업무'
};
function when(t?: string | null) {
    return t ? new Date(t).toLocaleString('ko-KR') : '-';
}

onMounted(load);
</script>

<template>
    <div class="export-tab">
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3">{{ error }}</v-alert>
        <v-progress-linear v-if="loading" indeterminate color="primary" />
        <div v-if="settings" class="export-layout">
            <v-card variant="outlined" class="pa-4">
                <div class="d-flex align-center mb-1">
                    <span class="text-subtitle-1 font-weight-bold">Ontology Studio 로 실행 이력 보내기</span>
                    <v-spacer />
                    <v-switch v-model="enabled" color="primary" inset hide-details density="compact" :label="enabled ? '주기 송신 켜짐' : '주기 송신 꺼짐'" />
                </div>
                <div class="text-body-2 text-medium-emphasis mb-3">
                    프로세스 정의·인스턴스·업무와 각 단계 폼에 입력된 값을 Studio 스키마 <b>{{ settings.schema_name }}</b> 에 보냅니다. 인스턴스 1건이 분석 1행
                    (<code>PgInstance</code>)이 되고, 폼 값이 Studio 의 기존 데이터 이름(공급사·메뉴 등)과 같으면 관계로 이어집니다.
                </div>

                <div class="d-flex align-center ga-3 mb-2 flex-wrap">
                    <v-radio-group v-model="allProcesses" inline hide-details density="compact">
                        <v-radio :value="true" label="모든 프로세스" />
                        <v-radio :value="false" label="고른 프로세스만" />
                    </v-radio-group>
                    <v-text-field
                        v-if="!allProcesses"
                        v-model="search"
                        prepend-inner-icon="mdi-magnify"
                        placeholder="프로세스 검색"
                        density="compact"
                        hide-details
                        style="max-width: 260px"
                    />
                    <span v-if="!allProcesses" class="text-caption text-medium-emphasis">{{ selected.length }}개 선택</span>
                </div>
                <div v-if="!allProcesses" class="process-pick">
                    <v-checkbox
                        v-for="p in processes"
                        :key="p.id"
                        v-model="selected"
                        :value="p.id"
                        density="compact"
                        hide-details
                    >
                        <template #label>
                            <span class="text-body-2">{{ p.name }}</span>
                            <span class="text-caption text-medium-emphasis ml-2">인스턴스 {{ p.instances }}</span>
                        </template>
                    </v-checkbox>
                </div>

                <div class="d-flex ga-2 mt-4 flex-wrap">
                    <v-btn color="primary" :loading="saving" :disabled="!dirty" @click="saveSettings">
                        <v-icon start size="16">mdi-content-save</v-icon>설정 저장
                    </v-btn>
                    <v-btn variant="tonal" color="primary" :loading="running" @click="runNow(false)">
                        <v-icon start size="16">mdi-upload-network-outline</v-icon>지금 보내기
                    </v-btn>
                    <v-btn variant="text" :disabled="running" @click="runNow(true)">전체 다시 보내기</v-btn>
                    <v-spacer />
                    <v-btn variant="text" color="error" @click="confirmClear = true">보낸 데이터 지우기</v-btn>
                </div>
            </v-card>

            <v-card variant="outlined" class="pa-4">
                <div class="text-subtitle-1 font-weight-bold mb-2">송신 상태</div>
                <div class="status-grid mb-3">
                    <div>
                        <div class="text-caption text-medium-emphasis">마지막 송신</div>
                        <div class="text-body-1">{{ when(settings.last_run_at) }}</div>
                    </div>
                    <div>
                        <div class="text-caption text-medium-emphasis">반영 기준 시각</div>
                        <div class="text-body-1">{{ when(settings.watermark) }}</div>
                    </div>
                </div>
                <v-alert v-if="last?.error" type="error" variant="tonal" density="compact" class="mb-2">{{ last.error }}</v-alert>
                <v-alert v-if="last?.warning" type="warning" variant="tonal" density="compact" class="mb-2">{{ last.warning }}</v-alert>
                <template v-if="last && !last.error">
                    <table class="mini-table mb-2">
                        <thead>
                            <tr><th>Studio 클래스</th><th class="num">이번에 반영</th><th class="num">Studio 보관</th><th class="num">삭제</th><th></th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="(label, cls) in CLASS_LABEL" :key="cls">
                                <td><code>{{ cls }}</code> {{ label }}</td>
                                <td class="num">{{ last.counts?.[cls] ?? 0 }}</td>
                                <td class="num">{{ last.totals_tenant?.[cls] ?? '-' }}</td>
                                <td class="num">{{ last.deleted?.[cls] ?? 0 }}</td>
                                <td>
                                    <v-btn v-if="cls === 'PgInstance'" size="x-small" variant="text" color="primary" @click="emit('use-class', cls)">데이터셋으로</v-btn>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="text-caption text-medium-emphasis">
                        폼 값 → Studio 데이터 연결(MENTIONS) {{ last.mentions ?? 0 }}건 · {{ last.full ? '전체' : '바뀐 것만' }} 송신
                    </div>
                </template>
                <div v-else-if="!last" class="text-body-2 text-medium-emphasis">아직 보낸 적이 없습니다.</div>
                <div class="d-flex ga-2 mt-4">
                    <v-btn size="small" variant="outlined" @click="emit('browse')">
                        <v-icon start size="16">mdi-database-search-outline</v-icon>보낸 데이터 둘러보기
                    </v-btn>
                    <v-btn v-if="settings.studio_url" size="small" variant="text" :href="studioWebUrl(settings.studio_url)" target="_blank">
                        <v-icon start size="16">mdi-open-in-new</v-icon>Studio 에서 열기
                    </v-btn>
                </div>
            </v-card>
        </div>

        <v-dialog v-model="confirmClear" max-width="440">
            <v-card>
                <v-card-title>보낸 데이터 지우기</v-card-title>
                <v-card-text>
                    Ontology Studio 에서 이 테넌트가 보낸 프로세스·인스턴스·업무 노드를 모두 지웁니다. 다른 테넌트와 다른 스키마 데이터는 그대로입니다.
                    Process-GPT 의 실행 이력은 지워지지 않습니다.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="confirmClear = false">취소</v-btn>
                    <v-btn color="error" @click="clearData">지우기</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <v-snackbar v-model="snack.show" :color="snack.color" timeout="3500">{{ snack.text }}</v-snackbar>
    </div>
</template>

<style scoped>
.export-layout {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: 12px;
}
.process-pick {
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 6px;
    padding: 4px 8px;
}
.status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.mini-table {
    border-collapse: collapse;
    font-size: 13px;
    width: 100%;
}
.mini-table th,
.mini-table td {
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    padding: 6px 8px;
    text-align: left;
}
.mini-table th {
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.7);
}
.mini-table .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
}
@media (max-width: 1000px) {
    .export-layout {
        grid-template-columns: 1fr;
    }
}
</style>
