<template>
    <div>
        <v-tooltip bottom :text="skill.name || 'Unnamed Skill'">
            <template v-slot:activator="{ props }">
                <div
                    v-bind="props"
                    :class="[
                        'skill-item',
                        { 'skill-item-child': depth > 0 },
                        'sidebar-list-hover-bg',
                        { 'sidebar-list-hover-bg--active': isSelected(skill.name) }
                    ]"
                    :style="depth > 0 ? { paddingLeft: `${8 + (depth - 1) * 16}px` } : null"
                    @click="onSelect(skill.name)"
                >
                    <v-icon v-if="depth > 0" size="14" class="child-indent-icon">mdi-subdirectory-arrow-right</v-icon>
                    <v-icon :size="depth > 0 ? 18 : 20">mdi-lightning-bolt-outline</v-icon>
                    <div class="skill-info">
                        <span class="skill-name">{{ skill.name || 'Unnamed Skill' }}</span>
                        <span v-if="skill.description" class="skill-description">{{ skill.description }}</span>
                    </div>
                </div>
            </template>
        </v-tooltip>
        <template v-if="childSkills.length">
            <SkillTreeNode
                v-for="child in childSkills"
                :key="child.name"
                :skill="child"
                :skills-by-name="skillsByName"
                :selected-skill-name="selectedSkillName"
                :visited="childVisited"
                :depth="depth + 1"
                @select="onSelect"
            />
        </template>
    </div>
</template>

<script>
export default {
    name: 'SkillTreeNode',
    props: {
        skill: {
            type: Object,
            required: true
        },
        skillsByName: {
            type: Object,
            required: true
        },
        selectedSkillName: {
            type: String,
            default: null
        },
        // Ancestor names already rendered on the path from the root to this node,
        // used to break inheritance cycles (e.g. A extends B extends A).
        visited: {
            type: Set,
            default: () => new Set()
        },
        depth: {
            type: Number,
            default: 0
        }
    },
    emits: ['select'],
    computed: {
        childVisited() {
            return new Set([...this.visited, this.skill.name]);
        },
        childSkills() {
            const names = Array.isArray(this.skill.children) ? this.skill.children : [];
            return names
                .filter((name) => name && name !== this.skill.name && !this.visited.has(name))
                .map((name) => this.skillsByName[name])
                .filter(Boolean);
        }
    },
    methods: {
        isSelected(name) {
            return this.selectedSkillName === name;
        },
        onSelect(name) {
            this.$emit('select', name);
        }
    }
};
</script>

<style scoped>
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
