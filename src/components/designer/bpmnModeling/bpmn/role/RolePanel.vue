<template>
    <bpmn-common-panel
            v-model="value"
            :image="image"
            :is-read-only="readOnly"
            :width-style="widthStyle"
            @close="closePanel"
    >
        <template slot="name-panel">
            <v-text-field
                    v-model="value.name"
                    label="Pool/Lane (Role) Name"
                    autofocus
            ></v-text-field>
        </template>
        <template slot="edit-property">
            <v-radio-group v-model="isRoleDef" row>
                <v-radio
                        id="roleDef"
                        name="roleDef"
                        value="Human"
                        label="Human"
                ></v-radio>
                <v-radio
                        id="roleDef"
                        name="roleDef"
                        value="System"
                        label="System"
                ></v-radio>
            </v-radio-group>
            
            <div v-if="isRoleDef=='Human'">
                <v-radio-group v-model="value.roleResolutionContext._type" row style="margin-top: 0px !important;">
                    <v-radio
                            id="roleResolution"
                            name="roleResolution"
                            value="null"
                            label="None"
                            style="margin-right: 8px !important; font-size: 15px;"
                    ></v-radio>
                    <v-radio
                            id="roleResolution"
                            name="roleResolution"
                            value="org.uengine.five.overriding.IAMRoleResolutionContext"
                            label="Role Resolution By IAM Scope"
                            style="margin-right: 8px !important; font-size: 15px;"
                    ></v-radio>
                    <v-radio
                            id="roleResolution"
                            name="roleResolution"
                            value="org.uengine.kernel.DirectRoleResolutionContext"
                            label="Role Resolution By Direct user"
                            style="margin-right: 8px !important; font-size: 15px;"
                    ></v-radio>
                </v-radio-group>
                
                <v-text-field
                        v-if="value.roleResolutionContext._type == 'org.uengine.five.overriding.IAMRoleResolutionContext'"
                        v-model="value.roleResolutionContext.scope"
                        label="Scope Name"
                ></v-text-field>

                <v-text-field 
                        v-if="value.roleResolutionContext._type == 'org.uengine.kernel.DirectRoleResolutionContext'"
                        v-model="value.roleResolutionContext.endpoint"
                        label="User ID"
                ></v-text-field>
            </div>

            <div v-if="isRoleDef=='System'">
                <v-select
                        v-model="value.name"
                        :items="serviceIdList"
                        label="Select serviceId from eureka"
                ></v-select>
            </div>

            <!-- Assignment 섹션 (BPMN Pool/Lane 개념 기반) -->
        <div class="mt-4">
            <v-label class="font-weight-medium mb-2">Assignment</v-label>
            <DetailComponent :title="$t('UserTaskPanel.assigneeInfo')" />
            
            <!-- 경합 모드 사용 여부 (체크박스) -->
            <v-checkbox
                v-model="copyUengineProperties.useCompetingMode"
                :label="$t('UserTaskPanel.useCompetingMode')"
                :hint="$t('UserTaskPanel.useCompetingModeHint')"
                persistent-hint
                hide-details="auto"
                class="mb-2"
            ></v-checkbox>

            <!-- 경합 모드 활성화 시 표시되는 필드들 -->
            <div v-if="copyUengineProperties.useCompetingMode" class="mb-2">
                <!-- 경합 방식 선택 (Claim/Auto/LoadBalance) -->
                <v-select
                    v-model="copyUengineProperties.assignType"
                    :label="$t('UserTaskPanel.assignType')"
                    :hint="$t('UserTaskPanel.assignTypeHint')"
                    persistent-hint
                    :items="[
                        { title: $t('UserTaskPanel.direct'), value: 'direct', description: $t('UserTaskPanel.directDescription') },
                        { title: $t('UserTaskPanel.claim'), value: 'claim', description: $t('UserTaskPanel.claimDescription') },
                    ]"
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                    class="mb-2"
                >
                    <template v-slot:item="{ props, item }">
                        <v-list-item v-bind="props">
                            <v-list-item-subtitle v-if="item.raw.description">{{ item.raw.description }}</v-list-item-subtitle>
                        </v-list-item>
                    </template>
                </v-select>

                <!-- Assignee 직접 지정 (Camunda: assignee) -->
                <v-text-field
                    v-if="copyUengineProperties.assignType === 'direct'"
                    v-model="copyUengineProperties.assignee"
                    :label="$t('UserTaskPanel.assignee')"
                    :hint="$t('UserTaskPanel.assigneeHint')"
                    persistent-hint
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                    class="mb-2"
                ></v-text-field>

                <!-- Candidate Users SelectBox (Camunda: candidateUsers) -->
                <v-select
                    v-if="copyUengineProperties.assignType === 'claim'"
                    v-model="copyUengineProperties.candidateUsers"
                    :label="$t('UserTaskPanel.candidateUsers')"
                    :hint="$t('UserTaskPanel.candidateUsersHint')"
                    persistent-hint
                    :items="candidateUsers"
                    multiple
                    chips
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                    class="mb-2"
                ></v-select>

                <!-- Candidate Groups SelectBox (Camunda: candidateGroups) -->
                <v-select
                    v-if="copyUengineProperties.assignType === 'claim'"
                    v-model="copyUengineProperties.candidateGroups"
                    :label="$t('UserTaskPanel.candidateGroups')"
                    :hint="$t('UserTaskPanel.candidateGroupsHint')"
                    persistent-hint
                    :items="candidateGroups"
                    multiple
                    chips
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                ></v-select>
            </div>
        </div>
        </template>
    </bpmn-common-panel>
</template>

<script>
    import BpmnPropertyPanel from '../panel/BpmnPropertyPanel.vue'

    export default {
        mixins: [BpmnPropertyPanel],
        name: 'bpmn-role-panel',
        props: {
            serviceIds: Array,
            roleDef: String,
            roleResolution: String,
        },
        data() {
            return {
            }
        },
        created: function () {
            console.log(this.value)
            console.log(this._value)
        },
        mounted: function () {
        },
        watch: {
            "value.roleResolutionContext": function(newVal) {
                console.Console(newVal)
            }
        },
        computed: {
            serviceIdList: {
                get() {
                    return this.serviceIds
                },
                set(val) {
                    this.$emit('updateServiceIds', val);
                }
            },
            isRoleDef: {
                get() {
                    return this.roleDef
                },
                set(val) {
                    this.$emit('updateRoleDef', val);
                }
            },
            // isRoleResolution: {
            //     get() {
            //         return this.roleResolution
            //     },
            //     set(val) {
            //         this.$emit('updateRoleResolution', val);
            //     }
            // }
        },
        watch: {
        },
        methods: {
            closePanel() {
                this.navigationDrawer = false;
                this.$emit('updateServiceIds', this.serviceIds);
                this.$emit('updateRoleDef', this.roleDef);
                this.$emit('updateRoleResolution', this.roleResolution);
                this.$emit('close');
            },
        }
    }
</script>


<style lang="scss" rel="stylesheet/scss">

</style>

