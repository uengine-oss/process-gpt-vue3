<script setup>
import { computed } from 'vue';
const props = defineProps({ item: Object, level: Number });
const useI18n = computed(() => {
    if (props.level > 0) {
        return false;
    }
    return true;
});

function getIcon(item) {
    if (item.type && item.type.includes('bpmn')) {
        return 'ibm-process-mining';
    } else if (item.type && item.type.includes('json')) {
        return 'json';
    } else if (item.type && item.type.includes('form')) {
        return 'document';
    } else {
        return 'ibm-process-mining';
    }
}
</script>

<template>
    <div class="mb-0">
        <!---Single Item-->
        <v-list-item
            :to="item.to"
            rounded="lg"
            :class="'bg-hover-' + item.BgColor"
            :color="item.BgColor"
            :ripple="false"
            :disabled="item.disabled"
            :target="item.type === 'external' ? '_blank' : ''"
            v-scroll-to="{ el: '#top' }"
            :style="{ marginLeft: 8 + (level - 1) + 'px' }"
        >
            <!-- 정의관리 아이콘 보여지던곳 -->
            <!-- <template v-slot:prepend>
                <div :class="'navbox  bg-hover-' + item.BgColor" :color="item.BgColor">
                    <Icons
                        :icon="getIcon(item)"
                    />
                </div>
            </template> -->
            <v-tooltip bottom :text="useI18n ? $t(item.title) : item.title">
                <template v-slot:activator="{ props }">
                    <v-list-item-title
                        class="ml-0 text-body-1"
                        v-bind="props"
                    >
                        {{ useI18n ? $t(item.title) : item.title }}
                    </v-list-item-title>
                </template>
            </v-tooltip>
            <!---If Caption-->
            <v-list-item-subtitle v-if="item.subCaption" class="text-caption mt-n1 hide-menu">
                {{ item.subCaption }}
            </v-list-item-subtitle>
            
            <!---If any chip or label-->
            <template v-slot:append v-if="item.chip">
                <v-chip
                    :color="item.chipColor"
                    :class="'sidebarchip hide-menu bg-'+item.chipBgColor"
                    :size="item.chipIcon ? 'small' : 'small'"
                    :variant="item.chipVariant"
                    :prepend-icon="item.chipIcon"
                >
                    {{ item.chip }}
                </v-chip>
            </template>
        </v-list-item>
    </div>
</template>