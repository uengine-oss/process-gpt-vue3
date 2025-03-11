<!-- Start Generation Here -->
<template>
    <div>
        <v-dialog v-model="permissionDialogStatus"
            max-width="400px" 
            persistent
        >
            <v-card class="pa-4">
                <v-row class="ma-0 pa-0">
                    <v-card-title class="ma-0 pa-0">권한 설정</v-card-title>
                    <v-spacer></v-spacer>
                    <v-btn icon class="ml-auto" variant="text" @click="close" density="compact">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-row>
                <div class="delete-input-details">
                    <v-switch v-model="everyOne"
                        label="모두"
                        color="primary"
                    ></v-switch>
                </div>
                <div v-if="!everyOne">
                    <v-autocomplete
                        v-model="selectedItems"
                        :items="combinedList"
                        label="검색"
                        variant="outlined"
                        multiple
                        chips
                        closable-chips
                    >
                        <template v-slot:chip="{ item }">
                            <v-chip>{{ item.title }}</v-chip>
                        </template>
                    </v-autocomplete>
                    <v-select
                        v-model="selectedFilteredRole"
                        :items="roleOptions"
                        label="권한 선택"
                        multiple
                        chips
                        closable-chips
                    ></v-select>
                </div>
                <v-row class="ma-0 pa-0">
                    <v-spacer></v-spacer>
                    <v-btn color="primary">저장</v-btn>
                </v-row>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
export default {
    props: {
        permissionDialogStatus: Boolean
    },
    data() {
        return {
            everyOne: false,
            selectedItems: [],
            emailList: [],
            selectedFilteredDepartment: [],
            roleOptions: ['관리 권한', '쓰기 권한', '보기 권한'],
            selectedFilteredRole: [],
            emailOptions: [
                'user1@example.com', 'user2@example.com', 'user3@example.com',
                'user4@example.com', 'user5@example.com', 'user6@example.com',
                'user7@example.com', 'user8@example.com', 'user9@example.com',
                'user10@example.com'
            ],
            departmentOptions: [
                '현장 관리', '설계 팀', '안전 관리', '품질 관리', '재무 관리',
                '인사 관리', '조달 관리', '계약 관리', '프로젝트 계획', '리스크 관리'
            ]
        };
    },
    computed: {
        combinedList() {
            return [...this.emailOptions, ...this.departmentOptions];
        }
    },
    watch: {
        selectedItems(newItems) {
            this.emailList = newItems.filter(item => this.emailOptions.includes(item));
            this.selectedFilteredDepartment = newItems.filter(item => this.departmentOptions.includes(item));
        }
    },
    methods: {
        close() {
            this.$emit('close:permissionDialogStatus', false);
            this.everyOne = false;
            this.selectedItems = [];
            this.emailList = [];
            this.selectedFilteredDepartment = [];
            this.selectedFilteredRole = [];
        },
        remove(item) {
            this.selectedItems = this.selectedItems.filter(i => i !== item);
        }
    },
};
</script>

<style scoped>
</style>
<!-- End Generation Here -->

