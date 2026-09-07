<template>
    <div class="pi-flag-page">
        <!-- Header -->
        <div class="page-header pb-4">
            <div class="page-header-left">
                <h1 class="page-title">PI Flag</h1>
            </div>
        </div>

        <v-tabs v-model="activeTab" color="primary" align-tabs="start">
            <v-tab value="board">
                <v-icon start size="18">mdi-flag-variant</v-icon>
                PI Flag 모아보기
            </v-tab>
            <v-tab value="types">
                <v-icon start size="18">mdi-tag-multiple-outline</v-icon>
                유형 관리
            </v-tab>
        </v-tabs>

        <v-window v-model="activeTab" class="pi-flag-window">
            <v-window-item value="board" :transition="false" :reverse-transition="false">
                <PiFlagBoard />
            </v-window-item>
            <v-window-item value="types" :transition="false" :reverse-transition="false">
                <PiFlagTypeManager />
            </v-window-item>
        </v-window>
    </div>
</template>

<script>
import { defineComponent } from 'vue';
import PiFlagBoard from './PiFlagBoard.vue';
import PiFlagTypeManager from './PiFlagTypeManager.vue';

export default defineComponent({
    name: 'PiFlagPage',
    components: { PiFlagBoard, PiFlagTypeManager },
    data() {
        return {
            activeTab: 'board'
        };
    }
});
</script>

<style scoped>
.pi-flag-page {
    display: flex;
    flex-direction: column;
    background: #ffffff;
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

.pi-flag-page > .page-header,
.pi-flag-page > .v-tabs {
    flex: 0 0 auto;
}

.pi-flag-window {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
}

.pi-flag-window :deep(.v-window__container),
.pi-flag-window :deep(.v-window-item) {
    height: 100%;
    min-height: 0;
}
</style>
