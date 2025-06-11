<template>
    <div>
        <template v-for="item in projectLists" :key="item.title">
            <NavItem class="leftPadding pl-2" :item="item" :use-i18n="false" />
        </template>
    </div>
</template>

<script>
import NavItem from '@/layouts/full/vertical-sidebar/NavItem/index.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();



export default {
    components: {
        NavItem
    },
    data: () => ({
        projectLists: [],
       
    }),
    async created() {
        await this.init();
    },
    methods: {
        async init() {
            this.projectLists = await this.loadProjectList();
        },
        async loadProjectList() {
            let result = await backend.getProjectList();
            if (!result) result = [];
            return result.map((item) => {
                item = {
                    // icon: 'ph:cube',
                    title: item.name,
                    to: `/project/${item.projectId}`,
                    BgColor:'primary'
                };
                return item;
            });
        },
        
    }
};
</script>
