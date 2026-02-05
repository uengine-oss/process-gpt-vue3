<template>
    <div class="user-list-container">
        <v-expand-transition>
            <div v-show="!isLoading && users.length > 0 && isSearchOpen" class="px-2 pb-2">
                <v-text-field
                    v-model="searchValue"
                    variant="solo-filled"
                    density="compact"
                    hide-details
                    clearable
                    prepend-inner-icon="mdi-magnify"
                    :placeholder="$t('userListing.search') || '유저 검색'"
                    ref="searchInput"
                />
            </div>
        </v-expand-transition>

        <div v-if="isLoading" class="loading-state">
            <v-progress-circular indeterminate size="24" color="primary"></v-progress-circular>
            <span class="ml-2 text-caption">{{ $t('UserList.loading') || '유저 목록을 불러오는 중...' }}</span>
        </div>

        <div v-else-if="filteredUsers.length === 0" class="empty-state">
            <v-icon size="32" color="grey-lighten-1">mdi-account-outline</v-icon>
            <span class="text-caption text-grey">
                {{
                    users.length === 0
                        ? ($t('UserList.empty') || '표시할 유저가 없습니다.')
                        : ((searchValue || '').trim()
                            ? '검색 > 검색결과 없음'
                            : ($t('userListing.search') || '검색'))
                }}
            </span>
        </div>

        <ExpandableList
            v-else
            :items="filteredUsers"
            :limit="5"
        >
            <template #items="{ displayedItems }">
                <div class="user-items">
                    <v-tooltip
                        v-for="user in displayedItems"
                        bottom
                        :key="user.id"
                        :text="user.username || user.email || 'User'"
                    >
                        <template v-slot:activator="{ props }">
                            <div
                                v-bind="props"
                                class="user-item"
                                @click="openUserConversation(user)"
                            >
                                <div class="user-avatar">
                                    <img
                                        v-if="user.profile"
                                        :src="user.profile"
                                        :alt="user.username"
                                        class="user-image"
                                        width="32"
                                        height="32"
                                        @error="handleImageError"
                                    />
                                    <div v-else class="user-fallback">
                                        <v-icon size="18" color="grey-darken-1">mdi-account</v-icon>
                                    </div>
                                </div>
                                <div class="user-info">
                                    <span class="user-name">{{ user.username || user.email || 'User' }}</span>
                                    <span v-if="user.email" class="user-email">{{ user.email }}</span>
                                </div>
                            </div>
                        </template>
                    </v-tooltip>
                </div>
            </template>
        </ExpandableList>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ExpandableList from '@/components/ui/ExpandableList.vue';

const backend = BackendFactory.createBackend();

export default {
    name: 'SidebarUserList',
    components: { ExpandableList },
    data() {
        return {
            isLoading: false,
            users: [],
            userInfo: null,
            searchValue: '',
            isSearchOpen: false
        };
    },
    async mounted() {
        this.userInfo = await backend.getUserInfo();
        await this.loadUsers();
    },
    computed: {
        filteredUsers() {
            const keyword = (this.searchValue || '').toLowerCase().trim();
            if (!keyword) return this.users;
            return this.users.filter((u) => {
                const name = (u?.username || '').toLowerCase();
                const email = (u?.email || '').toLowerCase();
                return name.includes(keyword) || email.includes(keyword);
            });
        }
    },
    methods: {
        toggleSearch() {
            this.isSearchOpen = !this.isSearchOpen;
            if (this.isSearchOpen) {
                this.$nextTick(() => {
                    try {
                        this.$refs.searchInput?.focus?.();
                    } catch (e) {}
                });
            } else {
                this.searchValue = '';
            }
        },
        async loadUsers() {
            this.isLoading = true;
            try {
                // options를 넘기면 defaultAgents가 합쳐지지 않음
                const list = await backend.getUserList({});
                const onlyUsers = Array.isArray(list) ? list : [];

                // 에이전트는 제외 (유저 목록은 별도)
                const meId = this.userInfo?.id || this.userInfo?.uid || null;
                const meEmail = this.userInfo?.email || null;

                const filtered = onlyUsers
                    .filter(u => !u?.is_agent)
                    .filter(u => {
                        if (!u) return false;
                        if (meId && u.id && u.id === meId) return false;
                        if (meEmail && u.email && u.email === meEmail) return false;
                        return true;
                    });

                // 이름순(없으면 email)
                filtered.sort((a, b) => {
                    const aName = (a?.username || a?.name || a?.email || '').toString().toLowerCase();
                    const bName = (b?.username || b?.name || b?.email || '').toString().toLowerCase();
                    return aName.localeCompare(bName, 'ko');
                });

                this.users = filtered.map(u => ({
                    id: u.id,
                    username: u.username || u.name,
                    email: u.email,
                    profile: u.profile
                }));
            } catch (e) {
                this.users = [];
            } finally {
                this.isLoading = false;
            }
        },

        async openUserConversation(user) {
            const id = user?.id || user?.uid || null;
            if (!id) return;
            // 에이전트 화면에서 넘어올 때 남아있는 hash(#chat) 제거
            try { if (window.location.hash) window.location.hash = ''; } catch (e) {}
            await this.$router.push({ path: '/chat', query: { userId: id }, hash: '' });
        },

        handleImageError(event) {
            event.target.style.display = 'none';
        }
    }
};
</script>

<style scoped>
.user-list-container {
    padding: 8px 0;
}

.loading-state,
.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 16px 8px;
    text-align: center;
    gap: 8px;
}

.empty-state {
    color: #666;
}

.user-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.user-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    gap: 12px;
}

.user-item:hover {
    background-color: #e3f2fd;
    transform: translateX(2px);
}

.user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.user-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.user-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
}

.user-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
}

.user-name {
    font-size: 14px;
    font-weight: 500;
    color: #2d3436;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.user-email {
    font-size: 10px;
    color: #636e72;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
}
</style>
