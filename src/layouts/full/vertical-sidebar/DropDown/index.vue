<script setup>
import { computed, inject, ref } from 'vue';
import { useRoute } from 'vue-router';
import SkillProposalBadge from '@/components/ui/SkillProposalBadge.vue';
import SkillProposalReviewModal from '@/components/ui/SkillProposalReviewModal.vue';

const props = defineProps({ item: Object, level: Number });
const route = useRoute();

const processProposalsMap = inject('processProposalsMap', computed(() => new Map()));
const dmnProposalsMap = inject('dmnProposalsMap', computed(() => new Map()));
const currentUserUid = inject('currentUserUid', computed(() => null));
const sidebarBackend = inject('sidebarBackend', null);
const sidebarUserInfo = inject('sidebarUserInfo', computed(() => null));

const proposalTargetType = computed(() => {
    if (props.item.type === 'dmn') return 'DMN_RULE';
    if (props.item.type === 'bpmn') return 'PROCESS_DEFINITION';
    return null;
});

const isOwnedByCurrentUser = computed(
    () => !!props.item.owner && !!currentUserUid.value && props.item.owner === currentUserUid.value
);

const pendingProposalTargets = computed(() => {
    if (!isOwnedByCurrentUser.value || !proposalTargetType.value || !props.item.id) return [];
    const map = proposalTargetType.value === 'DMN_RULE' ? dmnProposalsMap.value : processProposalsMap.value;
    return map.get(props.item.id) || [];
});

const reviewModalOpen = ref(false);
function openProposalReview() {
    reviewModalOpen.value = true;
}

const useI18n = computed(() => {
    if (props.level > 0) {
        return false;
    }
    return true;
});

function getIcon(item) {
    if (item.type && item.type.includes('bpmn')) {
        return 'sidebarProcess';
    } else if (item.type && item.type.includes('json')) {
        return 'json';
    } else if (item.type && item.type.includes('form')) {
        return 'document';
    } else if (item.type && item.type.includes('dmn')) {
        return 'sidebarDMN';
    } else {
        return 'ibm-process-mining';
    }
}

function getIconColor(item) {
    if (item.type && item.type.includes('bpmn')) {
        return '#64B5F6';
    } else if (item.type && item.type.includes('dmn')) {
        return '#BA68C8';
    } else if (item.type && item.type.includes('rule')) {
        return '#BA68C8';
    } else if (item.type && item.type.includes('form')) {
        return '#81C784';
    } else {
        return '';
    }
}

function isItemActive(item) {
    if (!item || !item.to) return false;
    const itemPath = typeof item.to === 'object' ? item.to.path : item.to;
    return route.path === itemPath;
}
</script>

<template>
    <div class="mb-0 sidebar-list-hover-bg" :class="{ 'sidebar-list-hover-bg--active': isItemActive(item) }">
        <!---Single Item-->
        <v-list-item
            :to="item.to"
            rounded="lg"
            :ripple="false"
            :disabled="item.disabled"
            :target="item.type === 'external' ? '_blank' : ''"
            v-scroll-to="{ el: '#top' }"
            :style="{ marginLeft: 8 + (level - 1) + 'px' }"
            class="sidebar-list-item"
        >
            <!-- 정의관리 아이콘 보여지던곳 -->
            <template v-slot:prepend>
                <div :color="item.BgColor" class="mr-2">
                    <span
                        v-if="item.type && item.type.includes('rule')"
                        class="bpmn-icon-business-rule bpmn-sidebar-icon"
                        aria-hidden="true"
                    />
                    <Icons v-else :icon="getIcon(item)" :color="getIconColor(item)" />
                </div>
            </template>
            <v-tooltip bottom :text="useI18n ? $t(item.title) : item.title">
                <template v-slot:activator="{ props }">
                    <v-list-item-title class="ml-0 text-body-1" v-bind="props">
                        {{ useI18n ? $t(item.title) : item.title }}
                    </v-list-item-title>
                </template>
            </v-tooltip>
            <!---If Caption-->
            <v-list-item-subtitle v-if="item.subCaption" class="text-caption mt-n1 hide-menu">
                {{ item.subCaption }}
            </v-list-item-subtitle>

            <!---If any chip or label-->
            <template v-slot:append>
                <v-chip
                    v-if="item.chip"
                    :color="item.chipColor"
                    :class="'sidebarchip hide-menu bg-' + item.chipBgColor"
                    :size="item.chipIcon ? 'small' : 'small'"
                    :variant="item.chipVariant"
                    :prepend-icon="item.chipIcon"
                >
                    {{ item.chip }}
                </v-chip>
                <SkillProposalBadge :pending-targets="pendingProposalTargets" size="x-small" @open-review="openProposalReview" />
            </template>
        </v-list-item>
        <SkillProposalReviewModal
            v-if="reviewModalOpen"
            v-model="reviewModalOpen"
            :skill-name="item.title"
            :target-type="proposalTargetType"
            :pending-targets="pendingProposalTargets"
            :backend="sidebarBackend"
            :user-info="sidebarUserInfo"
        />
    </div>
</template>

<style scoped>
.bpmn-sidebar-icon {
    font-size: 20px;
    line-height: 1;
    color: #ba68c8;
}
.bpmn-sidebar-icon:before {
    margin-left: 0 !important;
    margin-right: 0 !important;
}
</style>
