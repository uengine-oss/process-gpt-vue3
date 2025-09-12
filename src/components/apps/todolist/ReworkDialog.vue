<template>
    <v-card>
        <v-card-title>
            재작업 범위 설정
        </v-card-title>
        <v-card-subtitle class="mt-2">
            <v-alert type="warning" density="compact" variant="tonal">
                완료된 항목만 재작업 가능합니다.
            </v-alert>
        </v-card-subtitle>
        <v-card-text class="">
            <v-radio-group v-model="reworkType">
                <div v-for="(item, index) in reworkItems" :key="item.id" :class="index !== 0 ? 'mt-5' : ''">
                    <v-radio
                        :value="item.id" 
                        color="primary"
                    >
                        <template v-slot:label="{ props }">
                            <div v-bind="props">
                                <span class="font-weight-bold" :class="reworkType === item.id ? 'text-primary' : 'text-default'">
                                    {{ item.label }}
                                </span>
                                <div class="text-caption" :class="reworkType === item.id ? 'text-primary' : 'text-grey-darken-1'">
                                    {{ item.description }}
                                </div>
                                <div v-if="item.activities.length > 0" class="mt-1">
                                    <v-chip v-for="activity in item.activities" 
                                        :key="activity.id" 
                                        class="mr-2" 
                                        density="comfortable"
                                        label
                                        :color="reworkType === item.id ? 'primary' : 'default'"
                                    >
                                        {{ activity.name }}
                                    </v-chip>
                                </div>
                            </div>
                        </template>
                    </v-radio>
                </div>
            </v-radio-group>
        </v-card-text>
        <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
                @click="close"
                color="error"
            >
                취소
            </v-btn>
            <v-btn
                :disabled="reworkType === ''"
                @click="submitRework"
                color="primary"
            >
                제출
            </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
export default {
    props: {
        reworkActivities: {
            type: Object,
            required: true,
            default: function () {
                return {
                    current: [],
                    reference: [],
                    all: []
                };
            }
        }
    },
    data() {
        return {
            reworkType: '',
            reworkItems: [
                {
                    id: 'current',
                    label: '현재 단계만', 
                    description: '선택된 작업 항목의 현재 단계만 다시 수행합니다. 다른 단계에는 영향을 주지 않습니다.',
                    activities: []
                },
                {
                    id: 'reference',
                    label: '현재 단계를 참조하는 다음 단계 포함', 
                    description: '현재 단계와 이를 참조하는 다음 단계들을 함께 다시 수행합니다. 연관된 작업들만 영향을 받습니다.',
                    activities: []
                },
                {
                    id: 'all',
                    label: '모든 다음 단계 포함', 
                    description: '현재 단계부터 시작하여 모든 후속 단계들을 다시 수행합니다.',
                    activities: []
                }
            ],
        }
    },
    computed: {
        currentActivityId() {
            if (this.reworkActivities.current.length > 0) {
                return this.reworkActivities.current[0].id;
            } else {
                return null;
            }
        }
    },
    mounted() {
        this.loadActivities();
    },
    methods: {
        loadActivities() {
            if (this.reworkActivities) {
                this.reworkItems.forEach(item => {
                    if (item.id === 'current') {
                        item.activities = this.reworkActivities.current;
                    } else if (item.id === 'reference') {
                        item.activities = this.reworkActivities.reference;
                    } else if (item.id === 'all') {
                        item.activities = this.reworkActivities.all;
                    }
                });
            }
        },
        close() {
            this.$emit('close');
        },
        submitRework() {
            const reworkActivities = this.reworkItems.find(item => item.id === this.reworkType).activities;
            this.$emit('submitRework', reworkActivities);
        }
    }
}
</script>