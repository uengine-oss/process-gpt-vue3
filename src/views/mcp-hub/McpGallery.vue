<template>
    <v-container fluid class="pa-6">
        <div class="d-flex align-center mb-4">
            <div>
                <h2 class="text-h5 font-weight-bold mb-1">{{ $t('mcpGallery.title') }}</h2>
                <div class="text-body-2 text-medium-emphasis">
                    {{ $t('mcpGallery.subtitle') }}
                </div>
            </div>
            <v-spacer />
            <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/mcp-hub">{{ $t('mcpGallery.backToList') }}</v-btn>
        </div>

        <v-tabs v-model="tab" class="mb-4">
            <v-tab value="gallery">{{ $t('mcpGallery.tabs.curated') }}</v-tab>
            <v-tab value="registry">{{ $t('mcpGallery.tabs.registry') }}</v-tab>
        </v-tabs>

        <div v-if="tab === 'registry'" class="mb-4 d-flex ga-2" style="max-width: 520px">
            <v-text-field v-model="q" :label="$t('mcpGallery.searchLabel')" density="compact"
                variant="outlined" hide-details prepend-inner-icon="mdi-magnify"
                @keyup.enter="searchRegistry" />
            <v-btn color="primary" :loading="searching" @click="searchRegistry">{{ $t('mcpGallery.search') }}</v-btn>
        </div>

        <v-alert v-if="tab === 'registry' && registryUnavailable" type="info"
            variant="tonal" density="compact" class="mb-4">
            {{ registryReason }}
        </v-alert>

        <v-row dense>
            <v-col v-for="e in visible" :key="e.source + e.slug" cols="12" sm="6" lg="4">
                <v-card variant="outlined" class="h-100 d-flex flex-column">
                    <v-card-item>
                        <v-card-title class="text-subtitle-1">{{ e.name }}</v-card-title>
                        <v-card-subtitle class="text-caption">
                            {{ e.publisher || '—' }}
                            <v-chip v-if="e.category" size="x-small" variant="tonal" class="ml-1">
                                {{ e.category }}
                            </v-chip>
                        </v-card-subtitle>
                    </v-card-item>
                    <v-card-text class="flex-grow-1 text-body-2">
                        {{ e.description || $t('mcpGallery.noDescription') }}
                        <div class="mt-2 d-flex ga-1 flex-wrap">
                            <v-chip size="x-small" variant="outlined">
                                {{ e.install_template.transport }}
                            </v-chip>
                            <v-chip v-for="k in e.required_env || []" :key="k.key"
                                size="x-small" variant="outlined" color="warning">
                                {{ k.key }}
                            </v-chip>
                        </div>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn v-if="e.homepage_url" variant="text" size="small"
                            :href="e.homepage_url" target="_blank">{{ $t('mcpGallery.docs') }}</v-btn>
                        <v-spacer />
                        <v-btn color="primary" variant="tonal" size="small"
                            @click="openInstall(e)">{{ $t('mcpGallery.install') }}</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>

        <v-dialog v-model="installOpen" max-width="560">
            <v-card v-if="target">
                <v-card-title>{{ $t('mcpGallery.installTitle', { name: target.name }) }}</v-card-title>
                <v-divider />
                <v-card-text>
                    <v-text-field v-model="installName" :label="$t('mcpGallery.serverName')"
                        density="compact" variant="outlined" class="mb-2" />
                    <v-text-field v-model="department" :label="$t('mcpGallery.department')"
                        density="compact" variant="outlined" class="mb-2" />
                    <template v-for="k in target.required_env || []" :key="k.key">
                        <v-text-field v-model="envValues[k.key]" :label="k.label || k.key"
                            :hint="k.help" persistent-hint
                            :type="k.secret ? 'password' : 'text'"
                            density="compact" variant="outlined" class="mb-2" />
                    </template>
                    <v-alert v-if="result" density="compact" class="mt-2"
                        :type="result.ok ? 'success' : 'error'" variant="tonal">
                        {{ result.text }}
                    </v-alert>
                </v-card-text>
                <v-divider />
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="installOpen = false">{{ $t('mcpGallery.cancel') }}</v-btn>
                    <v-btn color="primary" :loading="installing" @click="doInstall">{{ $t('mcpGallery.install') }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import mcpHubApi from '@/services/mcpHubApi';

const router = useRouter();
const { t } = useI18n();
const tab = ref('gallery');
const gallery = ref<any[]>([]);
const registry = ref<any[]>([]);
const registryUnavailable = ref(false);
const registryReason = ref('');
const q = ref('');
const searching = ref(false);

const installOpen = ref(false);
const installing = ref(false);
const target = ref<any>(null);
const installName = ref('');
const department = ref('');
const envValues = ref<Record<string, string>>({});
const result = ref<{ ok: boolean; text: string } | null>(null);

const visible = computed(() => (tab.value === 'gallery' ? gallery.value : registry.value));

async function loadGallery() {
    const d = await mcpHubApi.gallery();
    gallery.value = d.entries || [];
}

async function searchRegistry() {
    searching.value = true;
    try {
        const d = await mcpHubApi.searchRegistry(q.value);
        registry.value = d.entries || [];
        registryUnavailable.value = !d.available;
        registryReason.value = d.reason || '';
    } finally {
        searching.value = false;
    }
}

function openInstall(e: any) {
    target.value = e;
    installName.value = e.slug;
    department.value = '';
    envValues.value = {};
    result.value = null;
    installOpen.value = true;
}

async function doInstall() {
    installing.value = true;
    result.value = null;
    try {
        const srv = await mcpHubApi.install({
            slug: target.value.slug,
            source: target.value.source,
            name: installName.value,
            department_id: department.value || null,
            env: envValues.value
        });
        result.value = { ok: true, text: t('mcpGallery.installed', { n: srv.tool_count ?? 0 }) };
        setTimeout(() => router.push(`/mcp-hub/servers/${srv.id}`), 900);
    } catch (e: any) {
        result.value = { ok: false, text: e.response?.data?.detail || e.message };
    } finally {
        installing.value = false;
    }
}

onMounted(() => {
    loadGallery();
    searchRegistry();
});
</script>
