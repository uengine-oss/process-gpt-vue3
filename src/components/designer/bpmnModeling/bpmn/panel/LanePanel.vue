<template>
    <div>
        <div class="included pa-4 pt-0" style="margin-bottom: 22px">
            <v-row class="ma-0 pa-0 align-center">
                <div>{{$t('LanePanel.selectRoleType')}}</div>

                <DetailComponent
                    :title="$t('LanePanel.radioDescriptionTitle')"
                    :details="radioDescription"
                />
            </v-row>
            <v-card variant="outlined" class="pa-2" style="border-radius:8px !important;">
                <v-radio-group v-model="type" row style="margin-top: 0px !important">
                    <v-radio
                        v-for="option in roleOptions"
                        :key="option.value"
                        :value="option.value"
                        :label="$t(option.label)"
                        style="margin-right: 8px !important; font-size: 15px"
                    ></v-radio>
                </v-radio-group>
                <v-text-field
                    v-if="role && role.resolutionRule"
                    v-model="role.resolutionRule"
                    :label="$t('LanePanel.resolutionRule')"
                    class="mt-4"
                ></v-text-field>

                <v-text-field
                    v-if="type == 'org.uengine.five.overriding.IAMRoleResolutionContext'"
                    v-model="copyUengineProperties.roleResolutionContext.scope"
                    :label="$t('LanePanel.scopeName')"
                    class="mt-4"
                ></v-text-field>

                <!-- Organization/Group Selection -->
                <div v-if="type == 'Organization'">
                    <v-autocomplete
                        v-model="selectedOrganization"
                        :items="organizationOptions"
                        :label="$t('LanePanel.selectOrganization')"
                        item-title="name"
                        item-value="id"
                        return-object
                        clearable
                        class="mt-4"
                        variant="outlined"
                        density="comfortable"
                        :loading="loadingOrganizations"
                    >
                        <template v-slot:item="{ item, props }">
                            <v-list-item v-bind="props">
                                <template v-slot:prepend>
                                    <v-icon :color="item.raw.type === 'group' ? 'primary' : 'grey'" size="20" class="mr-2">
                                        {{ item.raw.type === 'group' ? 'mdi-account-group' : 'mdi-account-multiple' }}
                                    </v-icon>
                                </template>
                                <template v-slot:append>
                                    <v-chip size="x-small" :color="item.raw.type === 'group' ? 'primary' : 'grey'" variant="tonal">
                                        {{ item.raw.type === 'group' ? $t('LanePanel.group') : $t('LanePanel.team') }}
                                    </v-chip>
                                </template>
                            </v-list-item>
                        </template>
                    </v-autocomplete>
                </div>

                <div v-if="isDirectUser">
                    <div v-if="isProcessGPT">
                        <user-select-field
                            v-model="copyUengineProperties.roleResolutionContext.endpoint"
                            :name="$t('LanePanel.userID')"
                            :item-value="'id'"
                            :hide-details="true"
                            :use-agent="true"
                            class="mt-4"
                        ></user-select-field>
                    </div>
                    <div v-else>
                        <v-text-field
                            v-model="copyUengineProperties.roleResolutionContext.endpoint"
                            :label="$t('LanePanel.userID')"
                            class="mt-4"
                        ></v-text-field>
                    </div>
                </div>
            </v-card>
        </div>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';
import UserSelectField from '@/components/ui/field/UserSelectField.vue';

