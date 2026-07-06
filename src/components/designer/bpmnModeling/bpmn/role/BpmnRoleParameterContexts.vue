<template>
    <div class="lane-role-mapping">
        <div v-if="copyRoleBindings.length === 0" class="empty-state">
            등록된 lane 역할 매핑이 없습니다.
        </div>

        <div v-for="(roleBinding, idx) in copyRoleBindings" :key="idx" class="mapping-row">
            <v-select
                v-if="!isSub"
                v-model="roleBinding.role.name"
                class="mapping-select"
                label="상위 프로세스 lane"
                :items="definitionRoles"
                item-title="name"
                item-value="name"
                density="compact"
                variant="outlined"
                hide-details
                :disabled="isViewMode"
            />
            <v-text-field
                v-else
                v-model="roleBinding.role.name"
                class="mapping-select"
                label="상위 프로세스 lane"
                density="compact"
                variant="outlined"
                hide-details
                :disabled="isViewMode"
            />

            <v-select
                v-model="roleBinding.direction"
                class="direction-select"
                :items="directionOptions"
                item-title="title"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                :disabled="isViewMode"
            />

            <v-select
                v-model="roleBinding.argument"
                class="mapping-select"
                label="하위 프로세스 lane"
                :items="calleeDefinitionRoles"
                density="compact"
                variant="outlined"
                hide-details
                :disabled="isViewMode"
            />

            <v-btn icon flat :disabled="isViewMode" @click="remove(roleBinding)">
                <TrashIcon stroke-width="1.5" size="20" class="text-error" />
            </v-btn>
        </div>

        <div v-for="(roleBinding, idx) in copyRoleBindings" :key="`summary-${idx}`" class="mapping-summary">
            상위 프로세스의 '{{ roleBinding.role?.name || '-' }}' 담당자를 하위 프로세스의 '{{ roleBinding.argument || '-' }}' 담당자로 사용합니다.
        </div>

        <v-btn text color="primary" variant="flat" rounded class="add-button" :disabled="isViewMode" @click="add">
            <v-icon class="mr-2" style="padding-top: 3px">mdi-plus</v-icon>
            <span>{{ $t('BpmnRoleParameterContexts.addMapping') }}</span>
        </v-btn>
    </div>
</template>

<script>
export default {
    name: 'bpmn-role-parameter-contexts',
    props: {
        isSub: {
            type: Boolean,
            default: false
        },
        roleBindings: Array,
        definitionRoles: Array,
        calleeDefinitionRoles: Array,
        isViewMode: Boolean
        // calleeDefinitionId: String
    },
    data: function () {
        return {
            copyRoleBindings: this.roleBindings ? this.roleBindings : [],
            directionOptions: [
                { title: '<', value: 'OUT' },
                { title: '<>', value: 'IN-OUT' },
                { title: '>', value: 'IN' }
            ]
        };
    },
    watch: {
        // copyRoleBindings: {
        //     handler: function (after, before) {
        //         this.$emit('update:roleBindings', after);
        //     },
        //     deep: true
        // },
    },
    created: function () {},
    methods: {
        iconForDirection: function (direction) {
            if (direction == 'IN') return 'mdi-arrow-left';
            else if (direction == 'OUT' || direction == 'OUT ') return 'mdi-arrow-right';
            else return 'mdi-arrow-left-right';
        },
        add: function () {
            this.copyRoleBindings.push({
                direction: 'IN',
                role: {
                    name: ''
                },
                argument: '' //TODO: object path differ from ParameterContext
            });
        },
        remove: function (parameterContext) {
            //TODO: find and remove
            this.copyRoleBindings.splice(this.copyRoleBindings.indexOf(parameterContext), 1);
        }
    }
};
</script>

<style scoped>
.lane-role-mapping {
    width: 100%;
}

.mapping-row {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) 96px minmax(220px, 1fr) 40px;
    align-items: center;
    gap: 12px;
    margin: 6px 0 8px 0;
    max-width: 760px;
}

.mapping-select {
    min-width: 0;
    width: 100%;
}

.direction-select {
    min-width: 96px;
    width: 96px;
}

.mapping-summary {
    margin: 0 0 12px 2px;
    color: rgba(0, 0, 0, 0.6);
    font-size: 12px;
}

.empty-state {
    padding: 16px 4px;
    color: rgba(0, 0, 0, 0.54);
    font-size: 13px;
}

.add-button {
    margin: 8px 0 20px 0;
}

@media (max-width: 760px) {
    .mapping-row {
        grid-template-columns: 1fr;
    }

    .direction-select {
        width: 100%;
    }
}
</style>
