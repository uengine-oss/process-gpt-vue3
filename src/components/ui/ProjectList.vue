<template>
    <div>
        <template v-for="item in displayedProjectList" :key="item.title">
            <NavItem class="leftPadding pl-2" :item="item" :use-i18n="false" />
        </template>
        
        <!-- 더보기/접기 버튼 -->
        <div v-if="hasMoreProjects" class="mt-2">
            <v-card @click="showMoreProjects"
                v-if="!showAllProjects" 
                class="text-center cursor-pointer pa-2"
                elevation="10"
                rounded="10"
            >
                <v-card-text class="pa-0">
                    <span class="text-caption text-primary">
                        {{ $t('VerticalSidebar.showMore') }} ({{ projectLists.length - 10 }})
                    </span>
                    <v-icon size="small" class="ml-1" color="primary">mdi-chevron-down</v-icon>
                </v-card-text>
            </v-card>
            <v-card @click="showLessProjects"
                v-else 
                class="text-center cursor-pointer pa-2"
                elevation="10"
                rounded="10"
            >
                <v-card-text class="pa-0">
                    <span class="text-caption text-primary">
                        {{ $t('VerticalSidebar.showLess') }}
                    </span>
                    <v-icon size="small" class="ml-1" color="primary">mdi-chevron-up</v-icon>
                </v-card-text>
            </v-card>
        </div>
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
        watchRef: null,
        showAllProjects: false // 프로젝트 더보기 상태 관리
    }),
    async created() {
        await this.init();
    },
    async mounted() {
        this.EventBus.on('project-updated', async () => {
            await this.init();
        });
        

        this.watchRef = await backend.watchProjectList((callback => {
            // console.log('callback', callback);
            this.loadProjectList();
            // const projectId = callback.id
            // const project = callback.value
            // const index = this.projectLists.findIndex(item => item.projectId == projectId);
            // if (project) {
            //     // 삽입 또는 수정
            //     const newProject = {
            //         projectId: projectId,
            //         updatedAt: project.updatedAt,
            //         title: project.name,
            //         to: `/project/${projectId}`,
            //         BgColor: 'primary',
            //         isNew: project.status === 'NEW'
            //     };

            //     if (index !== -1) {
            //         // 수정
            //         this.projectLists.splice(index, 1, newProject);
            //     } else {
            //         // 삽입
            //         this.projectLists.push(newProject);
            //     }
            //     this.projectLists.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            // } else if (index !== -1) {
            //     // 삭제
            //     this.projectLists.splice(index, 1);
            // }
        }));
    },
    computed: {
        displayedProjectList() {
            if (!this.projectLists || this.projectLists.length === 0) return [];
            if (this.showAllProjects || this.projectLists.length <= 10) {
                return this.projectLists;
            }
            return this.projectLists.slice(0, 10);
        },
        hasMoreProjects() {
            return this.projectLists && this.projectLists.length > 10;
        }
    },
    methods: {
        async init() {
            await this.loadProjectList();
        },
        async loadProjectList() {
            let result = await backend.getProjectListByStatus(["NEW", "RUNNING"]);
            if (!result) result = [];
            this.projectLists = result.map((item) => {
                const title = item.name;
                item = {
                    // icon: 'ph:cube',
                    // title: item.status == 'NEW' ? title + this.$t('runningInstance.running') : title,
                    projectId: item.projectId,
                    updatedAt: item.updatedAt,
                    title: title,
                    to: `/project/${item.projectId}`,
                    BgColor:'primary',
                    isNew: item.status == 'NEW'
                };
                return item;
            });
        },
        showMoreProjects() {
            this.showAllProjects = true;
        },
        showLessProjects() {
            this.showAllProjects = false;
        }
        
    }
};
</script>
