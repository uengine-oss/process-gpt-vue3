<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useStrategyStore } from '@/stores/strategy/strategyStore';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const store = useStrategyStore();

interface ChatEntry {
    role: 'user' | 'assistant';
    content: string;
    actions?: any[];
}

const messages = ref<ChatEntry[]>([]);
const input = ref('');
const sending = ref(false);
const error = ref('');
const scrollArea = ref<HTMLElement | null>(null);

function close() {
    emit('update:modelValue', false);
}

async function scrollToBottom() {
    await nextTick();
    if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
}

async function send() {
    const text = input.value.trim();
    if (!text || sending.value) return;
    messages.value.push({ role: 'user', content: text });
    input.value = '';
    error.value = '';
    sending.value = true;
    await scrollToBottom();
    try {
        const history = messages.value.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
        const result = await store.sendChatMessage(text, history);
        messages.value.push({ role: 'assistant', content: result.reply, actions: result.actions });
    } catch (e: any) {
        error.value = e?.response?.data?.detail || e?.message || 'AI edit request failed.';
    } finally {
        sending.value = false;
        await scrollToBottom();
    }
}

function actionLabel(action: any) {
    const r = action.result || {};
    if (action.status === 'error') return `⚠️ ${r.error || 'failed'}`;
    if (r.created) return `✅ ${r.created} '${r.name}' created`;
    if (r.updated) return `✏️ ${r.updated} '${r.name}' updated`;
    if (r.deleted) return `🗑️ ${r.deleted} '${r.name}' deleted`;
    if (r.linked) return `🔗 '${r.child?.name}' → '${r.parent?.name}' linked`;
    if (r.unlinked) return `✂️ link removed`;
    return action.tool;
}
</script>

<template>
    <v-navigation-drawer
        :model-value="props.modelValue"
        location="right"
        temporary
        width="380"
        @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    >
        <div class="d-flex flex-column fill-height">
            <div class="d-flex align-center justify-space-between pa-3 border-b">
                <div class="d-flex align-center ga-2">
                    <v-icon size="20">mdi-robot</v-icon>
                    <span class="text-subtitle-1 font-weight-medium">{{ $t('strategyBoard.chatTitle') }}</span>
                </div>
                <v-btn icon variant="text" size="small" @click="close">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </div>

            <div ref="scrollArea" class="flex-grow-1 overflow-y-auto pa-3">
                <p v-if="!messages.length" class="text-caption text-medium-emphasis">
                    {{ $t('strategyBoard.chatHint') }}
                </p>
                <div v-for="(m, i) in messages" :key="i" class="mb-3">
                    <div
                        class="pa-2 rounded"
                        :class="m.role === 'user' ? 'bg-primary text-white ml-6' : 'bg-grey-lighten-4 mr-6'"
                    >
                        <div class="text-body-2" style="white-space: pre-wrap">{{ m.content }}</div>
                    </div>
                    <div v-if="m.actions?.length" class="mt-1 mr-6">
                        <div v-for="(a, j) in m.actions" :key="j" class="text-caption text-medium-emphasis">
                            {{ actionLabel(a) }}
                        </div>
                    </div>
                </div>
                <v-alert v-if="error" type="error" density="compact" variant="tonal" class="mt-2">
                    {{ error }}
                </v-alert>
            </div>

            <div class="pa-3 border-t">
                <v-textarea
                    v-model="input"
                    :placeholder="$t('strategyBoard.chatPlaceholder')"
                    density="compact"
                    variant="outlined"
                    rows="2"
                    auto-grow
                    hide-details
                    :disabled="sending"
                    @keydown.enter.exact.prevent="send"
                />
                <v-btn class="mt-2" color="primary" block :loading="sending" :disabled="!input.trim()" @click="send">
                    {{ $t('strategyBoard.chatSend') }}
                </v-btn>
            </div>
        </div>
    </v-navigation-drawer>
</template>
