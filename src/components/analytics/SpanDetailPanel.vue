<template>
    <div v-if="span" class="pa-4">
        <div class="d-flex align-center mb-3">
            <v-chip size="small" :color="kindColor" variant="flat" class="mr-2">
                {{ span.kind === 'llm' ? 'LLM' : 'TOOL' }}
            </v-chip>
            <h3 class="text-subtitle-1 font-weight-bold text-truncate">{{ span.name }}</h3>
            <v-spacer />
            <v-btn icon="mdi-close" variant="text" size="small" @click="$emit('close')" />
        </div>

        <v-chip size="small" class="mb-3"
            :color="span.status === 'success' ? 'success' : 'error'" variant="flat">
            {{ span.status }}
        </v-chip>

        <dl class="detail mb-3">
            <dt>{{ $t('spanDetailPanel.duration') }}</dt><dd class="tabular">{{ formatMs(span.duration_ms) }}</dd>
            <template v-if="span.kind === 'llm'">
                <dt>{{ $t('spanDetailPanel.model') }}</dt><dd>{{ span.model || '—' }}</dd>
                <dt>{{ $t('spanDetailPanel.tokens') }}</dt>
                <dd class="tabular">
                    {{ formatTokens(span.total_tokens) }}
                    <span v-if="span.prompt_tokens" class="text-medium-emphasis">
                        {{
                            $t('spanDetailPanel.tokenIo', {
                                input: formatTokens(span.prompt_tokens),
                                output: formatTokens(span.completion_tokens)
                            })
                        }}
                    </span>
                </dd>
                <dt>{{ $t('spanDetailPanel.cost') }}</dt><dd class="tabular">{{ formatCost(span.cost_usd) }}</dd>
                <dt>{{ $t('spanDetailPanel.finishReason') }}</dt><dd>{{ span.finish_reason || '—' }}</dd>
            </template>
            <template v-else>
                <dt>{{ $t('spanDetailPanel.server') }}</dt><dd>{{ span.server_name || '—' }}</dd>
                <dt>{{ $t('spanDetailPanel.tool') }}</dt><dd>{{ span.tool_name || '—' }}</dd>
                <dt>{{ $t('spanDetailPanel.size') }}</dt>
                <dd class="tabular">
                    {{
                        $t('spanDetailPanel.sizeIo', {
                            input: span.input_bytes ?? '—',
                            output: span.output_bytes ?? '—'
                        })
                    }}
                </dd>
            </template>
            <dt>{{ $t('spanDetailPanel.engine') }}</dt><dd>{{ span.engine || '—' }}</dd>
            <dt>span</dt><dd class="mono">{{ span.span_id }}</dd>
        </dl>

        <v-alert v-if="span.error_message" type="error" variant="tonal"
            density="compact" class="mb-3">
            <div class="font-weight-medium">{{ span.error_type }}</div>
            {{ span.error_message }}
        </v-alert>

        <v-alert v-if="!detail?.payload_available" type="info" variant="tonal" density="compact">
            {{ reasonText }}
        </v-alert>

        <template v-else>
            <v-alert v-if="detail.truncated" type="warning" variant="tonal"
                density="compact" class="mb-2">
                {{ $t('spanDetailPanel.truncated', { bytes: detail.orig_bytes }) }}
            </v-alert>

            <v-tabs v-model="tab" density="compact" class="mb-2">
                <v-tab v-if="detail.messages" value="prompt">{{ $t('spanDetailPanel.tabs.prompt') }}</v-tab>
                <v-tab v-if="detail.completion" value="completion">{{ $t('spanDetailPanel.tabs.completion') }}</v-tab>
                <v-tab v-if="detail.tool_input || detail.tool_output" value="tool">
                    {{ $t('spanDetailPanel.tabs.tool') }}
                </v-tab>
                <v-tab v-if="detail.model_params" value="params">{{ $t('spanDetailPanel.tabs.params') }}</v-tab>
            </v-tabs>

            <div v-if="tab === 'prompt'">
                <v-expansion-panels variant="accordion" multiple>
                    <v-expansion-panel v-for="(m, i) in detail.messages" :key="i">
                        <v-expansion-panel-title>
                            <v-chip size="x-small" variant="tonal" class="mr-2">{{ m.role }}</v-chip>
                            <span class="text-caption text-truncate">
                                {{ String(m.content || '').slice(0, 60) }}
                            </span>
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <pre class="payload">{{ m.content }}</pre>
                            <div v-if="m.tool_calls" class="mt-2">
                                <div class="text-caption text-medium-emphasis mb-1">tool_calls</div>
                                <pre class="payload">{{ pretty(m.tool_calls) }}</pre>
                            </div>
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </div>

            <div v-else-if="tab === 'completion'">
                <pre class="payload">{{ detail.completion.content || $t('spanDetailPanel.noBody') }}</pre>
                <div v-if="detail.completion.tool_calls?.length" class="mt-3">
                    <div class="text-caption text-medium-emphasis mb-1">{{ $t('spanDetailPanel.requestedTools') }}</div>
                    <div v-for="(tc, i) in detail.completion.tool_calls" :key="i" class="mb-2">
                        <v-chip size="x-small" color="warning" variant="tonal">{{ tc.name }}</v-chip>
                        <pre class="payload mt-1">{{ tc.arguments }}</pre>
                    </div>
                </div>
            </div>

            <div v-else-if="tab === 'tool'">
                <div class="text-caption text-medium-emphasis mb-1">{{ $t('spanDetailPanel.input') }}</div>
                <pre class="payload">{{ pretty(detail.tool_input) }}</pre>
                <div class="text-caption text-medium-emphasis mb-1 mt-3">{{ $t('spanDetailPanel.output') }}</div>
                <pre class="payload">{{ pretty(detail.tool_output) }}</pre>
            </div>

            <div v-else-if="tab === 'params'">
                <pre class="payload">{{ pretty(detail.model_params) }}</pre>
            </div>

            <div class="text-caption text-medium-emphasis mt-3">
                <v-icon size="12">mdi-shield-lock-outline</v-icon>
                {{ $t('spanDetailPanel.maskedNote', { mask: '***' }) }}
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue';
import { formatCost, formatMs, formatTokens } from '@/composables/useDuration';

