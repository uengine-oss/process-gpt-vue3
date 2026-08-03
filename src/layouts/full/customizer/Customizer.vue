<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCustomizerStore } from '@/stores/customizer';
import { CheckIcon } from 'vue-tabler-icons';
import { applyAppearance, appearanceFromTheme, THEME_BY_APPEARANCE, type Appearance } from '@/ds/appearance';

const customizer = useCustomizerStore();

/**
 * 색상 테마 세 가지.
 * swatch 는 그 테마의 앱 배경, dot 은 강조색이다.
 */
const themes: Array<{ value: Appearance; labelKey: string; swatch: string; dot: string }> = [
    { value: 'light', labelKey: 'Customizer.light', swatch: '#f9f9f7', dot: '#d97757' },
    { value: 'sky', labelKey: 'Customizer.sky', swatch: '#f0f5f9', dot: '#0085db' },
    { value: 'dark', labelKey: 'Customizer.dark', swatch: '#262624', dot: '#d97757' }
];

const active = ref<Appearance>('sky');

function select(appearance: Appearance) {
    active.value = appearance;
    // 토큰 레이어 · Vuetify 테마 · BPMN 캔버스가 함께 전환된다
    applyAppearance(appearance);
    saveSettings();
}

function saveSettings() {
    localStorage.setItem(
        'userSettings',
        JSON.stringify({
            boxed: false,
            mini_sidebar: customizer.mini_sidebar,
            actTheme: customizer.actTheme
        })
    );
}

onMounted(() => {
    const saved = JSON.parse(localStorage.getItem('userSettings') ?? '{}');
    customizer.boxed = false;
    customizer.mini_sidebar = saved.mini_sidebar ?? false;
    customizer.actTheme = saved.actTheme ?? THEME_BY_APPEARANCE.sky;
    active.value = appearanceFromTheme(customizer.actTheme);
});
</script>

<!------------------------------------->
<!-- Customizer -->
<!------------------------------------->
<template>
    <div class="pa-6">
        <h5 class="text-h5">{{ $t('Customizer.settings') }}</h5>
    </div>
    <v-divider></v-divider>
    <perfect-scrollbar style="height: calc(100vh - 90px)">
        <div class="pa-6">
            <h6 class="text-h6 mb-5">{{ $t('Customizer.themeColor') }}</h6>

            <v-row class="ma-0">
                <v-col v-for="item in themes" :key="item.value" cols="4" class="pa-2">
                    <v-sheet
                        rounded="md"
                        class="cursor-pointer d-block text-center px-3 py-4 theme-card"
                        :class="{ 'theme-card--active': active === item.value }"
                        @click="select(item.value)"
                    >
                        <v-avatar :style="{ background: item.swatch }" size="28" class="theme-card__swatch">
                            <CheckIcon
                                v-if="active === item.value"
                                :color="item.value === 'dark' ? '#faf9f5' : '#0b0b0b'"
                                size="18"
                            />
                            <span v-else class="theme-card__dot" :style="{ background: item.dot }" />
                        </v-avatar>
                        <div class="text-caption mt-2">{{ $t(item.labelKey) }}</div>
                    </v-sheet>
                </v-col>
            </v-row>
        </div>
    </perfect-scrollbar>
</template>

<style lang="scss">
.theme-card {
    border: 0.5px solid var(--cds-border);
    transition: border-color 120ms var(--cds-ease-out), background-color 120ms var(--cds-ease-out);
}
.theme-card:hover {
    border-color: var(--cds-border-strong);
}
.theme-card--active {
    border-color: hsl(var(--accent-brand));
    background: var(--cds-bg-neutral);
}
.theme-card__swatch {
    box-shadow: inset 0 0 0 0.5px var(--cds-border-strong);
}
.theme-card__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}
</style>
