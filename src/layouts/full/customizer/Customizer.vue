<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useTheme } from 'vuetify';
import { useCustomizerStore } from '@/stores/customizer';
import {
    CheckIcon,
    LayoutColumnsIcon,
    LayoutDistributeHorizontalIcon,
    LayoutDistributeVerticalIcon,
    LayoutNavbarIcon,
    LayoutSidebarLeftCollapseIcon,
TextDirectionLtrIcon,
TextDirectionRtlIcon
} from 'vue-tabler-icons';

import { Icon } from '@iconify/vue';

const theme = useTheme();
const customizer = useCustomizerStore();

const themeColors = ref([
    { name: 'BLUE_THEME', bg: 'themeBlue', colorCode: '#0085DB' },
    { name: 'AQUA_THEME', bg: 'themeAqua', colorCode: '#0074BA' },
    { name: 'PURPLE_THEME', bg: 'themePurple', colorCode: '#763EBD' },
    { name: 'GREEN_THEME', bg: 'themeGreen', colorCode: '#0A7EA4' },
    { name: 'CYAN_THEME', bg: 'themeCyan', colorCode: '#01C0C8' },
    { name: 'ORANGE_THEME', bg: 'themeOrange', colorCode: '#FA896B' }
]);

const pickerColor = ref('#0085DB');
const activeCustomColor = ref('');

function lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent));
    const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * percent));
    const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * percent));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function applyCustomPrimaryColor(color: string) {
    activeCustomColor.value = color;
    const activeThemeName = customizer.actTheme;
    theme.themes.value[activeThemeName].colors.primary = color;
    theme.themes.value[activeThemeName].colors.lightprimary = lightenColor(color, 0.85);
    theme.themes.value[activeThemeName].colors.background = lightenColor(color, 0.93);

    const bgColor = lightenColor(color, 0.93);
    const targets = document.querySelectorAll('.v-application__wrap, .v-app-bar.v-toolbar, .bg-background');
    targets.forEach((el) => (el as HTMLElement).style.setProperty('background-color', bgColor, 'important'));
    saveSettings(color);
}

function onPresetThemeSelect(themeName: string) {
    activeCustomColor.value = '';
    const preset = themeColors.value.find(t => t.name === themeName);
    if (preset) {
        theme.themes.value[themeName].colors.primary = preset.colorCode;
        theme.themes.value[themeName].colors.lightprimary = lightenColor(preset.colorCode, 0.85);
        pickerColor.value = preset.colorCode;
    }
    const targets = document.querySelectorAll('.v-application__wrap, .v-app-bar.v-toolbar, .bg-background');
    targets.forEach((el) => (el as HTMLElement).style.removeProperty('background-color'));
}

function saveSettings(customColor?: string) {
    const selectedTheme = themeColors.value.find(t => t.name === customizer.actTheme);
    const themeColorCode = customColor || (selectedTheme ? selectedTheme.colorCode : '#0085DB');
    const userSettings = {
        boxed: false,
        mini_sidebar: customizer.mini_sidebar,
        actTheme: customizer.actTheme,
        themeColorCode: themeColorCode,
        customPrimaryColor: customColor || ''
    };
    localStorage.setItem('userSettings', JSON.stringify(userSettings));
}

onMounted(() => {
    const savedSettings = JSON.parse(localStorage.getItem('userSettings') ?? '{}');
    customizer.boxed = false;
    customizer.mini_sidebar = savedSettings.mini_sidebar ?? false;
    customizer.actTheme = savedSettings.actTheme ?? 'BLUE_THEME';

    if (savedSettings.customPrimaryColor) {
        activeCustomColor.value = savedSettings.customPrimaryColor;
        pickerColor.value = savedSettings.customPrimaryColor;
        setTimeout(() => {
            applyCustomPrimaryColor(savedSettings.customPrimaryColor);
        }, 300);
    }
});

watch(pickerColor, (newColor) => {
    if (newColor) {
        const hex = typeof newColor === 'string' ? newColor : newColor;
        const cleanHex = hex.length === 9 ? hex.slice(0, 7) : hex;
        applyCustomPrimaryColor(cleanHex);
    }
});

watch(
  [() => customizer.mini_sidebar, () => customizer.actTheme], 
  ([newMiniSidebar, newActTheme], [oldMiniSidebar, oldActTheme]) => {
    if (oldActTheme && newActTheme !== oldActTheme) {
        onPresetThemeSelect(newActTheme);
    }
    saveSettings(activeCustomColor.value || undefined);
  }
);
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
            <v-item-group mandatory v-model="customizer.actTheme" class="ml-n2 v-row">
                <v-col cols="4" v-for="themeItem in themeColors" :key="themeItem.name" class="pa-2">
                    <v-item v-slot="{ isSelected, toggle }" :value="themeItem.name">
                        <v-sheet
                            rounded="xl"
                            class="border cursor-pointer d-block text-center px-5 py-4 hover-btns"
                            elevation="10"
                            @click="toggle"
                        >
                            <v-avatar :class="themeItem.bg" size="25">
                                <CheckIcon color="white" size="18" v-if="isSelected && !activeCustomColor" />
                            </v-avatar>
                        </v-sheet>
                    </v-item>
                </v-col>
            </v-item-group>

            <v-color-picker
                v-model="pickerColor"
                class="mt-4"
                mode="hex"
                :modes="['hex']"
                elevation="0"
                width="100%"
            ></v-color-picker>
            <!---  불필요하게 작아지는 사이드바 영역 타입을 설정하는 부분 --->
            <!-- <v-sheet v-if="customizer.setHorizontalLayout != true">
                <h6 class="text-h6 mt-11 mb-2">Sidebar Type</h6>
                <v-btn-toggle v-model="customizer.mini_sidebar" color="primary" class="my-2 btn-group-custom gap-3" rounded="0" group>
                    <v-btn :value="false" variant="text" elevation="10" class="rounded-xl">
                        <Icons :icon="'sidebar-minimalistic-outline'" :size="22" class="mr-2" />
                        Full
                    </v-btn>
                    <v-btn :value="true" variant="text" elevation="10" class="rounded-xl">
                        <Icons :icon="'siderbar-outline'" :size="22" class="mr-2" />
                        Collapse
                    </v-btn>
                </v-btn-toggle>
            </v-sheet> -->
        </div>
    </perfect-scrollbar>
</template>

<style lang="scss">
.v-color-picker .v-color-picker-edit__input span {
    display: none;
}
</style>
