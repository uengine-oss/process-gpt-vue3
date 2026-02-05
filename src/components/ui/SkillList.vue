<template>
    <div class="skill-list-container">
        <div v-if="isLoading" class="loading-state">
            <v-progress-circular indeterminate size="24" color="primary"></v-progress-circular>
            <span class="ml-2 text-caption">{{ $t('SkillList.loading') }}</span>
        </div>

        <div v-else-if="skillList.length === 0" class="empty-state">
            <v-icon size="32" color="grey-lighten-1">mdi-lightning-bolt-outline</v-icon>
            <span class="text-caption text-grey">{{ $t('SkillList.empty') }}</span>
        </div>

        <ExpandableList
            v-else
            :items="skillList"
            :limit="5"
            @expanded="onExpanded"
            @collapsed="onCollapsed"
        >
            <template #items="{ displayedItems }">
                <div class="skill-items">
                    <v-tooltip
                        v-for="skill in displayedItems"
                        bottom
                        :key="skill.name"
                        :text="skill.name || 'Unnamed Skill'"
                    >
                        <template v-slot:activator="{ props }">
                            <div
                                v-bind="props"
                                class="skill-item"
                                @click="goToSkillDetail(skill.name)"
                            >
                                <div class="skill-icon-wrap">
                                    <v-icon size="20" color="primary">mdi-lightning-bolt-outline</v-icon>
                                </div>
                                <div class="skill-info">
                                    <span class="skill-name">{{ skill.name || 'Unnamed Skill' }}</span>
                                    <span v-if="skill.description" class="skill-description">{{ skill.description }}</span>
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
    name: 'SkillList',
    components: {
        ExpandableList
    },
    data() {
        return {
            skillList: [],
            isLoading: false
        };
    },
    async mounted() {
        await this.loadSkillList();
    },
    methods: {
        async loadSkillList() {
            this.isLoading = true;
            try {
                const result = await backend.getTenantSkills(window.$tenantName);
                const tenantSkills = result.skills;
                const list = Array.isArray(tenantSkills) ? tenantSkills : (tenantSkills?.skills || []);

                this.skillList = list.map(skill => ({
                    name: skill.name || skill.skill_name,
                    description: skill.description || ''
                })).filter(s => s.name);
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

        onExpanded() {},
        onCollapsed() {}
    }
};
</script>

<style scoped>
.skill-list-container {
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

.skill-item:hover {
    background-color: #e8f5e9;
    transform: translateX(2px);
}

.skill-icon-wrap {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(103, 126, 234, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
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

    .skill-icon-wrap {
        width: 36px;
        height: 36px;
    }

    .skill-name {
        font-size: 13px;
    }

    .skill-description {
        font-size: 11px;
    }
}
</style>
