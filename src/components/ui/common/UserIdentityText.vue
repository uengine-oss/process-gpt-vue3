<template>
    <span v-if="displayText" class="user-identity-text" :title="displayText">{{ displayText }}</span>
    <span v-else class="cell-muted">{{ fallback }}</span>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { formatIdentityFull, formatIdentityName, formatIdentityWithTeam, type UserIdentity } from '@/utils/userIdentity';

type IdentityValue = string | string[] | null | undefined;
type FormatMode = 'name' | 'withTeam' | 'full';
interface BackendWithIdentityResolver {
    resolveUserIdentities?: (ids: string[]) => Promise<Record<string, UserIdentity | null>>;
}

const props = withDefaults(
    defineProps<{
        value?: IdentityValue;
        displayMap?: Record<string, string>;
        fallback?: string;
        format?: FormatMode;
        separator?: string;
    }>(),
    {
        fallback: '-',
        format: 'name',
        separator: ', '
    }
);

const displayText = ref('');
const labelCache = new Map<string, string>();
let resolveRunId = 0;

function normalizeValues(value: IdentityValue): string[] {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    return [...new Set(list.map((v) => String(v || '').trim()).filter(Boolean))];
}

function cacheKey(format: FormatMode, value: string) {
    return `${format}:${value}`;
}

function formatIdentity(identity: UserIdentity | null, fallback: string) {
    if (props.format === 'withTeam') return formatIdentityWithTeam(identity, fallback);
    if (props.format === 'full') return formatIdentityFull(identity, fallback);
    return formatIdentityName(identity, fallback);
}

async function resolveDisplayText() {
    const runId = ++resolveRunId;
    const values = normalizeValues(props.value);
    if (values.length === 0) {
        displayText.value = '';
        return;
    }

    const displayMap = props.displayMap || {};
    const labels = new Map<string, string>();
    const missing = values.filter((value) => {
        const mapped = displayMap[value];
        if (mapped) {
            labels.set(value, mapped);
            return false;
        }

        const cached = labelCache.get(cacheKey(props.format, value));
        if (cached) {
            labels.set(value, cached);
            return false;
        }

        return true;
    });

    if (missing.length > 0) {
        try {
            const backend = BackendFactory.createBackend() as BackendWithIdentityResolver;
            if (typeof backend.resolveUserIdentities === 'function') {
                const identityMap = await backend.resolveUserIdentities(missing);
                missing.forEach((value) => {
                    const label = formatIdentity(identityMap[value] || null, value);
                    labelCache.set(cacheKey(props.format, value), label);
                    labels.set(value, label);
                });
            } else {
                missing.forEach((value) => labels.set(value, value));
            }
        } catch {
            missing.forEach((value) => labels.set(value, value));
        }
    }

    if (runId !== resolveRunId) return;
    displayText.value = values.map((value) => labels.get(value) || value).join(props.separator);
}

watch(
    () => [props.value, props.displayMap, props.format, props.separator],
    () => resolveDisplayText(),
    { immediate: true, deep: true }
);
</script>

<style scoped>
.user-identity-text {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: bottom;
    white-space: nowrap;
}
</style>
