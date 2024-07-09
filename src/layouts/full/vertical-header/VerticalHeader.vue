<script setup lang="ts">
import { ref, watch, computed, onBeforeMount } from 'vue';
import { useCustomizerStore } from '../../../stores/customizer';
import { useEcomStore } from '@/stores/apps/eCommerce';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import LanguageDD from './LanguageDD.vue';
import NotificationDD from './NotificationDD.vue';
import MessagesDD from './MessagesDD.vue';
import ProfileDD from './ProfileDD.vue';
import Searchbar from './Searchbar.vue';
import RightMobileSidebar from './RightMobileSidebar.vue';
import Logo from '../logo/Logo.vue';

const customizer = useCustomizerStore();
const showSearch = ref(false);
const appsdrawer = ref(false);
const priority = ref(customizer.setHorizontalLayout ? 0 : 0);
const router = useRouter();
const stickyHeader = ref(false);

interface SidebarItem {
    title: string;
    icon: string;
    to: string;
    disable: boolean;
}

const sidebarItems = ref<SidebarItem[]>([
    {
        title: 'headerMenu.dashboard',
        icon: 'lucide:layout-panel-top',
        to: '/dashboard2',
        disable: false
    },
    {
        title: 'chats.title',
        icon: 'solar:chat-round-unread-line-duotone',
        to: '/chats',
        disable: false
    },
    {
        title: 'headerMenu.todoList',
        icon: 'pajamas:overview',
        to: '/todolist',
        disable: false
    },
    {
        title: 'headerMenu.calendar',
        icon: 'solar:calendar-line-duotone',
        to: '/calendar',
        disable: false
    }
]);

// 생명주기 훅 사용
onBeforeMount(() => {
    // window.mode 값에 따라 sidebarItems 수정
    if (window.$mode === 'ProcessGPT') {
        sidebarItems.value = sidebarItems.value.filter(item => item.to !== '/calendar');
    }
    window.addEventListener('scroll', handleScroll);
});


// 우선 순위 변경 감시
watch(priority, (newPriority) => {
    priority.value = newPriority;
});

// 스토어에서 장바구니 데이터 가져오기
const store = useEcomStore();
const getCart = computed(() => {
    return store.cart;
});

// 스크롤 핸들러
function handleScroll() {
    if (window.pageYOffset) {
        stickyHeader.value = true;
    } else {
        stickyHeader.value = false;
    }
}

// 검색 상자 토글
function searchbox() {
    showSearch.value = !showSearch.value;
}

// 네비게이션 함수
function navigateTo(item: SidebarItem) {
    if (!item.disable) {
        router.push(item.to);
    }
}
</script>


<template>
    <div class="container">
        <div class="maxWidth">
            <v-app-bar elevation="0" :priority="priority" height="75"  id="top" :class="stickyHeader ? 'sticky' : ''">
                <v-row class="ma-0 pa-0">
                    <v-btn class="hidden-lg-and-up" icon
                        @click.stop="customizer.SET_SIDEBAR_DRAWER"
                    >
                        <Icon icon="solar:list-bold-duotone" height="24" width="24" />
                    </v-btn>
                    <v-tooltip :text="$t('headerMenu.sidebar')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" class="hidden-md-and-down" icon
                                @click.stop="customizer.SET_MINI_SIDEBAR(!customizer.mini_sidebar)">
                                <Icon icon="solar:list-bold-duotone" height="24" width="24" />
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <template v-for="item in sidebarItems" :key="item.title">
                        <v-tooltip :text="$t(item.title)">
                            <template v-slot:activator="{ props }">
                                <v-btn icon v-bind="props" @click="navigateTo(item)">
                                    <Icon :icon="item.icon" height="24" width="24" />
                                </v-btn>
                            </template>
                        </v-tooltip>
                    </template>
                    <v-tooltip :text="$t('headerMenu.layoutSetting')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" class="customizer-btn" icon
                                @click.stop="customizer.SET_CUSTOMIZER_DRAWER(!customizer.Customizer_drawer)">
                                <SettingsIcon />
                            </v-btn>
                        </template>
                    </v-tooltip>
                </v-row>

                <!-- ---------------------------------------------- -->
                <!-- Search part --> <!-- ---------------------------------------------- -->
                


                <!---/Search part -->
                <v-spacer class="hidden-sm-and-down" />

                <div class="hidden-md-and-up header-logo">
                    <Logo />
                </div>

                <!-- ---------------------------------------------- -->
                <!---right part -->
                <!-- ---------------------------------------------- -->
                <!-- ---------------------------------------------- -->
                <!-- translate -->
                <!-- ---------------------------------------------- -->
                <div class="hidden-sm-and-down mr-sm-6 mr-4">
                    <Searchbar />
                </div>
                <!-- <div class="hidden-sm-and-down mr-sm-6 mr-4">
                    <LanguageDD />
                </div> -->

                <!-- ---------------------------------------------- -->
                <!-- ShoppingCart -->
                <!-- ---------------------------------------------- -->
                <!-- <div class="hidden-sm-and-down mr-sm-6 mr-4">
                    <v-btn icon variant="text" to="/ecommerce/checkout" size="small">
                        <v-badge color="primary" :content="getCart?.length" offset-x="-4" offset-y="-6">
                            <Icon icon="solar:cart-3-line-duotone" height="24" width="24" />
                        </v-badge>
                    </v-btn>
                </div> -->
                <!-- ---------------------------------------------- -->
                <!-- Notification -->
                <!-- ---------------------------------------------- -->
                <div class="hidden-sm-and-down mr-sm-6 mr-4">
                    <NotificationDD />
                </div>
                <!-- ---------------------------------------------- -->
                <!-- User Profile -->
                <!-- ---------------------------------------------- -->
                <div class="hidden-sm-and-down">
                    <ProfileDD />
                </div>

                <!-----Mobile header------>
                <!-- <v-menu :close-on-content-click="false" class="mobile_popup ">
                    <template v-slot:activator="{ props }">
                        <v-btn icon class="hidden-md-and-up" flat v-bind="props" size="small">
                            <DotsIcon stroke-width="2" size="24" class="text-primary" />
                        </v-btn>
                    </template>
                    <v-sheet rounded="lg" elevation="10" class="mt-5 dropdown-box px-4 py-6">
                        <div class="d-flex justify-space-between align-center">
                            <div class="mr-sm-3 mr-2">
                                <Searchbar />
                            </div>
                            <LanguageDD />
                            <v-btn icon variant="text" class="mr-sm-3 mr-2" to="/ecommerce/checkout"
                                size="small">
                                <v-badge color="primary" :content="getCart?.length" offset-x="-4" offset-y="-6">
                                    <Icon icon="solar:cart-3-line-duotone" height="24" width="24" />
                                </v-badge>
                            </v-btn>
                            <MessagesDD />
                            <NotificationDD />
                            <ProfileDD />
                        </div>
                    </v-sheet>
                </v-menu> -->
            </v-app-bar>
        </div>
    </div>
</template>
<style scoped>
@media only screen and (max-width:600px) {  
    .header-logo {
        display: none;
    }   
}
</style>