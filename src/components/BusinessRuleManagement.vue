<template>
    <div style="height: 100%; width: 100%;">
        <div class="d-flex justify-start align-center pa-4">
            <h4 class="text-h5">비즈니스 규칙 관리</h4>
            <p class="text-body-1 text-medium-emphasis ml-4">DMN 목록을 관리할 수 있습니다.</p>
        </div>
        <div class="px-4">
            <v-card variant="flat">
                <v-divider></v-divider>
                <v-list v-if="dmnList.length > 0" density="comfortable">
                    <v-list-item
                        v-for="dmn in dmnList"
                        :key="dmn.id || dmn.name"
                    >
                        <v-list-item-title>{{ dmn.name }}</v-list-item-title>
                        <template #append>
                            <v-btn variant="text" @click="onEdit(dmn)">
                                <v-icon icon="mdi-pencil"></v-icon>
                            </v-btn>
                        </template>
                    </v-list-item>
                </v-list>
                <div v-else class="py-8 text-medium-emphasis text-center">
                    등록된 DMN이 없습니다.
                </div>
            </v-card>
        </div>
    </div>
</template>

<script>
export default {
    name: 'BusinessRuleManagement',
    props: {
        ownerInfo: Object,
        dmnList: Array
    },
    data() {
        return {
        }
    },
    async mounted() {
    },
    methods: {
        onEdit(dmn) {
            if (dmn && dmn.id) {
                this.$emit('edit-dmn', dmn.id);
            }
        }
    }
}
</script>

