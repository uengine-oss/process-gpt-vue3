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
                    <SkillTreeNode
                        v-for="skill in displayedItems"
                        :key="skill.name"
                        :skill="skill"
                        :skills-by-name="skillsByName"
                        :selected-skill-name="selectedSkillName"
                        @select="goToSkillDetail"
                    />
                </div>
            </template>
        </ExpandableList>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ExpandableList from '@/components/ui/ExpandableList.vue';
import SkillTreeNode from '@/components/ui/SkillTreeNode.vue';

const backend = BackendFactory.createBackend();

export default {
    name: 'SkillList',
    components: {
        ExpandableList,
        SkillTreeNode
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
            const childSet = new Set(this.skillList.flatMap((s) => s.children || []));
            return this.skillList.filter((s) => !childSet.has(s.name));
        },
        skillsByName() {
            const map = {};
            for (const s of this.skillList) {
                map[s.name] = s;
            }
            return map;
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
</style>
