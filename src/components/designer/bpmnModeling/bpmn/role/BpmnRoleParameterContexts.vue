<template>
    <div>
        <!-- definition id 가 없어도 데이터가 있다면 최선을 다하여 출력하자 -->
        <!--<div v-if="calleeDefinitionId">-->
        <div v-for="(roleBinding, idx) in copyRoleBindings" :key="idx">
            <v-row>
                <v-col cols="3">
                    <div>
                        <label>Callee Roles</label>
                        <v-select name="input" id="input" v-model="roleBinding.argument">
                            <!-- <v-option v-for="role in calleeDefinition.roles" :key="role.name" :value="role.name">
                                {{ role.name }}
                            </v-option> -->
                        </v-select>
                        <v-input v-model="roleBinding.argument"></v-input>
                    </div>
                </v-col>

                <v-col cols="3">
                    <div>
                        <label>연결 방향</label>
                        <v-select v-model="roleBinding.direction" :items="['IN-OUT', 'IN', 'OUT']">
                            <!-- <md-option value="in-out">IN-OUT</md-option>
                            <md-option value="in">IN</md-option>
                            <md-option value="out">OUT</md-option> -->
                        </v-select>
                    </div>
                </v-col>
                <v-col cols="3">
                    <div>
                        <label>Caller Roles</label>
                        <v-select v-model="roleBinding.role.name" :items="definitionRoles" item-title="name"
                            item-value="name">
                            <!-- <md-option v-for="role in definition.roles" :key="role.name" :value="role.name">
                                {{ role.name }}
                            </md-option> -->
                        </v-select>
                    </div>
                </v-col>
                <v-col>
                    <v-checkbox v-model="roleBinding.split">Split</v-checkbox>
                </v-col>

                <v-col>
                    <v-btn icon flat v-on:click="remove(roleBinding)">
                        <TrashIcon stroke-width="1.5" size="20" class="text-error" />
                    </v-btn>
                </v-col>
            </v-row>
        </div>

        <v-btn v-on:click="add">매핑 추가</v-btn>
    </div>
    <!--</div>-->
</template>

<script>

export default {
    name: "bpmn-role-parameter-contexts",
    props: {
        roleBindings: Array,
        definitionRoles: Array,
        // calleeDefinitionId: String
    },
    data: function () {
        return {
            copyRoleBindings: this.roleBindings ? this.roleBindings : []
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
    created: function () {

    },
    methods: {
        add: function () {
            this.copyRoleBindings.push({
                direction: 'IN-OUT',
                role: {
                    _type: "org.uengine.kernel.Role",
                    name: ''
                },
                argument: ''  //TODO: object path differ from ParameterContext
            })
        },
        remove: function (parameterContext) {
            //TODO: find and remove
            this.copyRoleBindings.splice(this.copyRoleBindings.indexOf(parameterContext), 1);
        }
    }
}

</script>
