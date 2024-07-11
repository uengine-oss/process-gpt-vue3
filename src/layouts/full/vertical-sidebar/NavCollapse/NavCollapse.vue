<script setup>
import { computed } from 'vue';
import DropDown from '../DropDown/index.vue';
import BackendFactory from '@/components/api/BackendFactory';

const props = defineProps({
    item: Object, 
    level: Number, 
    type: String,
});

const useI18n = computed(() => {
    if (props.level > 0 && !props.type) {
        return false;
    }
    return true;
});

const emit = defineEmits(['update:item']);
const backend = BackendFactory.createBackend();

// const getChild = async (subitem, i) => {
//     let res = await backend.listDefinition(subitem.title);
//     let menu = [];
//     res.forEach((el) => {
//         var obj = {
//             title: el.name.split('.')[0],
//             type: el.name.split('.')[1]
//         };

//         if (el.directory) {
//             obj.directory = true;
//             obj.children = [];
//         } else {
//             if (el.name.split('.')[1] == 'form') {
//                 obj.to = `/ui-definitions/${el.path.split('.')[0]}`;
//             } else {
//                 obj.to = `/definitions/${el.path.split('.')[0]}`;
//             }
//         }
//         menu.push(obj);
//     });
//     props.item.children[i]['children'] = menu;
//     let copy = JSON.parse(JSON.stringify(props.item));
//     emit('update:item', copy);
// };
</script>

<template>
    <div class="mb-1">
        <DropDown v-if="!item.directory"
            :item="item"
            :level="level + 1"
        ></DropDown>
        <v-list-group v-else no-action>
            <template v-slot:activator="{ props }">
                <v-list-item v-bind="props" :value="item.title" :ripple="false" :class="'bg-hover-' + item.BgColor" :color="item.BgColor">
                    <!---Icon  -->
                    <template v-slot:prepend>
                        <div :class="'navbox  bg-hover-' + item.BgColor" :color="item.BgColor">
                            <span class="icon-box" v-if="level > 0">
                                <Icon icon="ic:outline-folder" width="24" height="24" />
                            </span>
                            <span class="icon-box" v-else>
                                <Icon
                                    :icon="item.icon"
                                    height="24"
                                    width="24"
                                    :level="level"
                                    :class="'position-relative z-index-2 texthover-' + item.BgColor"
                                />
                            </span>
                        </div>
                    </template>
                    <!---Title  -->
                    <v-tooltip :text="useI18n ? $t(item.title) : item.title">
                        <template v-slot:activator="{ props }">
                            <v-list-item-title
                                class="text-subtitle-1 font-weight-medium"
                                v-bind="props"
                            >
                                {{ useI18n ? $t(item.title) : item.title }}
                            </v-list-item-title>
                        </template>
                    </v-tooltip>
                    <!---If Caption-->
                    <v-tooltip v-if="item.subCaption" :text="item.subCaption">
                        <template v-slot:activator="{ props }">
                            <v-list-item-subtitle
                                class="text-caption mt-n1 hide-menu"
                                v-bind="props"
                            >
                                {{ item.subCaption }}
                            </v-list-item-subtitle>
                        </template>
                    </v-tooltip>
                </v-list-item>
            </template>
            <div class="mb-4 sublinks">
                <!-- 정의목록 하위 내용 보여주는곳 -->
                <template v-for="(subitem, i) in item.children" :key="i">
                    <template v-if="item.children">
                        <NavCollapse :item="subitem" v-if="subitem.directory" style="margin-left:20px;" :level="level + 1"/>
                        <NavCollapse :item="subitem" v-else-if="subitem.children" :level="level + 1" />
                        <DropDown :item="subitem" style="margin-left:20px;" :level="level + 1" v-else></DropDown>
                    </template>
                </template>
            </div>
        </v-list-group>
    </div>
</template>
