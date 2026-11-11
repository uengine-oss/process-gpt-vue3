<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCustomizerStore } from '@/stores/customizer';
import { CheckIcon } from 'vue-tabler-icons';
import { applyAppearance, appearanceFromTheme, THEME_BY_APPEARANCE, type Appearance } from '@/ds/appearance';
import { isPhoneBrowser, viewportApi, savedMobileView, saveMobileView, phoneWebUrl } from '@/shared/mobileView';
import { webAppInstall } from '@/utils/webAppInstall';
import AddToHomeScreen from '@/components/mobile/AddToHomeScreen.vue';

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

/**
 * 휴대폰 화면 — 휴대폰 브라우저에서만 보인다(이 기기에 저장되고, 폭은 index.html 이 정한다).
 * 고르지 않았으면 기본인 데스크톱 화면으로 보인다. 라이트를 고르면 휴대폰 웹(/m/)으로 간다.
 */
const showMobileView = isPhoneBrowser() && !!viewportApi()?.isEnabled?.();
const mobileView = ref<'desktop' | 'light'>(savedMobileView() ?? 'desktop');

function selectMobileView(view: 'desktop' | 'light') {
    mobileView.value = view;
    const { reload } = saveMobileView(view);
    // 라이트는 휴대폰 웹으로 간다 — 계정 설정은 휴대폰에서도 포털에 남는 화면이라 새로 열기만 하면 그대로다.
    const phoneWeb = view === 'light' ? phoneWebUrl('/todolist') : null;
    if (phoneWeb) window.location.assign(phoneWeb);
    else if (reload) window.location.reload();
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

            <v-divider class="my-6"></v-divider>

            <h6 class="text-h6 mb-1">화면 간소화</h6>
            <p class="text-body-2 text-medium-emphasis mb-3">
                정의 체계도와 인스턴스 화면을 목록 · 대화 · 산출물 세 칸으로만 보여 줍니다.
                칸반 · 간트 · 진행도 같은 화면은 숨고, 필요할 때 버튼으로 엽니다.
            </p>
            <v-switch
                :model-value="customizer.simpleUi"
                color="primary"
                density="comfortable"
                hide-details
                :label="customizer.simpleUi ? '켜짐' : '꺼짐'"
                @update:model-value="(v) => customizer.SET_SIMPLE_UI(!!v)"
            ></v-switch>

            <template v-if="showMobileView">
                <v-divider class="my-6"></v-divider>

                <h6 class="text-h6 mb-1">{{ $t('mobileView.settingTitle') }}</h6>
                <p class="text-body-2 text-medium-emphasis mb-3">{{ $t('mobileView.settingDesc') }}</p>
                <v-radio-group
                    :model-value="mobileView"
                    hide-details
                    data-testid="mobile-view-setting"
                    @update:model-value="(v) => selectMobileView(v as 'desktop' | 'light')"
                >
                    <v-radio value="desktop" :label="$t('mobileView.desktopOption')" color="primary" />
                    <v-radio value="light" :label="$t('mobileView.lightOption')" color="primary" />
                </v-radio-group>
            </template>

            <template v-if="webAppInstall.enabled && !webAppInstall.installed">
                <v-divider class="my-6"></v-divider>

                <h6 class="text-h6 mb-1">{{ $t('mobileView.addToHome') }}</h6>
                <p class="text-body-2 text-medium-emphasis mb-3">{{ $t('mobileView.addToHomeHint') }}</p>
                <AddToHomeScreen variant="outlined" />
            </template>
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
