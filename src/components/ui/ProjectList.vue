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
        watchRef: null
    }),
    async created() {
        await this.init();
    },
    async mounted() {
        this.EventBus.on('project-updated', async () => {
            await this.init();
        });
        
      
        this.watchRef = await backend.watchProjectList((callback => {
            const projectId = callback.id
            const project = callback.value
            const index = this.projectLists.findIndex(item => item.projectId == projectId);
            if (project) {
                const route = window.$mode == 'ProcessGPT'? btoa(encodeURIComponent(projectId)) : projectId
                // 삽입 또는 수정
                const newProject = {
                    projectId: projectId,
                    updatedAt: project.updatedAt,
                    title: project.name,
                    to: `/project/${route}`,
                    BgColor: 'primary',
                    isNew: project.status === 'NEW'
                };

                if (index !== -1) {
                    // 수정
                    this.projectLists.splice(index, 1, newProject);
                } else {
                    // 삽입
                    this.projectLists.push(newProject);
                }
                this.projectLists.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            } else if (index !== -1) {
                // 삭제
                this.projectLists.splice(index, 1);
            }
        }));
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
                    projectId: item.projectId,
                    updatedAt: item.updatedAt,
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
