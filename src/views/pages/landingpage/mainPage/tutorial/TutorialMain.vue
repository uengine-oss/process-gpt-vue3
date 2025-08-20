<template>
    <div class="tutorial-main">
        <div class="tutorial-layout">
            <TutorialSidebar 
                :current-page="currentPage"
                :sections-data="sectionsData"
                @page-selected="selectPage"
                @close-tutorial="closeTutorial"
            />
            <TutorialContent 
                :current-page="currentPage"
                :all-pages="allPages"
                @page-selected="selectPage"
            />
        </div>
    </div>
</template>

<script>
import TutorialSidebar from './TutorialSidebar.vue'
import TutorialContent from './TutorialContent.vue'
import markdownLoader from './utils/markdownLoader.js'

export default {
    name: 'TutorialMain',
    components: {
        TutorialSidebar,
        TutorialContent
    },
    data() {
        return {
            currentPage: null,
            allPages: [],
            sectionsData: {}
        }
    },
    async created() {
        await this.initializePages();
    },
    methods: {
        async initializePages() {
            try {
                // 마크다운 메타데이터 가져오기
                const groupedMetadata = await markdownLoader.getGroupedMetadata();
                this.sectionsData = groupedMetadata;
                
                // 모든 페이지를 평면화하여 배열로 만듦
                this.allPages = [];
                Object.values(groupedMetadata).forEach(sectionItems => {
                    sectionItems.forEach(item => {
                                                       this.allPages.push({
                                   path: item.fileName.replace('.md', ''),
                                   title: item.title,
                                   markdownFile: item.fileName,
                                   section: item.section,
                                   order: item.order
                               });
                    });
                });
                
                // 로딩 완료 이벤트 전송
                this.$emit('tutorial-loaded');
            } catch (error) {
                console.error('페이지 초기화 실패:', error);
                // 실패해도 로딩 완료로 처리
                this.$emit('tutorial-loaded');
            }
        },
        selectPage(page) {
            this.currentPage = page;
        },
        closeTutorial() {
            this.$emit('close-tutorial');
        }
    }
}
</script>

<style scoped>
.tutorial-main {
    width: 100%;
    background: #ffffff;
}

.tutorial-layout {
    position: relative;
}

@media (max-width: 768px) {
    .tutorial-sidebar {
        position: relative;
        width: 100%;
        height: auto;
    }
    
    .tutorial-content {
        margin-left: 0;
    }
}
</style>
