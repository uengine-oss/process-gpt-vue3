<script setup lang="ts">
import { ref, watch, computed,onBeforeMount  } from 'vue';
import { useCustomizerStore } from '../../../stores/customizer';
import { useEcomStore } from '@/stores/apps/eCommerce';
import { ShoppingCartIcon, AlignLeftIcon, DotsIcon } from 'vue-tabler-icons';
import LanguageDD from './LanguageDD.vue';
import NotificationDD from './NotificationDD.vue';
import MessagesDD from './MessagesDD.vue';
import ProfileDD from './ProfileDD.vue';
import Searchbar from './Searchbar.vue';
import RightMobileSidebar from './RightMobileSidebar.vue';
import Logo from '../logo/Logo.vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';

const customizer = useCustomizerStore();
const showSearch = ref(false);
const appsdrawer = ref(false);
const priority = ref(customizer.setHorizontalLayout ? 0 : 0);
const router = useRouter();

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

function searchbox() {
    showSearch.value = !showSearch.value;
}

watch(priority, (newPriority) => {
    priority.value = newPriority;
});

const store = useEcomStore();
const getCart = computed(() => {
    return store.cart;
});

onBeforeMount(() => {
  window.addEventListener('scroll', handleScroll)
});

const stickyHeader = ref(false);

function handleScroll() {
  if (window.pageYOffset) {
    stickyHeader.value = true;
  } else {
    stickyHeader.value = false;
  }
}

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
                <v-tooltip :text="$t('headerMenu.sidebar')">
                    <template v-slot:activator="{ props }">
                        <v-btn v-bind="props" class="hidden-md-and-down" icon variant="text" size="small"
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
                        <v-btn v-bind="props" class="customizer-btn" size="small" icon variant="flat"
                            @click.stop="customizer.SET_CUSTOMIZER_DRAWER(!customizer.Customizer_drawer)">
                            <SettingsIcon />
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-btn class="hidden-lg-and-up" icon variant="text"
                    @click.stop="customizer.SET_SIDEBAR_DRAWER" size="small">
                    <Icon class="cp-menu-open" icon="solar:list-bold-duotone" height="24" width="24" />
                </v-btn>

                <!-- ---------------------------------------------- -->
                <!-- Search part --> <!-- ---------------------------------------------- -->
                


                <!---/Search part -->
                <v-spacer class="hidden-sm-and-down" />

                <div class="hidden-md-and-up">
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
                <v-menu :close-on-content-click="false" class="mobile_popup ">
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
                            <!-- <LanguageDD /> -->
                            <!-- <v-btn icon variant="text" class="mr-sm-3 mr-2" to="/ecommerce/checkout"
                                size="small">
                                <v-badge color="primary" :content="getCart?.length" offset-x="-4" offset-y="-6">
                                    <Icon icon="solar:cart-3-line-duotone" height="24" width="24" />
                                </v-badge>
                            </v-btn> -->
                            <!-- <MessagesDD /> -->
                            <NotificationDD />
                            <ProfileDD />
                        </div>
                    </v-sheet>
                </v-menu>
            </v-app-bar>
        </div>
    </div>
</template>
