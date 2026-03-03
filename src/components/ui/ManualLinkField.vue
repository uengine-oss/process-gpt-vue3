<template>
    <div class="manual-link-field">
        <div class="text-caption text-medium-emphasis mb-1">{{ $t('manualLink.title') }}</div>
        <div class="d-flex align-center gap-2 mb-2">
            <v-text-field
                v-model="newUrl"
                :placeholder="$t('manualLink.urlPlaceholder')"
                density="compact"
                variant="outlined"
                hide-details
                :disabled="disabled"
                @keyup.enter="addLink"
            />
            <v-btn
                size="small"
                color="primary"
                variant="tonal"
                :disabled="disabled || !newUrl.trim()"
                @click="addLink"
            >
                {{ $t('manualLink.addUrl') }}
            </v-btn>
        </div>

        <div v-if="modelValue && modelValue.length > 0" class="d-flex flex-wrap gap-1">
            <v-chip
                v-for="(url, idx) in modelValue"
                :key="idx"
                size="small"
                variant="tonal"
                color="primary"
                :closable="!disabled"
                @click="openLink(url)"
                @click:close="removeLink(idx)"
            >
                <v-icon start size="14">mdi-link</v-icon>
                {{ getDisplayUrl(url) }}
            </v-chip>
        </div>
        <div v-else class="text-caption text-medium-emphasis">
            {{ $t('manualLink.noLinks') }}
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';

export default defineComponent({
    name: 'ManualLinkField',
    props: {
        modelValue: {
            type: Array as () => string[],
            default: () => []
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        const newUrl = ref('');

        const addLink = () => {
            const url = newUrl.value.trim();
            if (!url) return;
            const updated = [...(props.modelValue || []), url];
            emit('update:modelValue', updated);
            newUrl.value = '';
        };

        const removeLink = (idx: number) => {
            const updated = [...(props.modelValue || [])];
            updated.splice(idx, 1);
            emit('update:modelValue', updated);
        };

        const openLink = (url: string) => {
            let href = url;
            if (!/^https?:\/\//i.test(href)) {
                href = 'https://' + href;
            }
            window.open(href, '_blank');
        };

        const getDisplayUrl = (url: string): string => {
            try {
                const u = new URL(url.startsWith('http') ? url : 'https://' + url);
                const path = u.pathname === '/' ? '' : u.pathname;
                const display = u.hostname + path;
                return display.length > 40 ? display.substring(0, 37) + '...' : display;
            } catch {
                return url.length > 40 ? url.substring(0, 37) + '...' : url;
            }
        };

        return { newUrl, addLink, removeLink, openLink, getDisplayUrl };
    }
});
</script>

<style scoped>
.manual-link-field .v-chip {
    cursor: pointer;
}
</style>
