<script setup lang="ts">
/**
 * 설정 › 「CLI 에이전트 API 키」 (관리자 전용, 2026-11-11)
 *
 * 왜: cli-agent(Claude Code · Codex CLI)가 한 사람의 구독 토큰이 아니라 회사가 직접 만든 API 키로 돌게 한다.
 *     구독 자격 증명은 여러 사람이 나눠 쓸 수 없고, 회사 API 키는 그 회사의 승인된 사용자가 쓸 수 있다.
 *
 * 쓰기 전용이다 — 붙여 넣고 저장하면 칸을 비우고 상태(설정됨 · ••••1234 · 바꾼 사람 · 때)만 새로 읽는다.
 * 키를 다시 보여 주는 길은 없다(서버의 꺼내기 함수는 service_role 만 부른다).
 * 판단(모양 검사 · 상태 조각 · 저장 호출)은 src/shared/cliAgentKeys 에 두고 단위 시험한다.
 */
import { onMounted, reactive, ref } from 'vue';
import {
    CLI_KEY_PROVIDERS,
    deleteCliKey,
    fetchCliKeyStatus,
    isStoreMissing,
    keyShapeWarning,
    normalizeStatus,
    saveCliKey,
    statusDetails
} from '@/shared/cliAgentKeys';

type Provider = 'anthropic' | 'openai';
type StatusRow = ReturnType<typeof normalizeStatus>[number];

const i18n = () => (window as any).$i18n?.global;
const t = (key: string, params?: any): string => (params ? i18n()?.t(key, params) : i18n()?.t(key)) ?? key;

const providers = CLI_KEY_PROVIDERS as ReadonlyArray<{ provider: Provider; agent: string; prefix: string; consoleUrl: string }>;

const loading = ref(true);
const loadError = ref('');
// 이 서버에 키 저장소(SQL)가 아직 적용되지 않았다 — 넣기 · 지우기를 숨기고 무엇을 해야 하는지 알린다.
const storeMissing = ref(false);
const status = ref<StatusRow[]>(normalizeStatus([]));
const inputs = reactive<Record<Provider, string>>({ anthropic: '', openai: '' });
const busy = reactive<Record<Provider, boolean>>({ anthropic: false, openai: false });
const rowError = reactive<Record<Provider, string>>({ anthropic: '', openai: '' });

const confirmOpen = ref(false);
const confirmTarget = ref<Provider | null>(null);

function rowOf(provider: Provider): StatusRow {
    // 상태에 그 공급자 줄이 없으면 그 공급자의 「설정 안 됨」 줄(첫 줄을 쓰면 다른 공급자 이름으로 보인다).
    return status.value.find((r) => r.provider === provider) || normalizeStatus([]).find((r) => r.provider === provider)!;
}

function agentOf(provider: Provider | null) {
    return providers.find((p) => p.provider === provider)?.agent || '';
}

function keyLabel(provider: Provider) {
    return t(provider === 'anthropic' ? 'cliAgentKeys.anthropicKey' : 'cliAgentKeys.openaiKey');
}

/** 「설정됨 · ••••1234 · 장진영 · 11.11 21:30」 또는 「설정 안 됨」 */
function statusText(provider: Provider) {
    const row = rowOf(provider);
    if (!row.configured) return t('cliAgentKeys.notConfigured');
    return [t('cliAgentKeys.configured'), ...statusDetails(row)].join(' · ');
}

function warningOf(provider: Provider) {
    const code = keyShapeWarning(provider, inputs[provider]);
    return code ? t(`cliAgentKeys.warn.${code}`) : '';
}

function notify(message: string, color: 'success' | 'error' = 'success') {
    const app = (window as any).$app_;
    if (!app) return;
    app.snackbarMessage = message;
    app.snackbarColor = color;
    app.snackbar = true;
}

async function reload() {
    loadError.value = '';
    storeMissing.value = false;
    try {
        status.value = await fetchCliKeyStatus();
    } catch (e: any) {
        if (isStoreMissing(e)) {
            storeMissing.value = true;
            return;
        }
        loadError.value = t('cliAgentKeys.loadFailed', { message: e?.message || String(e) });
    } finally {
        loading.value = false;
    }
}

async function save(provider: Provider) {
    if (!inputs[provider].trim() || busy[provider]) return;
    busy[provider] = true;
    rowError[provider] = '';
    try {
        await saveCliKey(provider, inputs[provider]);
        // 쓰기 전용: 저장하면 바로 비운다. 화면 상태에 키가 머물지 않게.
        inputs[provider] = '';
        await reload();
        notify(t('cliAgentKeys.saved', { agent: agentOf(provider) }));
    } catch (e: any) {
        rowError[provider] = e?.message || String(e);
    } finally {
        busy[provider] = false;
    }
}

function askDelete(provider: Provider) {
    confirmTarget.value = provider;
    confirmOpen.value = true;
}

/** 지우는 중인 공급자가 있나 — 확인 단추를 막는 데 쓴다(두 번 눌러 두 번 지우지 않게). */
function confirmBusy() {
    return !!confirmTarget.value && busy[confirmTarget.value];
}

async function confirmDelete() {
    const provider = confirmTarget.value;
    if (!provider || busy[provider]) return;
    confirmOpen.value = false;
    busy[provider] = true;
    rowError[provider] = '';
    try {
        await deleteCliKey(provider);
        await reload();
        notify(t('cliAgentKeys.deleted', { agent: agentOf(provider) }));
    } catch (e: any) {
        rowError[provider] = e?.message || String(e);
    } finally {
        busy[provider] = false;
        confirmTarget.value = null;
    }
}

