<script setup lang="ts">
import { ref, computed, getCurrentInstance, watch, onMounted, onUnmounted } from 'vue';
import { useDisplay } from 'vuetify';
import { useRoute } from 'vue-router';

const { lgAndUp } = useDisplay();
const sDrawer = ref(false);
const route = useRoute();

// 화면 너비가 1279px 이하인지 여부를 추적하는 반응형 참조
const isWidthUnder1279 = ref(window.innerWidth <= 1279);

// 화면 크기 변경 이벤트 핸들러
function handleResize() {
  isWidthUnder1279.value = window.innerWidth <= 1279;
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

const chatReSizeDisplay = computed(() => {
    // globalState를 사용하여 계산된 속성을 정의합니다.
    return globalState?.state.isZoomed ? 'chat-display-none' : 'chat-display-block';
});
const canvasReSize = computed(() => {
    // globalState의 isZoomed 상태에 따라 width 스타일 속성을 반환합니다.
    if(globalState?.state.isZoomed) {
        return 'width: 100%;';
    } else if (globalState?.state.isRightZoomed) {
        return 'display:none';
    }
    return ""
});
// 조건에 따라 슬롯 이름을 결정하는 계산된 속성
const slotName = computed(() => {
    // 화면 너비 조건도 포함
    if (route.path === '/definitions/chat' && isWidthUnder1279.value) {
        return 'leftpart';
    } else {
        return 'rightpart';
    }
});
</script>

<template>
    <!---/Left chat list -->
    <div class="d-flex mainbox" :class="chatReSizeDisplay" :style="!$globalState.state.isRightZoomed ? 'height:calc(100vh - 155px)' : 'height:100vh;'">
        <div class="left-part" v-if="lgAndUp" :style="canvasReSize">
            <!-- <perfect-scrollbar style="height: calc(100vh - 290px)"> -->
            <slot name="leftpart"></slot>
            <!-- </perfect-scrollbar> -->
        </div>

        <!---right chat conversation -->
        <div class="right-part">
            <!---Toggle Button For mobile-->
            <v-btn block @click="sDrawer = !sDrawer" variant="text" class="d-lg-none d-md-flex d-sm-flex"
                style="z-index:1; background-color:white;"
                :style="!$globalState.state.isRightZoomed ? '' : 'display:none;'"    
            >
                <Menu2Icon size="20" class="mr-2 cp-dialog-open" /> Menu
            </v-btn>
            <v-divider class="d-lg-none d-block" />
            <slot :name="slotName"></slot>
        </div>

        <!---right chat conversation -->
    </div>

    <v-navigation-drawer temporary v-model="sDrawer" width="320" top v-if="!lgAndUp" style="top:123px;">
        <v-card-text class="pa-0">
            <slot name="mobileLeftContent"></slot>
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
}

.left-part {
    // width: 80%;
    // min-height: 500px;
    position: relative;
    overflow: auto;
}
</style>
