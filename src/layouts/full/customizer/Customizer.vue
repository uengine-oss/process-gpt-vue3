<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCustomizerStore } from '@/stores/customizer';
import { CheckIcon } from 'vue-tabler-icons';
import { applyAppearance, getAppearance, THEME_BY_APPEARANCE, type Appearance } from '@/ds/appearance';
import { isPhoneBrowser, viewportApi, savedMobileView, saveMobileView, phoneWebUrl, liteAvailable } from '@/shared/mobileView';
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

// 지금 화면에 적용된 테마가 기준이다(저장 칸 pg-appearance — 부팅 때 ds/appearance 가 복원한다).
const active = ref<Appearance>(getAppearance());

function select(appearance: Appearance) {
    active.value = appearance;
    // 토큰 레이어 · Vuetify 테마 · BPMN 캔버스가 함께 전환된다
    applyAppearance(appearance);
    // applyAppearance 는 Vuetify 테마를 한 박자 늦게 맞춘다(지연 로드). 여기서 바로 맞춰야 아래 저장에 새 테마가 들어간다 —
    // 옛 테마가 저장되면 다음에 이 화면을 열 때 사이드바 · 상단바만 옛 색으로 돌아간다.
    customizer.actTheme = THEME_BY_APPEARANCE[appearance];
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
 * 고르지 않았으면 기본인 데스크톱 버전으로 보인다. 모바일 버전은 휴대폰 웹(/m/)으로, 라이트 모드는
 * Process GPT Lite(/lite/)로 간다.
 */
type MobileView = 'desktop' | 'mobile' | 'lite';
const showMobileView = isPhoneBrowser() && !!viewportApi()?.isEnabled?.();
const mobileView = ref<MobileView>((savedMobileView() as MobileView | null) ?? 'desktop');
const liteMissing = ref(false);

async function selectMobileView(view: MobileView) {
    liteMissing.value = false;
    const previous = mobileView.value;
    mobileView.value = view;
    // Lite 가 없는 설치에서 라이트 모드를 고르면 열 화면이 없다 — 저장하지 않고 알리고, 고른 표시도 되돌린다.
    if (view === 'lite' && !(await liteAvailable())) {
        mobileView.value = previous;
        liteMissing.value = true;
        return;
    }
    const { reload } = saveMobileView(view);
    // 모바일 버전 · 라이트 모드는 그 화면으로 간다 — 계정 설정은 휴대폰에서도 포털에 남는 화면이라 새로 열기만 하면 그대로다.
    const moveTo = view === 'desktop' ? null : phoneWebUrl('/todolist');
    if (moveTo) window.location.assign(moveTo);
    else if (reload) window.location.reload();
}

onMounted(() => {
    const saved = JSON.parse(localStorage.getItem('userSettings') ?? '{}');
    customizer.boxed = false;
    customizer.mini_sidebar = saved.mini_sidebar ?? false;
    // Vuetify 테마는 저장해 둔 이름(userSettings.actTheme)이 아니라 지금 적용된 테마에서 정한다.
    // 그 이름은 휴대폰 웹(/m/)에서 테마를 바꾸면 따라오지 않아, 그대로 덮으면 본문은 다크인데
    // 사이드바 · 상단바만 흰색으로 남는다.
    customizer.actTheme = THEME_BY_APPEARANCE[active.value];
    if (saved.actTheme !== customizer.actTheme) saveSettings();
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
                    @update:model-value="(v) => selectMobileView(v as MobileView)"
                >
                    <v-radio value="desktop" :label="$t('mobileView.desktopOption')" color="primary" />
                    <v-radio value="mobile" :label="$t('mobileView.mobileOption')" color="primary" />
                    <v-radio value="lite" :label="$t('mobileView.liteOption')" color="primary" />
                </v-radio-group>
                <p v-if="liteMissing" class="text-body-2 text-error mt-2" data-testid="mobile-view-lite-missing" role="alert">
                    {{ $t('mobileView.liteMissing') }}
                </p>
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
