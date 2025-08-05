<template>
    <div>
        <v-card variant="outlined" class="mb-4">
            <v-card-title class="text-h6 cursor-pointer d-flex align-center justify-space-between" @click="toggleExpanded">
                <div class="d-flex align-center">
                    <v-icon class="mr-2" color="info">mdi-information-outline</v-icon>
                    참고 정보
                </div>
                <v-icon :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"></v-icon>
            </v-card-title>
            <v-expand-transition>
                <v-card-text v-show="expanded" class="pa-4 pt-0">
                    <div v-for="field in inputFields" :key="field.formId" class="mb-4">
                        <div>
                            <div class="text-subtitle-1 font-weight-medium">
                                <v-icon class="mr-2" size="small">mdi-form-select</v-icon>
                                {{ field.formId }}
                            </div>
                            <v-divider class="mb-3"></v-divider>
                            <v-row>
                                <v-col v-for="(value, key) in field.formValue" :key="key" cols="12">
                                    <div class="d-flex align-center">
                                        <div class="text-caption text-medium-emphasis mr-3">
                                            {{ key }}
                                        </div>
                                        <div class="text-body-2">
                                            {{ formatValue(value) }}
                                        </div>
                                    </div>
                                </v-col>
                            </v-row>
                        </div>
                    </div>
                </v-card-text>
            </v-expand-transition>
        </v-card>
    </div>
</template>

<script>
export default {
    props: {
        inputFields: Array,
    },
    data() {
        return {
            expanded: true, // 기본적으로 펼쳐진 상태
        }
    },
    methods: {
        toggleExpanded() {
            this.expanded = !this.expanded;
        },
        formatValue(value) {
            if (value === null || value === undefined) {
                return '';
            }
            if (typeof value === 'string') {
                return value;
            }
            if (typeof value === 'object') {
                if (Array.isArray(value)) {
                    return value.join(', ');
                }
                // 객체인 경우 JSON.stringify로 변환하되, 너무 길면 잘라서 표시
                const jsonString = JSON.stringify(value, null, 2);
                if (jsonString.length > 100) {
                    return jsonString.substring(0, 100) + '...';
                }
                return jsonString;
            }
            return String(value);
        },
    }
}
</script>