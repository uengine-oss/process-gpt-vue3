<template>
    <v-tooltip v-if="pendingTargets && pendingTargets.length > 0" location="top" :text="$t('SkillProposal.badgeTooltip')">
        <template v-slot:activator="{ props }">
            <v-btn
                v-bind="props"
                icon
                variant="text"
                :size="size"
                color="warning"
                class="skill-proposal-badge"
                @click.stop="$emit('open-review')"
            >
                <v-icon :size="iconSize">mdi-alert-circle</v-icon>
            </v-btn>
        </template>
    </v-tooltip>
</template>

<script>
export default {
    name: 'SkillProposalBadge',
    props: {
        pendingTargets: {
            type: Array,
            default: () => []
        },
        // v-btn size scale, matches the icon buttons this badge sits next to
        // (e.g. table row actions use "small", card headers use "x-small").
        size: {
            type: String,
            default: 'small'
        }
    },
    emits: ['open-review'],
    computed: {
        iconSize() {
            return this.size === 'x-small' ? 16 : 20;
        }
    }
};
</script>

<style scoped>
.skill-proposal-badge {
    flex-shrink: 0;
}
</style>
