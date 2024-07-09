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
    console.log(`Item:`, item);
    if (item.type && item.type.includes('bpmn')) {
        return 'carbon:ibm-process-mining';
    } else if (item.type && item.type.includes('json')) {
        return 'carbon:json';
    } else if (item.type && item.type.includes('form')) {
        return 'carbon:document';
    } else {
        return 'carbon:ibm-process-mining';
    }
}
</script>

<template>
    <div class="mb-0">
        <!---Single Item-->
        <v-list-item
            :to="item.to"
            rounded="lg"
            class=""
            color=""
            :ripple="false"
            :disabled="item.disabled"
            :target="item.type === 'external' ? '_blank' : ''"
            v-scroll-to="{ el: '#top' }"
            :style="{ marginLeft: 8 + (level - 1) * 20 + 'px' }"
        >
            <!---If icon-->
            <template v-slot:prepend>
                <Icon
                    :icon="getIcon(item)"
                    width="24"
                    height="24"
                />
            </template>
            <v-tooltip bottom :text="useI18n ? $t(item.title) : item.title">
                <template v-slot:activator="{ props }">
                    <v-list-item-title
                        class="ml-4 text-body-1"
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