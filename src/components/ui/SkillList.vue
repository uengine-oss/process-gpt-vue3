<template>
    <div class="skill-list-container">
        <div v-if="isLoading" class="list-skeleton-loading">
            <v-skeleton-loader v-for="n in 3" :key="n" type="list-item" />
        </div>

        <div v-else-if="skillList.length === 0" class="pl-4 pr-4 py-2 text-caption text-grey">
            {{ $t('SkillList.empty') || '등록된 스킬이 없습니다' }}
        </div>

        <ExpandableList v-else :items="rootSkills" :limit="5" @expanded="onExpanded" @collapsed="onCollapsed">
            <template #items="{ displayedItems }">
                <div class="skill-items">
                    <template v-for="skill in displayedItems" :key="skill.name">
                        <v-tooltip bottom :text="skill.name || 'Unnamed Skill'">
                            <template v-slot:activator="{ props }">
                                <div
                                    v-bind="props"
                                    :class="[
                                        'skill-item',
                                        'sidebar-list-hover-bg',
                                        { 'sidebar-list-hover-bg--active': isSkillSelected(skill.name) }
                                    ]"
                                    @click="goToSkillDetail(skill.name)"
                                >
                                    <v-icon size="20">mdi-lightning-bolt-outline</v-icon>
                                    <div class="skill-info">
                                        <span class="skill-name">{{ skill.name || 'Unnamed Skill' }}</span>
                                        <span v-if="skill.description" class="skill-description">{{ skill.description }}</span>
                                    </div>
                                </div>
                            </template>
                        </v-tooltip>
                        <!-- 자식 스킬 들여쓰기 렌더링 -->
                        <template v-if="skill.children && skill.children.length">
                            <v-tooltip
                                v-for="childName in skill.children"
                                :key="childName"
                                bottom
                                :text="childName"
                            >
                                <template v-slot:activator="{ props }">
                                    <div
                                        v-bind="props"
                                        :class="[
                                            'skill-item',
                                            'skill-item-child',
                                            'sidebar-list-hover-bg',
                                            { 'sidebar-list-hover-bg--active': isSkillSelected(childName) }
                                        ]"
                                        @click="goToSkillDetail(childName)"
                                    >
                                        <v-icon size="14" class="child-indent-icon">mdi-subdirectory-arrow-right</v-icon>
                                        <v-icon size="18">mdi-lightning-bolt-outline</v-icon>
                                        <div class="skill-info">
                                            <span class="skill-name">{{ childName }}</span>
                                        </div>
                                    </div>
                                </template>
                            </v-tooltip>
                        </template>
                    </template>
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
    name: 'SkillList',
    components: {
        ExpandableList
    },
    data() {
        return {
            skillList: [],
            isLoading: false,
            selectedSkillName: null,
            skillsWatchRef: null
        };
    },
    computed: {
        rootSkills() {
            const childSet = new Set(
                this.skillList.flatMap((s) => s.children || [])
            );
            return this.skillList.filter((s) => !childSet.has(s.name));
        }
    },
    async mounted() {
        await this.loadSkillList();
        this.updateSelectedSkill();
        this.subscribeSkills();
    },
    beforeUnmount() {
        if (this.skillsWatchRef && typeof this.skillsWatchRef.unsubscribe === 'function') {
            this.skillsWatchRef.unsubscribe();
        }
    },
    watch: {
        $route() {
            this.updateSelectedSkill();
        }
    },
    methods: {
        async subscribeSkills() {
            try {
                const tenantId = window.$tenantName;
                this.skillsWatchRef = await backend.watchTenantSkills(
                    () => {
                        this.loadSkillList();
                    },
                    {
                        filter: tenantId ? `tenant_id=eq.${tenantId}` : null
                    }
                );
            } catch (e) {
                console.error('Failed to subscribe tenant_skills realtime:', e);
            }
        },
        async loadSkillList() {
            this.isLoading = true;
            try {
                const result = await backend.getTenantSkills(window.$tenantName);
                const tenantSkills = result.skills;
                const list = Array.isArray(tenantSkills) ? tenantSkills : tenantSkills?.skills || [];

                this.skillList = list
                    .map((skill) => ({
                        name: skill.name || skill.skill_name,
                        description: skill.description || '',
                        children: Array.isArray(skill.children) ? skill.children : []
                    }))
                    .filter((s) => s.name);
            } catch (error) {
                console.error(this.$t('SkillList.loadFailed'), error);
                this.skillList = [];
            } finally {
                this.isLoading = false;
            }
        },

        goToSkillDetail(skillName) {
            if (!skillName) return;
            this.$router.push(`/skills/${encodeURIComponent(skillName)}`);
        },

        updateSelectedSkill() {
            const currentPath = this.$route.path;
            if (currentPath.startsWith('/skills/')) {
                this.selectedSkillName = decodeURIComponent(currentPath.replace('/skills/', ''));
            } else {
                this.selectedSkillName = null;
            }
        },

        isSkillSelected(skillName) {
            return this.selectedSkillName === skillName;
        },

        onExpanded() {},
        onCollapsed() {}
    }
};
</script>

<style scoped>
.skill-list-container {
    padding: 8px 0;
}

.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 8px;
    text-align: center;
    color: #666;
}

.skill-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.skill-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    gap: 12px;
}

.skill-item-child {
    padding-left: 8px;
}

.child-indent-icon {
    opacity: 0.4;
    flex-shrink: 0;
}

.skill-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
}

.skill-name {
    font-size: 14px;
    font-weight: 500;
    color: #2d3436;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.skill-description {
    font-size: 10px;
    color: #636e72;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
}

@media (max-width: 768px) {
    .skill-item {
        padding: 10px 12px;
    }

    .skill-name {
        font-size: 13px;
    }

    .skill-description {
        font-size: 11px;
    }
}
</style>
