<script setup lang="ts">
import { ref, computed, getCurrentInstance } from 'vue';
import { useDisplay } from 'vuetify';

const { lgAndUp } = useDisplay();
const sDrawer = ref(false);

// 현재 인스턴스를 가져옵니다.
const instance = getCurrentInstance();

// 인스턴스의 context를 통해 전역 속성에 접근합니다.
const globalState = instance?.appContext.config.globalProperties.$globalState;

const canvasReSize = computed(() => {
    // globalState를 사용하여 계산된 속성을 정의합니다.
    return globalState?.state.isZoomed ? 'left-part-display-none' : 'left-part-display-block';
});
</script>

<template>
    <!---/Left chat list -->
    <div class="d-flex mainbox" :class="canvasReSize">
        <div class="left-part" v-if="lgAndUp" :class="canvasReSize">
            <!-- <perfect-scrollbar style="height: calc(100vh - 290px)"> -->
            <slot name="leftpart"></slot>
            <!-- </perfect-scrollbar> -->
        </div>

        <!---right chat conversation -->
        <div class="right-part">
            <!---Toggle Button For mobile-->
            <v-btn block @click="sDrawer = !sDrawer" variant="text" class="d-lg-none d-md-flex d-sm-flex"
                style="z-index:1; background-color:white;">
                <Menu2Icon size="20" class="mr-2 cp-dialog-open" /> Menu
            </v-btn>
            <v-divider class="d-lg-none d-block" />
            <slot name="rightpart"></slot>
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

.left-part {
    width: 80%;
    // min-height: 500px;
    position: relative;
    overflow: auto;
}
</style>
