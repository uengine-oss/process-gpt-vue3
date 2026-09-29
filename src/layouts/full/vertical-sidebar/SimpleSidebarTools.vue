<template>
    <div class="pg-sidetools" :class="`pg-sidetools--${row}`">
        <!--
            이동 메뉴. 상단바에 있던 아이콘 줄이지만, 여섯 개를 늘어놓으면
            사이드바가 아이콘 밭이 된다. 하나로 접고 누를 때만 편다 —
            글자가 함께 나오므로 아이콘만 보던 때보다 오히려 알아보기 쉽다.
        -->
        <v-menu v-if="row === 'nav'" location="bottom start">
            <template #activator="{ props }">
                <v-btn v-bind="props" icon variant="text" density="comfortable" class="text-medium-emphasis" aria-label="메뉴">
                    <v-icon size="20">mdi-dots-horizontal</v-icon>
                </v-btn>
            </template>
            <v-list density="compact" min-width="190">
                <v-list-item v-for="item in navItems" :key="item.to" :active="isOn(item)" :title="item.label" @click="go(item)">
                    <template #prepend><Icons :icon="item.icon" class="pg-sidetools__navicon" /></template>
                </v-list-item>
            </v-list>
        </v-menu>

        <!--
            검색. 사이드바 맨 위에 둔다.
            이건 대화 검색이 아니라 프로세스·정의를 통째로 찾는 자리라,
            대화목록 옆의 돋보기와 섞으면 둘 다 무엇을 찾는 것인지 흐려진다.
            자주 쓰지는 않지만 찾을 수는 있어야 하므로 접지 않고 아이콘으로 남긴다.
        -->
        <div v-else-if="row === 'search'" class="pg-sidetools__search">
            <Searchbar />
        </div>

        <!--
            휴대폰 간소화 화면. 클로드 모바일 사이드바처럼 글자를 붙인 줄로 늘어놓는다 —
            좁은 폭에서 아이콘만 두면 무엇인지 알 수 없고, '⋯' 로 접어 두면 한 번 더 눌러야 한다.
            자주 가는 곳(새 채팅 · 할 일)만 펴 두고 나머지는 '더보기' 로 접는다.
        -->
        <div v-else-if="row === 'phone'" class="pg-sidetools__phone" data-testid="mobile-sidebar-nav">
            <div class="pg-sidetools__phone-search">
                <Searchbar />
            </div>
            <!-- '새 채팅' 은 늘 새로 시작하는 줄이라 지금 화면 표시를 하지 않는다(클로드도 같다). -->
            <button type="button" class="pg-m-row" @click="go(newChatItem)">
                <span class="pg-m-row__icon pg-m-row__icon--plus"><v-icon size="16">mdi-plus</v-icon></span>
                <span class="pg-m-row__label">새 채팅</span>
            </button>
            <button type="button" class="pg-m-row" :class="{ 'pg-m-row--on': isOn(todoItem) }" @click="go(todoItem)">
                <span class="pg-m-row__icon"><Icons icon="overview" :size="18" /></span>
                <span class="pg-m-row__label">{{ todoItem.label }}</span>
            </button>
            <template v-if="moreOpen">
                <button v-for="item in moreItems" :key="item.to" type="button" class="pg-m-row" :class="{ 'pg-m-row--on': isOn(item) }" @click="go(item)">
                    <span class="pg-m-row__icon"><Icons :icon="item.icon" :size="18" /></span>
                    <span class="pg-m-row__label">{{ item.label }}</span>
                </button>
            </template>
            <button type="button" class="pg-m-row pg-m-row--muted" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">
                <span class="pg-m-row__icon"><v-icon size="18">{{ moreOpen ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon></span>
                <span class="pg-m-row__label">{{ moreOpen ? '접기' : '더보기' }}</span>
            </button>
        </div>

        <!--
            계정. 클로드처럼 계정을 누르면 설정과 로그아웃이 나온다 —
            설정 톱니를 따로 띄워 둘 이유가 없다.
            알림은 상태를 알리는 것이라 접지 않고 옆에 남긴다.
        -->
        <div v-else class="pg-sidetools__account">
            <v-menu location="top start">
                <template #activator="{ props }">
                    <div class="pg-sidetools__me" v-bind="props">
                        <v-avatar size="34">
                            <v-img v-if="picture" :src="picture" />
                            <v-icon v-else size="20">mdi-account</v-icon>
                        </v-avatar>
                        <div class="pg-sidetools__me-text">
                            <div class="pg-sidetools__me-name">{{ name }}</div>
                            <div v-if="isAdmin" class="pg-sidetools__me-role">Admin</div>
                        </div>
                    </div>
                </template>
                <v-list density="compact" min-width="180">
                    <v-list-item :title="$t('headerMenu.setting')" @click="goSettings">
                        <template #prepend><v-icon size="18">mdi-cog-outline</v-icon></template>
                    </v-list-item>
                    <v-divider></v-divider>
                    <v-list-item :title="$t('ExtraBox.logOut')" @click="logout">
                        <template #prepend><v-icon size="18">mdi-logout-variant</v-icon></template>
                    </v-list-item>
                </v-list>
            </v-menu>

            <v-spacer></v-spacer>
            <!-- 휴대폰에서는 알림이 앱바에 있다. 두 군데 두지 않는다. -->
            <NotificationDD v-if="!phoneShell" />
        </div>
    </div>
</template>

<script>
/**
 * 간소화 화면의 사이드바 도구.
 *
 * 상단바를 걷어내면 갈 곳이 없어지는 단추들을 사이드바로 옮긴다.
 * 만들지 않고 옮긴다 — 검색과 알림은 상단바가 쓰던 컴포넌트를 그대로 가져온다.
 *
 * 세 자리로 나눠 쓴다
 *   nav     로고 줄의 '⋯' — 이동 메뉴
 *   search  로고 줄의 돋보기 — 전역 검색
 *   account 맨 아래 계정 줄 — 누르면 설정 · 로그아웃, 옆에 알림
 */
import Searchbar from '../vertical-header/Searchbar.vue';
import NotificationDD from '../vertical-header/NotificationDD.vue';
import { useAuthStore } from '@/stores/auth';
import { useCustomizerStore } from '@/stores/customizer';
import { usePhoneShell } from '@/shared/phoneShell';

export default {
    name: 'SimpleSidebarTools',
    components: { Searchbar, NotificationDD },
    props: {
        /** 'nav' | 'search' | 'account' */
        row: {
            type: String,
            default: 'nav'
        }
    },
    setup() {
        const { active: phoneShell } = usePhoneShell();
        return { customizer: useCustomizerStore(), phoneShell };
    },
    data: () => ({
        name: '',
        picture: '',
        moreOpen: false,
        authStore: useAuthStore()
    }),
    mounted() {
        try {
            this.name = localStorage.getItem('userName') || '';
            this.picture = localStorage.getItem('picture') || '';
        } catch (e) {
            /* 저장소를 막아 둔 환경 */
        }
    },
    computed: {
        isAdmin() {
            try {
                return localStorage.getItem('isAdmin') === 'true';
            } catch (e) {
                return false;
            }
        },
        isUEngine() {
            return window.$mode === 'uEngine';
        },
        navItems() {
            const items = [
                { to: '/definition-map', icon: 'write', label: this.$t('processDefinitionMap.title') },
                { to: '/todolist', icon: 'overview', label: this.$t('headerMenu.todoList') },
                { to: '/strategy-board', icon: 'strategy-map', label: this.$t('analytics.strategyBoard') }
            ];
            if (!this.isUEngine) {
                items.push({ to: '/knowledge', icon: 'folder-with-files', label: this.$t('headerMenu.knowledgeBase') });
            }
            items.push({ to: '/my-feedback', icon: 'chat-round-line-linear', label: this.$t('headerMenu.myFeedback') });
            items.push({ to: '/merge-requests', icon: 'branch', label: this.$t('headerMenu.mergeRequests') });
            if (this.isAdmin) {
                items.push({ to: '/admin', icon: 'user-admin', label: this.$t('headerMenu.admin') });
            }
            return items;
        },
        newChatItem() {
            return { to: '/definition-map', icon: 'write', label: '새 채팅' };
        },
        todoItem() {
            return this.navItems.find((i) => i.to === '/todolist');
        },
        /** '더보기' 안에 접어 둘 곳. 위에 펴 둔 두 줄은 뺀다. */
        moreItems() {
            return this.navItems.filter((i) => i.to !== '/definition-map' && i.to !== '/todolist');
        }
    },
    methods: {
        isOn(item) {
            const p = this.$route.path;
            return p === item.to || p.startsWith(item.to + '/');
        },
        go(item) {
            if (this.$route.path !== item.to) {
                this.$router.push(item.to);
            } else if (this.row === 'phone' && this.customizer.Sidebar_drawer) {
                // 이미 그 화면이면 경로가 바뀌지 않아 레이아웃이 닫지 않는다. 여기서 닫는다.
                this.customizer.SET_SIDEBAR_DRAWER();
            }
        },
        goSettings() {
            if (this.$route.path !== '/account-settings') this.$router.push('/account-settings');
        },
        logout() {
            this.authStore.logout();
        }
    }
};
</script>

<style scoped>
/*
 * 이동 메뉴의 아이콘.
 * Vuetify 는 prepend 자리에 제가 아는 아이콘·아바타일 때만 틈을 넣는다.
 * 여기는 직접 만든 Icons 라 틈이 없어 글자가 아이콘에 붙어 버렸다.
 */
.pg-sidetools__navicon {
    margin-right: 5px;
}

/*
 * 로고 줄의 돋보기.
 * 검색창은 상단바용이라 알약 안에 입력 칸을 펼쳐 놓고 있다. 사이드바 머리에는
 * 그만한 자리가 없으므로 알약을 아이콘 크기로 줄이고 입력 칸은 감춘다 —
 * 누르면 열리는 검색 상자는 그대로다.
 */
.pg-sidetools__search :deep(.header-search) {
    min-width: 36px;
    max-width: 36px;
    padding: 0 6px !important;
    border: none !important;
    cursor: pointer;
}

.pg-sidetools__search :deep(.header-search .v-text-field) {
    display: none;
}

.pg-sidetools__account {
    display: flex;
    align-items: center;
    gap: 6px;
}

.pg-sidetools__me {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 4px 6px;
    border-radius: 10px;
    cursor: pointer;
}

.pg-sidetools__me:hover {
    background: rgba(var(--v-theme-on-surface), 0.06);
}

.pg-sidetools__me-text {
    min-width: 0;
}

.pg-sidetools__me-name {
    font-size: 0.8125rem;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pg-sidetools__me-role {
    font-size: 0.6875rem;
    color: rgba(var(--v-theme-on-surface), 0.5);
    line-height: 1.2;
}
</style>