const props = defineProps<{ detail: any | null }>();
defineEmits<{ (e: 'close'): void }>();

const { proxy } = getCurrentInstance() as any;

const tab = ref('prompt');
const span = computed(() => props.detail?.span);
const kindColor = computed(() => (span.value?.kind === 'llm' ? 'indigo' : 'orange'));

const reasonText = computed(() => {
    const r = props.detail?.reason;
    if (r === 'engine_unsupported') return proxy.$t('spanDetailPanel.reasons.engineUnsupported');
    if (r === 'expired') return proxy.$t('spanDetailPanel.reasons.expired');
    return proxy.$t('spanDetailPanel.reasons.notStored');
});

// 탭이 없는 종류를 열었을 때 빈 화면이 되지 않게 첫 탭으로 맞춘다.
watch(() => props.detail, (d) => {
    if (!d?.payload_available) return;
    tab.value = d.messages ? 'prompt'
        : d.completion ? 'completion'
        : (d.tool_input || d.tool_output) ? 'tool' : 'params';
}, { immediate: true });

function pretty(v: any) {
    if (v == null) return '—';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}
</script>

<style scoped>
.tabular { font-variant-numeric: tabular-nums; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; word-break: break-all; }
.detail { display: grid; grid-template-columns: 84px 1fr; gap: 6px 12px; font-size: 13px; }
.detail dt { color: rgba(var(--v-theme-on-surface), 0.6); }
.detail dd { margin: 0; }
.payload {
    background: rgba(var(--v-theme-on-surface), 0.05);
    padding: 10px; border-radius: 4px; font-size: 11px;
    max-height: 320px; overflow: auto; white-space: pre-wrap; word-break: break-word;
}
</style>
