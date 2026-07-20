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
                        :skill-proposals-map="visibleSkillProposalsMap"
                        @select="goToSkillDetail"
                        @open-review="openReview"
                    />
                </div>
            </template>
        </ExpandableList>

        <SkillProposalReviewModal
            v-model="reviewModalOpen"
            :skill-name="reviewSkillName"
            target-type="SKILL"
            :pending-targets="reviewTargets"
            :backend="backend"
            :user-info="currentUserInfo"
        />
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ExpandableList from '@/components/ui/ExpandableList.vue';
import SkillTreeNode from '@/components/ui/SkillTreeNode.vue';
import SkillProposalReviewModal from '@/components/ui/SkillProposalReviewModal.vue';
import { buildSkillProposalMap } from '@/composables/useSkillProposals';

const backend = BackendFactory.createBackend();

export default {
    name: 'SkillList',
    components: {
        ExpandableList,
        SkillTreeNode,
        SkillProposalReviewModal
    },
    data() {
        return {
            backend,
            skillList: [],
            isLoading: false,
            selectedSkillName: null,
            skillsWatchRef: null,
            skillProposalsMap: new Map(),
            proposalsWatchRef: null,
            currentUserInfo: null,
            reviewModalOpen: false,
            reviewSkillName: '',
            reviewTargets: [],
            skillOwnersMap: new Map()
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
        },
        visibleSkillProposalsMap() {
            const map = new Map();
            if (!this.currentUserInfo?.uid) return map;
            for (const [skillName, entries] of this.skillProposalsMap.entries()) {
                if (this.skillOwnersMap.get(skillName) === this.currentUserInfo.uid) {
                    map.set(skillName, entries);
                }
            }
            return map;
        }
    },
    async mounted() {
        await this.loadSkillList();
        this.updateSelectedSkill();
        this.subscribeSkills();
        this.loadCurrentUser();
        this.loadSkillProposals();
        this.subscribeSkillProposals();
        this.loadSkillOwners();
    },
    beforeUnmount() {
        if (this.skillsWatchRef && typeof this.skillsWatchRef.unsubscribe === 'function') {
            this.skillsWatchRef.unsubscribe();
        }
        if (this.proposalsWatchRef && typeof this.proposalsWatchRef.unsubscribe === 'function') {
            this.proposalsWatchRef.unsubscribe();
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
                        this.loadSkillOwners();
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
        onCollapsed() {},

        async loadCurrentUser() {
            try {
                this.currentUserInfo = await backend.getUserInfo();
            } catch (e) {
                this.currentUserInfo = null;
            }
        },

        async loadSkillProposals() {
            try {
                const tenantId = window.$tenantName;
                const batches = await backend.getPendingSkillProposalBatches(tenantId);
                this.skillProposalsMap = buildSkillProposalMap(batches);
            } catch (error) {
                console.error(this.$t('SkillProposal.loadFailed'), error);
            }
        },

        async subscribeSkillProposals() {
            try {
                const tenantId = window.$tenantName;
                this.proposalsWatchRef = await backend.watchFeedbackProposals(
                    () => {
                        this.loadSkillProposals();
                    },
                    {
                        filter: tenantId ? `tenant_id=eq.${tenantId}` : null
                    }
                );
            } catch (e) {
                console.error('Failed to subscribe feedback_proposals realtime:', e);
            }
        },

        openReview(skillName) {
            this.reviewSkillName = skillName;
            this.reviewTargets = this.visibleSkillProposalsMap.get(skillName) || [];
            this.reviewModalOpen = true;
        },

        async loadSkillOwners() {
            try {
                const tenantId = window.$tenantName;
                const rows = await backend.getTenantSkillOwners(tenantId);
                this.skillOwnersMap = new Map(rows.map((r) => [r.skill_name, r.owner_id]));
            } catch (e) {
                this.skillOwnersMap = new Map();
            }
        }
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
