<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useTheme } from 'vuetify';
import { useCustomizerStore } from '@/stores/customizer';
import { CheckIcon } from 'vue-tabler-icons';
import { applyAccent, applyMode, getAccent, modeFromTheme, THEME_BY_MODE, type AppearanceMode } from '@/ds/appearance';

const theme = useTheme();
const customizer = useCustomizerStore();

/**
 * 색상 테마는 세 가지다 — 라이트(기본) · 다크 · 자율선택.
 * 앞의 둘은 모드 전환이고, 자율선택은 모드 위에 강조색만 덮어쓴다.
 */
const modes: Array<{ value: AppearanceMode; labelKey: string; swatch: string }> = [
    { value: 'light', labelKey: 'Customizer.light', swatch: '#f9f9f7' },
    { value: 'dark', labelKey: 'Customizer.dark', swatch: '#262624' }
];

const activeMode = ref<AppearanceMode>('light');
const pickerColor = ref('#D97757');
const activeCustomColor = ref('');

function getReadableOnPrimaryColor(hex: string): string {
    const normalizedHex = hex.replace('#', '');
    const r = parseInt(normalizedHex.substring(0, 2), 16);
    const g = parseInt(normalizedHex.substring(2, 4), 16);
    const b = parseInt(normalizedHex.substring(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6 ? '#000000' : '#FFFFFF';
}

/** 모드(라이트/다크) 선택 */
function selectMode(mode: AppearanceMode) {
    activeMode.value = mode;
    customizer.actTheme = THEME_BY_MODE[mode];
    // 토큰 레이어(--cds-*)와 BPMN 캔버스까지 함께 전환된다
    applyMode(mode);
    saveSettings();
}

/**
 * 자율선택 강조색.
 * Vuetify 의 primary 와 토큰의 --accent-brand 를 함께 바꿔야
 * `<v-*>` 화면과 Pg* / BPMN 캔버스가 같은 색을 쓴다.
 */
function applyCustomPrimaryColor(color: string) {
    activeCustomColor.value = color;

    const activeThemeName = customizer.actTheme;
    const target = theme.themes.value[activeThemeName];
    if (target) {
        target.colors.primary = color;
        target.colors['on-primary'] = getReadableOnPrimaryColor(color);
    }

    applyAccent(color);
    saveSettings(color);
}

/** 강조색을 기본(Claude 오렌지)으로 되돌린다 */
function resetAccent() {
    activeCustomColor.value = '';
    applyAccent(null);

    const target = theme.themes.value[customizer.actTheme];
    if (target) target.colors.primary = '#d97757';

    saveSettings();
}

function saveSettings(customColor?: string) {
    localStorage.setItem(
        'userSettings',
        JSON.stringify({
            boxed: false,
            mini_sidebar: customizer.mini_sidebar,
            actTheme: customizer.actTheme,
            customPrimaryColor: customColor ?? activeCustomColor.value ?? ''
        })
    );
}

onMounted(() => {
    const saved = JSON.parse(localStorage.getItem('userSettings') ?? '{}');
    customizer.boxed = false;
    customizer.mini_sidebar = saved.mini_sidebar ?? false;
    customizer.actTheme = saved.actTheme ?? THEME_BY_MODE.light;
    activeMode.value = modeFromTheme(customizer.actTheme);

    const accent = saved.customPrimaryColor || getAccent();
    if (accent) {
        activeCustomColor.value = accent;
        pickerColor.value = accent;
    }
});

watch(pickerColor, (newColor) => {
    if (!newColor) return;
    const hex = typeof newColor === 'string' ? newColor : String(newColor);
    // 컬러피커가 8자리(#rrggbbaa)로 줄 때가 있어 알파를 떼어낸다
    applyCustomPrimaryColor(hex.length === 9 ? hex.slice(0, 7) : hex);
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

            <!-- 라이트 / 다크 -->
            <v-row class="ma-0">
                <v-col v-for="item in modes" :key="item.value" cols="6" class="pa-2">
                    <v-sheet
                        rounded="md"
                        class="cursor-pointer d-block text-center px-5 py-4 mode-card"
                        :class="{ 'mode-card--active': activeMode === item.value && !activeCustomColor }"
                        @click="selectMode(item.value)"
                    >
                        <v-avatar :style="{ background: item.swatch }" size="25" class="mode-card__swatch">
                            <CheckIcon
                                v-if="activeMode === item.value && !activeCustomColor"
                                :color="item.value === 'dark' ? '#faf9f5' : '#0b0b0b'"
                                size="18"
                            />
                        </v-avatar>
                        <div class="text-caption mt-2">{{ $t(item.labelKey) }}</div>
                    </v-sheet>
                </v-col>
            </v-row>

            <!-- 자율선택 -->
            <div class="d-flex align-center justify-space-between mt-6 mb-2">
                <h6 class="text-h6 mb-0">{{ $t('Customizer.customColor') }}</h6>
                <v-btn v-if="activeCustomColor" size="small" variant="text" @click="resetAccent">
                    {{ $t('Customizer.reset') }}
                </v-btn>
            </div>
            <v-color-picker v-model="pickerColor" mode="hex" :modes="['hex']" elevation="0" width="100%"></v-color-picker>
        </div>
    </perfect-scrollbar>
</template>

<style lang="scss">
.v-color-picker .v-color-picker-edit__input span {
    display: none;
}

.mode-card {
    border: 0.5px solid var(--cds-border);
    transition: border-color 120ms var(--cds-ease-out), background-color 120ms var(--cds-ease-out);
}
.mode-card:hover {
    border-color: var(--cds-border-strong);
}
.mode-card--active {
    border-color: hsl(var(--accent-brand));
    background: var(--cds-bg-neutral);
}
.mode-card__swatch {
    box-shadow: inset 0 0 0 0.5px var(--cds-border-strong);
}
</style>
