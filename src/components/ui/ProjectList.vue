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
        intervalId: null
    }),
    async created() {
        await this.init();
    },
    mounted() {
        this.EventBus.on('project-updated', async () => {
            await this.init();
        });
        
        this.intervalId = setInterval(() => {
            this.init();
        }, 10000);
    },
    methods: {
        async init() {
            this.projectLists = await this.loadProjectList();
        },
        async loadProjectList() {
            let result = await backend.getProjectList();
            if (!result) result = [];
            return result.map((item) => {
                const title = item.name;
                const route = window.$mode == 'ProcessGPT' ? btoa(encodeURIComponent(item.projectId)) : item.projectId;
                item = {
                    // icon: 'ph:cube',
                    // title: item.status == 'NEW' ? title + this.$t('runningInstance.running') : title,
                    title: title,
                    to: `/project/${route}`,
                    BgColor:'primary',
                    isNew: item.status == 'NEW'
                };
                return item;
            });
        },
        
    }
};
</script>
