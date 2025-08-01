<template>
    <div>
        <v-row class="ma-0">
            <v-col cols="12" md="6" class="pa-0 pr-md-3">
                <v-card class="mb-0" elevation="2">
                    <v-card-text class="pa-4">
                        <div class="d-flex align-center mb-3">
                            <v-icon color="success" class="mr-2">mdi-check-circle</v-icon>
                            <h4 class="text-h6 text-success mb-0">완료된 작업</h4>
                        </div>
                        <v-list dense class="pa-0">
                            <v-list-item v-for="(activity, index) in resultJson.completedActivities" :key="'completed-' + index" class="px-0">
                                <v-list-item-content>
                                    <v-list-item-title class="font-weight-bold">활동: {{ activity.completedActivityName }}</v-list-item-title>
                                    <v-list-item-subtitle>{{ activity.description }}</v-list-item-subtitle>
                                </v-list-item-content>
                            </v-list-item>
                            <v-list-item v-if="resultJson.completedActivities.length === 0" class="px-0">
                                <v-list-item-content>
                                    <v-list-item-subtitle class="text-grey">완료된 작업이 없습니다.</v-list-item-subtitle>
                                </v-list-item-content>
                            </v-list-item>
                        </v-list>
                    </v-card-text>
                </v-card>
            </v-col>
            <v-col cols="12" md="6" class="pa-0 pl-md-3">
                <v-card class="mb-3" elevation="2">
                    <v-card-text class="pa-4">
                        <div class="d-flex align-center mb-3">
                            <v-icon color="primary" class="mr-2">mdi-refresh</v-icon>
                            <h4 class="text-h6 text-primary mb-0">다음 작업</h4>
                        </div>
                        <v-list dense class="pa-0">
                            <v-list-item v-for="(activity, index) in resultJson.nextActivities" :key="'next-' + index" class="px-0">
                                <v-list-item-content>
                                    <v-list-item-title class="font-weight-bold">활동: {{ activity.nextActivityName }}</v-list-item-title>
                                    <v-list-item-subtitle>{{ activity.description }}</v-list-item-subtitle>
                                </v-list-item-content>
                            </v-list-item>
                            <v-list-item v-if="resultJson.nextActivities.length === 0" class="px-0">
                                <v-list-item-content>
                                    <v-list-item-subtitle class="text-grey">다음 작업이 없습니다.</v-list-item-subtitle>
                                </v-list-item-content>
                            </v-list-item>
                        </v-list>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <v-card v-if="resultJson.referenceInfo && resultJson.referenceInfo.length > 0" class="mt-4" elevation="2">
            <v-card-text class="pa-4">
                <div class="d-flex align-center mb-3">
                    <v-icon color="warning" class="mr-2">mdi-clipboard-text</v-icon>
                    <h4 class="text-h6 text-warning-dark mb-0">참조 정보</h4>
                </div>
                <v-list dense class="pa-0">
                    <v-list-item v-for="(info, index) in resultJson.referenceInfo" :key="'ref-' + index" class="px-0">
                        <v-list-item-content>
                            <v-list-item-title class="font-weight-bold">{{ info.key }}</v-list-item-title>
                            <v-list-item-subtitle>{{ info.value }}</v-list-item-subtitle>
                        </v-list-item-content>
                    </v-list-item>
                </v-list>
            </v-card-text>
        </v-card>
    </div>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    props: {
        message: Object,
    },
    data: () => ({
        resultJson: {
            completedActivities: [],
            nextActivities: [],
            referenceInfo: []
        }
    }),
    mounted() {
        this.init();
    },
    methods: {
        init() {
            if (this.message && this.message.jsonContent) {
                if (typeof this.message.jsonContent == 'string') {
                    this.resultJson = JSON.parse(this.message.jsonContent);
                } else {
                    this.resultJson = this.message.jsonContent;
                }
            }
        }
    }
}
</script>