onMounted(reload);
</script>

<template>
    <div class="cli-keys pa-4 pa-sm-6" data-testid="cli-agent-keys">
        <h5 class="text-h5 mb-1">{{ $t('cliAgentKeys.title') }}</h5>
        <p class="text-body-2 text-medium-emphasis mb-4">{{ $t('cliAgentKeys.description') }}</p>

        <v-alert type="info" variant="tonal" density="compact" class="mb-4" data-testid="cli-key-notice">
            <div>{{ $t('cliAgentKeys.notice') }}</div>
            <div class="d-flex flex-wrap ga-3 mt-1">
                <a :href="providers[0].consoleUrl" target="_blank" rel="noopener noreferrer">{{ $t('cliAgentKeys.anthropicConsole') }}</a>
                <a :href="providers[1].consoleUrl" target="_blank" rel="noopener noreferrer">{{ $t('cliAgentKeys.openaiConsole') }}</a>
            </div>
        </v-alert>

        <v-alert v-if="storeMissing" type="warning" variant="tonal" density="compact" class="mb-4" data-testid="cli-key-store-missing">
            {{ $t('cliAgentKeys.storeMissing') }}
        </v-alert>
        <v-alert v-if="loadError" type="error" variant="tonal" density="compact" class="mb-4" data-testid="cli-key-load-error">
            {{ loadError }}
        </v-alert>

        <v-card
            v-for="p in storeMissing ? [] : providers"
            :key="p.provider"
            variant="outlined"
            class="cli-keys__row pa-4 mb-3"
            :data-testid="`cli-key-row-${p.provider}`"
        >
            <div class="d-flex flex-wrap align-center ga-2 mb-3">
                <div class="mr-auto">
                    <div class="text-subtitle-1 font-weight-bold">{{ p.agent }}</div>
                    <div class="text-caption text-medium-emphasis">{{ keyLabel(p.provider) }}</div>
                </div>
                <v-chip
                    size="small"
                    variant="tonal"
                    :color="rowOf(p.provider).configured ? 'success' : undefined"
                    :prepend-icon="rowOf(p.provider).configured ? 'mdi-check-circle-outline' : 'mdi-minus-circle-outline'"
                    :data-testid="`cli-key-status-${p.provider}`"
                    class="cli-keys__status"
                >
                    <v-progress-circular v-if="loading" indeterminate size="12" width="2" class="mr-1" />
                    {{ statusText(p.provider) }}
                </v-chip>
            </div>

            <div class="d-flex flex-wrap align-start ga-2">
                <!-- 쓰기 전용 칸: 브라우저 비밀번호 저장 · 자동 완성이 끼어들지 않게 new-password -->
                <v-text-field
                    v-model="inputs[p.provider]"
                    type="password"
                    autocomplete="new-password"
                    spellcheck="false"
                    :name="`cli-agent-key-${p.provider}`"
                    :label="rowOf(p.provider).configured ? $t('cliAgentKeys.replaceLabel') : $t('cliAgentKeys.inputLabel')"
                    :placeholder="`${p.prefix}…`"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="cli-keys__input"
                    :disabled="busy[p.provider]"
                    :data-testid="`cli-key-input-${p.provider}`"
                    @keydown.enter.prevent="save(p.provider)"
                />
                <div class="d-flex ga-2">
                    <v-btn
                        color="primary"
                        variant="flat"
                        :loading="busy[p.provider]"
                        :disabled="!inputs[p.provider].trim()"
                        :data-testid="`cli-key-save-${p.provider}`"
                        @click="save(p.provider)"
                    >
                        {{ $t('cliAgentKeys.save') }}
                    </v-btn>
                    <v-btn
                        v-if="rowOf(p.provider).configured"
                        color="error"
                        variant="text"
                        :disabled="busy[p.provider]"
                        :data-testid="`cli-key-delete-${p.provider}`"
                        @click="askDelete(p.provider)"
                    >
                        {{ $t('cliAgentKeys.delete') }}
                    </v-btn>
                </div>
            </div>

            <div v-if="warningOf(p.provider)" class="text-caption text-warning mt-2" :data-testid="`cli-key-warning-${p.provider}`">
                {{ warningOf(p.provider) }}
            </div>
            <div v-if="rowError[p.provider]" class="text-caption text-error mt-2" :data-testid="`cli-key-error-${p.provider}`">
                {{ rowError[p.provider] }}
            </div>
        </v-card>

        <p class="text-caption text-medium-emphasis mt-2">{{ $t('cliAgentKeys.fallback') }}</p>

        <v-dialog v-model="confirmOpen" max-width="440">
            <v-card data-testid="cli-key-confirm-delete">
                <v-card-title class="text-wrap">{{ $t('cliAgentKeys.confirmTitle', { agent: agentOf(confirmTarget) }) }}</v-card-title>
                <v-card-text>{{ $t('cliAgentKeys.confirmText', { agent: agentOf(confirmTarget) }) }}</v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="confirmOpen = false">{{ $t('cliAgentKeys.cancel') }}</v-btn>
                    <v-btn color="error" variant="flat" data-testid="cli-key-confirm-delete-ok" :disabled="confirmBusy()" @click="confirmDelete">
                        {{ $t('cliAgentKeys.delete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<style scoped>
.cli-keys {
    max-width: 760px;
}
.cli-keys__input {
    flex: 1 1 260px;
    min-width: 0;
}
/* 상태 줄은 이름 · 때까지 붙어 길다. 좁은 화면에서 줄을 넘기게 둔다. */
.cli-keys__status {
    height: auto !important;
    min-height: 24px;
    white-space: normal;
}
</style>
