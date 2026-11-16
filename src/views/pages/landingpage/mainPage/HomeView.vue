<template>
    <v-container class="main-page-container ma-0 pa-0">
        <v-row class="ma-0 pa-0">
            <v-col class="ma-0 pa-0" cols="12" v-if="!showTutorial">
                <!-- 제품 소개는 uengine.org 가 맡는다. 여기서는 튜토리얼·GitHub·제품 소개·로그인으로 가는 길만 안내한다. -->
                <GuideSection />
                <!-- <v-card>
                    <v-card-title>Vue 3 + Vuetify 3</v-card-title>
                    <v-card-text>
                        Welcome to your new Vue 3 + Vuetify 3 application!
                    </v-card-text>
                    <v-card-actions>
                        <v-btn
                            color="primary"
                            @click="$router.push('/marketplace')"
                        >
                            Marketplace로 이동
                        </v-btn>
                    </v-card-actions>
                </v-card> -->
            </v-col>
            <v-col cols="12" class="ma-0 pa-0 pt-2" v-if="showTutorial">
                <!-- 튜토리얼 로딩 중일 때 스켈레톤 표시 -->
                <div v-if="isTutorialLoading">
                    <v-skeleton-loader type="card" class="mb-4 tutorial-main-skeleton" elevation="2" />
                </div>

                <!-- 튜토리얼 로딩 완료 후 실제 컨텐츠 표시 -->
                <div v-show="!isTutorialLoading">
                    <TutorialMain @close-tutorial="closeTutorial" @tutorial-loaded="onTutorialLoaded" />
                </div>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
import GuideSection from './sections/GuideSection.vue';
import TutorialMain from './tutorial/TutorialMain.vue';

export default {
    name: 'HomeView',
    props: {
        showTutorial: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            isTutorialLoading: false
        };
    },
    components: {
        GuideSection,
        TutorialMain
    },
    watch: {
        showTutorial(newVal) {
            if (newVal) {
                this.isTutorialLoading = true;
            } else {
                // 튜토리얼이 닫힐 때 로딩 상태 초기화
                this.isTutorialLoading = false;
            }
        }
    },
    methods: {
        closeTutorial() {
            this.$emit('close-tutorial');
        },
        onTutorialLoaded() {
            this.isTutorialLoading = false;
        }
    }
};
</script>

<style scoped></style>
