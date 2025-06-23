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
            const projectLists = await this.loadProjectList();
            this.projectLists = this.sortProjectList(projectLists);
        },
        sortProjectList(list) {
            const getCharType = (char) => {
                if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(char)) return 1; // 한글
                if (/[a-zA-Z]/.test(char)) return 2; // 영어
                if (/[0-9]/.test(char)) return 3; // 숫자
                return 4; // 기타
            };

            return list.sort((a, b) => {
                const titleA = a.title.charAt(0);
                const titleB = b.title.charAt(0);
                
                const typeA = getCharType(titleA);
                const typeB = getCharType(titleB);

                if (typeA !== typeB) {
                    return typeA - typeB;
                }
                
                return a.title.localeCompare(b.title, 'ko-KR');
            });
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
