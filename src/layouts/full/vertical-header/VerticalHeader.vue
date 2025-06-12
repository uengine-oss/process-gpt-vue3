<script setup lang="ts">
import { ref, watch, computed, onBeforeMount, onMounted, onBeforeUnmount } from 'vue';
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
    isMobile?: boolean;
    isVisible?: boolean;
}

const isAdmin = localStorage.getItem('isAdmin') === 'true';

const sidebarItems = ref<SidebarItem[]>([
    {
        title: 'processDefinitionMap.title',
        icon: 'write',
        to: '/definition-map',
        disable: false,
        isMobile: false,
        isVisible: true
    },
    {
        title: 'chats.title',
        icon: 'chat-round-unread-line-duotone',
        to: '/chats',
        disable: false,
        isVisible: window.$mode === 'ProcessGPT' && !window.$pal
    },
    {
        title: 'headerMenu.todoList',
        icon: 'overview',
        to: '/todolist',
        disable: false,
        isVisible: true
    },
    {
        title: 'headerMenu.admin',
        icon: 'user-admin',
        to: '/admin',
        disable: false,
        isVisible: isAdmin // Only visible if isAdmin is true
    },
    // {
    //     title: 'headerMenu.calendar',
    //     icon: 'calendar-line-duotone',
    //     to: '/calendar',
    //     disable: false,
    //     isVisible: window.$mode === 'ProcessGPT' && !window.$pal
    // }
]);

// 생명주기 훅 사용
onBeforeMount(() => {
    if (window.$mode === 'ProcessGPT') {
        sidebarItems.value = sidebarItems.value.filter(item => item.to !== '/admin');
    }
    window.addEventListener('scroll', handleScroll);
});

onMounted(() => {
    const handleResize = () => {
        const width = window.innerWidth;
        sidebarItems.value.forEach(item => {
            if (item.isMobile !== undefined) {
                item.isMobile = width > 1280;
            }
        });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // 초기 호출

    // Clean up event listener on component unmount
    onBeforeUnmount(() => {
        window.removeEventListener('resize', handleResize);
    });
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
                        <Icons :icon="'list-bold-duotone'"/>
                    </v-btn>
                    <v-tooltip :text="$t('headerMenu.sidebar')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" class="hidden-md-and-down" icon
                                @click.stop="customizer.SET_MINI_SIDEBAR(!customizer.mini_sidebar)">
                                <Icons :icon="'list-bold-duotone'"/>
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <template v-for="item in sidebarItems" :key="item.title">
                        <v-tooltip v-if="!item.isMobile && item.isVisible" :text="$t(item.title)">
                            <template v-slot:activator="{ props }">
                                <v-btn icon v-bind="props" @click="navigateTo(item)">
                                    <Icons :icon="item.icon"/>
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

                <!---/Search part -->
                <v-spacer class="hidden-sm-and-down" />

                <div class="hidden-md-and-up header-logo">
                    <Logo />
                </div>
                <div class="hidden-sm-and-down mr-sm-6 mr-4">
                    <Searchbar />
                </div>
                <div class="hidden-sm-and-down mr-sm-6 mr-4">
                    <NotificationDD />
                </div>
                <div class="hidden-sm-and-down">
                    <ProfileDD />
                </div>
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