export default {
    name: 'lane-panel',
    components: {
        UserSelectField
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        processDefinition: Object,
        element: Object,
    },
    created() {
        // console.log(this.element)
        // this.uengineProperties = JSON.parse(this.element.extensionElements.values[0].json)
        // 필수 uEngine Properties의 key가 없다면 작업.
        // Object.keys(this.requiredKeyLists).forEach((key) => {
        //     this.ensureKeyExists(this.copyUengineProperties, key, this.requiredKeyLists[key]);
        // });
        // if(this.processDefinition && this.processDefinition.roles && this.processDefinition.roles.length > 0){
        //     const role = this.processDefinition.roles.find(role => role.name === this.element.name);
        //     if (role) {
        //         this.role = role
        //     } else {
        //         console.log('Role not found');
        //     }
        // }

    },
    data() {
        return {
            definitions: [],
            definitionRoles: [],
            calleeDefinitionRoles: [],
            copyUengineProperties: this.uengineProperties,
            name: '',
            checkpoints: [],
            editCheckpoint: false,
            checkpointMessage: {
                $type: 'uengine:Checkpoint',
                checkpoint: ''
            },
            code: '',
            description: '',
            selectedDefinition: '',
            bpmnModeler: null,
            stroage: null,
            editParam: false,
            paramKey: '',
            paramValue: '',
            definitionCnt: 0,
            type: 'None',
            role: null,
            roleOptions: [
                { value: 'None', label: 'LanePanel.none' },
                { value: 'Organization', label: 'LanePanel.organization' },
                { value: 'org.uengine.five.overriding.IAMRoleResolutionContext', label: 'LanePanel.IAMScope' },
                { value: 'org.uengine.kernel.DirectRoleResolutionContext', label: 'LanePanel.DirecUser' },
                { value: 'org.uengine.kernel.ExternalCustomerRoleResolutionContext', label: 'LanePanel.externalCustomer' }
            ],
            radioDescription: [
                {
                    title: 'LanePanel.radioDescriptionSubTitle'
                }
            ],

            isDirectUser: false,

            // Organization/Group selection
            selectedOrganization: null,
            organizationOptions: [],
            loadingOrganizations: false,
        };
    },
    async mounted() {
        let me = this;
        this.checkType();
        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        let def = this.bpmnModeler.getDefinitions();
        const processElement = def.rootElements.filter((element) => element.$type === 'bpmn:Process');
        if (!processElement) {
            console.error('bpmn:Process element not found');
            return;
        }
        processElement.forEach((process) => {
            (process.laneSets || []).forEach((laneSet) => {
                (laneSet.lanes || []).forEach((lane) => {
                    // 레인의 이름을 배열에 추가합니다.
                    if (lane?.name?.length > 0) me.calleeDefinitionRoles.push(lane.name);
                });
            });
        });
        // // bpmn2:process 요소 내의 bpmn2:extensionElements 요소를 찾거나 새로 생성합니다.
        const backend = BackendFactory.createBackend();
        const value = await backend.listDefinition();
        if (value) {
            this.definitions = value;
        }

        // Load organization options (teams + groups)
        await this.loadOrganizationOptions();
    },
    computed: {
        isProcessGPT() {
            return window.$mode == 'ProcessGPT'
        }
    },
    watch: {
        type(after, before) {
            this.isDirectUser = false;
            if (after == 'org.uengine.five.overriding.IAMRoleResolutionContext') {
                if(!this.copyUengineProperties.roleResolutionContext) this.copyUengineProperties.roleResolutionContext = {}
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.five.overriding.IAMRoleResolutionContext';
                if(!this.copyUengineProperties.roleResolutionContext.scope) this.copyUengineProperties.roleResolutionContext.scope = ''
            } else if (after == 'org.uengine.kernel.DirectRoleResolutionContext') {
                this.isDirectUser = true;
                if(!this.copyUengineProperties.roleResolutionContext) this.copyUengineProperties.roleResolutionContext = {}
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.kernel.DirectRoleResolutionContext';
                if(!this.copyUengineProperties.roleResolutionContext.endpoint) this.copyUengineProperties.roleResolutionContext.endpoint = ''
            } else if (after == 'None') {
                if (this.copyUengineProperties.roleResolutionContext) {
                    delete this.copyUengineProperties.roleResolutionContext;
                }
                this.selectedOrganization = null;
            } else if (after == 'org.uengine.kernel.ExternalCustomerRoleResolutionContext') {
                if(!this.copyUengineProperties.roleResolutionContext) this.copyUengineProperties.roleResolutionContext = {}
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.kernel.ExternalCustomerRoleResolutionContext';
                if(!this.copyUengineProperties.roleResolutionContext.endpoint) this.copyUengineProperties.roleResolutionContext.endpoint = 'external_customer'
            } else if (after == 'Organization') {
                if(!this.copyUengineProperties.roleResolutionContext) this.copyUengineProperties.roleResolutionContext = {}
                this.copyUengineProperties.roleResolutionContext._type = 'Organization';
                // Restore selected organization if exists
                if (this.copyUengineProperties.roleResolutionContext.organizationId) {
                    const savedOrg = this.organizationOptions.find(
                        opt => opt.id === this.copyUengineProperties.roleResolutionContext.organizationId
                    );
                    if (savedOrg) {
                        this.selectedOrganization = savedOrg;
                    }
                }
            }
        },
        selectedOrganization(newVal) {
            if (this.type === 'Organization' && this.copyUengineProperties.roleResolutionContext) {
                if (newVal) {
                    this.copyUengineProperties.roleResolutionContext.organizationId = newVal.id;
                    this.copyUengineProperties.roleResolutionContext.organizationName = newVal.name;
                    this.copyUengineProperties.roleResolutionContext.organizationType = newVal.type;
                    // Phase 4-4: Auto-set Lane name from Organization selection
                    this.updateLaneName(newVal.name);
                } else {
                    delete this.copyUengineProperties.roleResolutionContext.organizationId;
                    delete this.copyUengineProperties.roleResolutionContext.organizationName;
                    delete this.copyUengineProperties.roleResolutionContext.organizationType;
                }
            }
        }
    },
    methods: {
        checkType() {
            if (!this.copyUengineProperties.roleResolutionContext) {
                this.type = 'None';
            } else if (this.copyUengineProperties.roleResolutionContext._type == 'org.uengine.kernel.DirectRoleResolutionContext') {
                this.type = 'org.uengine.kernel.DirectRoleResolutionContext';
                this.endpoint = this.copyUengineProperties.roleResolutionContext.endpoint
            } else if (this.copyUengineProperties.roleResolutionContext._type == 'org.uengine.five.overriding.IAMRoleResolutionContext') {
                this.type = 'org.uengine.five.overriding.IAMRoleResolutionContext';
                this.scope = this.copyUengineProperties.roleResolutionContext.scope
            } else if (this.copyUengineProperties.roleResolutionContext._type == 'org.uengine.kernel.ExternalCustomerRoleResolutionContext') {
                this.type = 'org.uengine.kernel.ExternalCustomerRoleResolutionContext';
                this.endpoint = this.copyUengineProperties.roleResolutionContext.endpoint
            } else if (this.copyUengineProperties.roleResolutionContext._type == 'Organization') {
                this.type = 'Organization';
                // Restore selected organization after options are loaded
                if (this.copyUengineProperties.roleResolutionContext.organizationId) {
                    this.$nextTick(() => {
                        const savedOrg = this.organizationOptions.find(
                            opt => opt.id === this.copyUengineProperties.roleResolutionContext.organizationId
                        );
                        if (savedOrg) {
                            this.selectedOrganization = savedOrg;
                        }
                    });
                }
            }
        },
        async loadOrganizationOptions() {
            this.loadingOrganizations = true;
            const supabase = window.$supabase;
            const tenantId = window.$tenantName || 'default';

            try {
                const options = [];

                // 1. Load teams from organization chart
                const { data: orgData, error: orgError } = await supabase
                    .from('configuration')
                    .select('value')
                    .eq('key', 'organization')
                    .eq('tenant_id', tenantId)
                    .single();

                if (!orgError && orgData?.value) {
                    const orgValue = typeof orgData.value === 'string' ? JSON.parse(orgData.value) : orgData.value;
                    const chart = orgValue.chart || orgValue;
                    const teams = this.extractTeamsFromOrgChart(chart);
                    teams.forEach(team => {
                        options.push({
                            id: team.id,
                            name: team.name,
                            type: 'team'
                        });
                    });
                }

                // 2. Load org-chart-groups
                const { data: groupsData, error: groupsError } = await supabase
                    .from('org_chart_groups')
                    .select('id, name')
                    .eq('tenant_id', tenantId);

                if (!groupsError && groupsData) {
                    groupsData.forEach(group => {
                        options.push({
                            id: group.id,
                            name: group.name,
                            type: 'group'
                        });
                    });
                }

                this.organizationOptions = options;

                // Restore selection after loading
                if (this.type === 'Organization' && this.copyUengineProperties.roleResolutionContext?.organizationId) {
                    const savedOrg = options.find(
                        opt => opt.id === this.copyUengineProperties.roleResolutionContext.organizationId
                    );
                    if (savedOrg) {
                        this.selectedOrganization = savedOrg;
                    }
                }
            } catch (error) {
                console.error('Failed to load organization options:', error);
            } finally {
                this.loadingOrganizations = false;
            }
        },
        extractTeamsFromOrgChart(node) {
            const teams = [];
            const traverse = (n) => {
                if (!n) return;
                if (n.data?.isTeam) {
                    teams.push({
                        id: n.id,
                        name: n.data.name || n.id
                    });
                }
                if (n.children) {
                    n.children.forEach(child => traverse(child));
                }
            };
            traverse(node);
            return teams;
        },
        // Phase 4-4: Update Lane name using modeling API
        updateLaneName(name) {
            if (!name || !this.bpmnModeler || !this.element) return;
            try {
                const modeling = this.bpmnModeler.get('modeling');
                const elementRegistry = this.bpmnModeler.get('elementRegistry');
                const laneElement = elementRegistry.get(this.element.id);
                if (laneElement) {
                    modeling.updateLabel(laneElement, name);
                }
            } catch (e) {
                console.warn('[LanePanel] updateLaneName failed:', e);
            }
        },
        ensureKeyExists(obj, key, defaultValue) {
            console.log(key);
            console.log(obj.hasOwnProperty(key));

            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }

            return obj;
        },
        
        addCheckpoint() {
            this.copyUengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint });
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
        }
    }
};
</script>
