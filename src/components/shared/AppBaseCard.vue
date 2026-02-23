<script setup lang="ts">
import { ref, computed, getCurrentInstance, watch, onMounted, onUnmounted, inject } from 'vue';
import { useDisplay } from 'vuetify';
import { useRoute } from 'vue-router';

const props = defineProps({
    isInstanceChat: {
        type: Boolean,
        default: false
    },
    customMenuName: {
        type: String,
        default: ''
    }
});

const { lgAndUp } = useDisplay();
const sDrawer = ref(false);
const route = useRoute();

// 화면 너비가 1279px 이하인지 여부를 추적하는 반응형 참조
const isWidthUnder1279 = ref(window.innerWidth <= 1279);
// 모바일 여부 (768px 이하)를 추적하는 반응형 참조
const isMobile = ref(window.innerWidth <= 768);

// 화면 크기 변경 이벤트 핸들러
function handleResize() {
    isWidthUnder1279.value = window.innerWidth <= 1279;
    isMobile.value = window.innerWidth <= 768;
}

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

// 컴포넌트가 언마운트될 때 이벤트 리스너 제거
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});


// 현재 인스턴스를 가져옵니다.
const instance = getCurrentInstance();

// 인스턴스의 context를 통해 전역 속성에 접근합니다.
const globalState = instance?.appContext.config.globalProperties.$globalState;
const { proxy } = getCurrentInstance();

const chatReSizeDisplay = computed(() => {
    // globalState를 사용하여 계산된 속성을 정의합니다.
    // 이 클래스는 mainbox가 아닌 right-part에만 적용해야 함
    return globalState?.state.isZoomed ? 'chat-display-none' : 'chat-display-block';
});

// 채팅창(right-part) 숨김 여부 (isChatHidden 또는 isZoomed 둘 다 지원)
const isChatHidden = computed(() => {
    return globalState?.state.isChatHidden || globalState?.state.isZoomed || false;
});
const canvasReSize = computed(() => {
    // globalState의 isZoomed 또는 isChatHidden 상태에 따라 width 스타일 속성을 반환합니다.
    if(globalState?.state.isZoomed || globalState?.state.isChatHidden) {
        return 'width: 100%;';
    } else if (globalState?.state.isRightZoomed) {
        return 'display:none';
    }
    return ""
});
// 조건에 따라 슬롯 이름을 결정하는 계산된 속성
const slotName = computed(() => {
    const path = route.path;
    // 1279px 이하일 때 특정 경로에서는 leftpart를 right-part에 표시
    if (isWidthUnder1279.value && (
        path === '/definition-map' || 
        /^\/definitions\//.test(path) || 
        /^\/dmn\//.test(path)
    )) {
        return 'leftpart';
    }
    else {
        return 'rightpart';
    }
});

// drawer를 닫는 함수
const closeDrawer = () => {
    sDrawer.value = false;
};

// close-drawer 이벤트 핸들러
const handleCloseDrawer = () => {
    closeDrawer();
};

// 경로별 메뉴 이름을 결정하는 계산된 속성
const menuName = computed(() => {
    // customMenuName이 있으면 우선 사용
    if (props.customMenuName) {
        return props.customMenuName;
    }
    
    const path = route.path;
    if (path === '/chats') {
        return proxy.$t('AppBaseCard.friends');
    } else if (path === '/definition-map') {
        return proxy.$t('AppBaseCard.progress');
    } else if (path.startsWith('/agent-chat')) {
        return proxy.$t('AppBaseCard.agentManagement');
    }
    return proxy.$t('AppBaseCard.menu');
});

// 높이 클래스를 결정하는 계산된 속성
const heightClass = computed(() => {
    const path = route.path;
    const isTargetPath = path === '/' || path.includes('instancelist');
    
    if (isTargetPath) {
        return isMobile.value ? 'app-base-card-is-mobile-height' : 'app-base-card-is-pc-height';
    }
    return '';
});

// 메뉴 버튼 스타일을 결정하는 계산된 속성
const menuButtonStyle = computed(() => {
    const path = route.path;
    const isTargetPath = path === '/' || path.includes('instancelist');
    const shouldHideForMobile = isTargetPath && isMobile.value;
    
    if (globalState?.state.isRightZoomed || shouldHideForMobile) {
        return 'display:none;';
    }
    return '';
});
</script>

<template>
    <!---/Left chat list -->
    <div class="d-flex mainbox is-work-height" :class="[heightClass]"
        :style="!$globalState.state.isRightZoomed ? '' : 'height:100vh;'"
        style="overflow: auto;"
    >
        <div class="left-part" v-if="lgAndUp && !props.isInstanceChat" :style="canvasReSize">
            <!-- <perfect-scrollbar style="height: calc(100vh - 290px)"> -->
            <slot name="leftpart"></slot>
            <!-- </perfect-scrollbar> -->
        </div>

        <!---right chat conversation -->
        <div class="right-part" :class="{ 'chat-hidden': isChatHidden }">
            <!---Toggle Button For mobile-->
            <v-tooltip location="right">
                <template v-slot:activator="{ props: tooltipProps }">
                    <v-btn
                        icon
                        size="x-small"
                        @click="sDrawer = !sDrawer"
                        variant="text"
                        class="mobile-menu-toggle-btn d-lg-none"
                        v-bind="tooltipProps"
                    >
                        <Icons :icon="'list-bold-duotone'"
                            :size="16"
                            :color="'#ffffff'"
                            :style="menuButtonStyle"
                        />
                    </v-btn>
                </template>
                <span>{{ menuName }}</span>
            </v-tooltip>
            <slot :name="slotName"></slot>
        </div>

        <!---right chat conversation -->
    </div>

    <v-navigation-drawer temporary v-model="sDrawer" top v-if="!lgAndUp"
        class="mobile-menu-nav"
    >
        <v-card-text class="pa-0 mobile-left-menu">
            <slot 
                :name="route.path === '/definition-map' ? 'rightpart' : 'mobileLeftContent'" 
                :closeDrawer="handleCloseDrawer"
            ></slot>
        </v-card-text>
    </v-navigation-drawer>
</template>

<style lang="scss">
.left-part {
    width: 320px;
    border-right: 1px solid rgb(var(--v-theme-borderColor));
    // min-height: 500px;
    transition: 0.1s ease-in;
    flex-shrink: 0;
    overflow: auto;
    background-color: white;
}

.v-theme--light {
    .left-part {
        background: white;
    }
}

.v-theme--dark {
    .left-part {
        background: #2b2b2b;
    }
}

.right-part {
    width: 100%;
    overflow: auto;
    background: white;
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    transition: all 0.2s ease;
}

.right-part.chat-hidden {
    display: none;
}

.mobile-menu-toggle-btn {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 100;
    background-color: rgb(var(--v-theme-primary)) !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    opacity: 0.5;
    transition: opacity 0.2s ease;

    &:hover {
        opacity: 1;
    }
}

.left-part {
    // width: 80%;
    // min-height: 500px;
    position: relative;
    overflow: auto;
}
</style>
