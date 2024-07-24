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

// themes color options
const themeColors = ref([
    {
        name: 'BLUE_THEME',
        bg: 'themeBlue'
    },
    {
        name: 'AQUA_THEME',
        bg: 'themeAqua'
    },
    {
        name: 'PURPLE_THEME',
        bg: 'themePurple'
    },
    {
        name: 'GREEN_THEME',
        bg: 'themeGreen'
    },
    {
        name: 'CYAN_THEME',
        bg: 'themeCyan'
    },
    {
        name: 'ORANGE_THEME',
        bg: 'themeOrange'
    }
]);

// Dark Theme Colors
const DarkthemeColors = ref([
    { name: 'DARK_BLUE_THEME', bg: 'themeDarkBlue' },
    { name: 'DARK_AQUA_THEME', bg: 'themeDarkAqua' },
    { name: 'DARK_PURPLE_THEME', bg: 'themeDarkPurple' },
    { name: 'DARK_GREEN_THEME', bg: 'themeDarkGreen' },
    { name: 'DARK_CYAN_THEME', bg: 'themeDarkCyan' },
    { name: 'DARK_ORANGE_THEME', bg: 'themeDarkOrange' }
]);


// LocalStorage에서 설정 불러오기 및 초기화
onMounted(() => {
  const savedSettings = JSON.parse(localStorage.getItem('userSettings') ?? '{}');
  customizer.boxed = savedSettings.boxed ?? false;
  customizer.mini_sidebar = savedSettings.mini_sidebar ?? false;
  customizer.actTheme = savedSettings.actTheme ?? 'BLUE_THEME';
});

// 모든 관련 상태를 하나의 watch에서 감시
watch(
  [() => customizer.boxed, () => customizer.mini_sidebar, () => customizer.actTheme], 
  ([newBoxed, newMiniSidebar, newActTheme]) => {
    const userSettings = {
      boxed: newBoxed,
      mini_sidebar: newMiniSidebar,
      actTheme: newActTheme,
    };
    localStorage.setItem('userSettings', JSON.stringify(userSettings));
  }
);
</script>

<!------------------------------------->
<!-- Customizer -->
<!------------------------------------->
<template>
    <div class="pa-6">
        <h5 class="text-h5">Settings</h5>
    </div>
    <v-divider></v-divider>
    <perfect-scrollbar style="height: calc(100vh - 90px)">
        <div class="pa-6">
            <h6 class="text-h6 mb-5">Theme Color</h6>
            <v-item-group mandatory v-model="customizer.actTheme" class="ml-n2 v-row">
                <v-col cols="4" v-for="theme in themeColors" :key="theme.name" class="pa-2">
                    <v-item v-slot="{ isSelected, toggle }" :value="theme.name">
                        <v-sheet
                            rounded="xl"
                            class="border cursor-pointer d-block text-center px-5 py-4 hover-btns"
                            elevation="10"
                            @click="toggle"
                        >
                            <v-avatar :class="theme.bg" size="25">
                                <CheckIcon color="white" size="18" v-if="isSelected" />
                            </v-avatar>
                        </v-sheet>
                    </v-item>
                </v-col>
            </v-item-group>
            <h6 class="text-h6 mt-11 mb-2">Container Option</h6>
            <v-btn-toggle v-model="customizer.boxed" color="primary" class="my-2 btn-group-custom gap-3" rounded="0" group>
                <v-btn :value="true" variant="text" elevation="10" class="rounded-xl">
                    <Icons :icon="'cardholder-linear'" :size="22" class="mr-2" />
                    Boxed
                </v-btn>
                <v-btn :value="false" variant="text" elevation="10" class="rounded-xl">
                    <Icons :icon="'scanner-linear'" :size="22" class="mr-2" />
                    Full
                </v-btn>
            </v-btn-toggle>
            <!---Horizontal demo hide this option --->
            <v-sheet v-if="customizer.setHorizontalLayout != true">
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
            </v-sheet>
        </div>
    </perfect-scrollbar>
</template>

<style lang="scss"></style>
