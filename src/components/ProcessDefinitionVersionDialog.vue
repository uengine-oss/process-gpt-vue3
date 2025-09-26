<template>
    <div>
        <v-dialog v-model="isOpen" max-width="400" persistent>
            <v-card class="ma-0 pa-0">
                <v-row class="ma-0 pa-4 pb-0 align-center">
                    <v-card-title class="ma-0 pa-0">{{
                        isNew ? $t('ProcessDefinitionVersionDialog.title') : $t('ProcessDefinitionVersionDialog.title2')
                    }}</v-card-title>
                    <v-spacer></v-spacer>
                    <v-btn @click="close()" icon variant="text" density="comfortable"
                        style="width: 16px; height: 16px;"
                    >
                        <Icons :icon="'close'" :size="16" />
                    </v-btn>
                </v-row>
                <v-card-text class="ma-0 pa-4 pb-4 pt-0">
                    <v-switch v-model="isVersion"
                        :label="`${$t('ProcessDefinitionVersionDialog.minorUpdate')}: ${newVersion}`"
                        hide-details
                        color="primary"
                    ></v-switch>
                    <DetailComponent
                        :title="$t('ProcessDefinitionVersionDialog.versionDescriptionTitle')"
                    />
                    <div v-if="mode == 'ProcessGPT'">
                        <div v-if="isNew">
                            <v-text-field
                                v-model="information.proc_def_id"
                                :label="$t('ProcessDefinitionVersionDialog.id')"
                                :rules="idRules"
                                required
                                class="pb-2"
                            ></v-text-field>
                            <v-text-field
                                v-model="information.name"
                                :label="$t('ProcessDefinitionVersionDialog.name')"
                                :rules="[(v) => !!v || $t('ProcessDefinitionVersionDialog.nameRequired')]"
                                required
                                class="pb-2"
                            ></v-text-field>
                        </div>
                        <v-textarea class="process-definition-version-dialog-textarea"
                            v-if="isVersion"
                            v-model="information.message"
                            :label="$t('ProcessDefinitionVersionDialog.message')"
                            hide-details
                            auto-grows
                        ></v-textarea>
                    </div>
                    <div v-else>
                        <div v-if="isVersion">
                            <div v-if="isNew">
                                <v-text-field
                                    v-model="information.proc_def_id"
                                    :label="$t('ProcessDefinitionVersionDialog.id')"
                                    :rules="idRules"
                                    required
                                    class="pb-2"
                                ></v-text-field>
                                <v-text-field
                                    v-model="information.name"
                                    :label="$t('ProcessDefinitionVersionDialog.name')"
                                    :rules="[(v) => !!v || $t('ProcessDefinitionVersionDialog.nameRequired')]"
                                    required
                                    class="pb-2"
                                ></v-text-field>
                            </div>
                            <v-textarea
                                v-model="information.message"
                                :label="$t('ProcessDefinitionVersionDialog.message')"
                                hide-details
                                rows="3"
                            ></v-textarea>
                        </div>
                    </div>
                    <div v-if="mode == 'ProcessGPT'">
                        <v-checkbox
                            v-model="checkOptimize"
                            label="프로세스 정의 최적화 사용"
                            hide-details
                            color="primary"
                        ></v-checkbox>
                    </div>
                </v-card-text>
                <v-row class="ma-0 pa-4 pt-0">
                    <v-spacer></v-spacer>
                    <!-- <v-progress-circular v-if="!loading" color="primary" :size="25" indeterminate style="margin: 5px"></v-progress-circular> -->
                    <v-btn @click="save()"
                        :disabled="!validate()"
                        color="primary"
                        variant="elevated" 
                        class="rounded-pill"
                        density="compact"
                    >{{ $t('ProcessDefinitionVersionDialog.save') }}
                    </v-btn>
                </v-row>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();
// import xmljs from 'xml-js';
// import diff from 'deep-diff';
export default {
    name: 'ProcessDefinitionVersionDialog',
    components: {},
    props: {
        open: Boolean,
        process: Object,
        definition: Object,
        processName: String,
        useOptimize: Boolean
    },
    data: () => ({
        isVersion: false,
        isMajor: false, // default:false (minor)
        isRelease: false,
        isNew: false,
        information: {
            arcv_id: null,
            version: 0.0,
            name: null,
            proc_def_id: null,
            snapshot: null,
            diff: null,
            timeStamp: null,
            message: null,
            releaseName: null
        },
        isOpen: false, // inner var
        checkOptimize: false
    }),
    computed: {
        idRules() {
            return [
                (v) => !!v || this.$t('ProcessDefinitionVersionDialog.idRequired'),
                (v) => (v ? /^[a-z0-9_]+$/.test(v) : false) || this.$t('ProcessDefinitionVersionDialog.idRules')
            ];
        },
        newVersion() {
            // 4.13
            let major = Math.floor(this.information.version); // 4
            let minor = this.information.version.toString().includes('.') ? Number(this.information.version.toString().split('.')[1]) : 0; // 13

            if (this.isVersion) {
                major += 1;
                return Number(major).toFixed(1); // major 업데이트 시, major만 1 증가하고 minor를 0으로 초기화
            }
            minor += 1;
            return `${major}.${minor}`;
        },
        useLock() {
            if (this.mode == 'ProcessGPT') {
                return true;
            } else {
                return false;
            }
        },
        mode() {
            return window.$mode;
        },
    },
    watch: {
        useOptimize: {
            handler(newVal) {
                this.checkOptimize = newVal;
            },
        },
        checkOptimize: {
            handler(newVal) {
                this.$emit('update:useOptimize', newVal);
            },
        },
        open: {
            async handler(newVal) {
                if (newVal) {
                    await this.load();
                    this.isOpen = true;
                } else {
                    this.isOpen = false;
                }
            },
        },
        $route: function (newVal) {
            if (newVal) {
                this.load();
            }
        }
    },
    mounted() {
        this.checkOptimize = this.useOptimize;
    },
    methods: {
        async load() {
            var me = this;
            if (me.process && me.process.processDefinitionId) {
                me.isNew = false;
                var bpmn = null;
                try {
                    bpmn =
                        me.process.processDefinitionId != 'Unknown'
                            ? await backend.getRawDefinition(me.process.processDefinitionId, { type: 'bpmn' })
                            : null;
                } catch (e) {}
                if (bpmn) {
                    if (me.useLock) {
                        // GPT
                        let definitionInfo = await backend.getRawDefinition(me.process.processDefinitionId);
                        let versionInfo = await backend.getDefinitionVersions(me.process.processDefinitionId, {
                            sort: 'desc',
                            orderBy: 'timeStamp',
                            size: 1
                        });

                        if (versionInfo.length > 0) {
                            me.information = versionInfo[0];
                            me.information.name = me.processName ? me.processName : definitionInfo.name;
                            me.information.message = '';
                        } else {
                            me.information = {
                                arcv_id: definitionInfo.id,
                                version: 0.0,
                                name: me.processName ? me.processName : definitionInfo.name,
                                proc_def_id: definitionInfo.id,
                                snapshot: bpmn,
                                diff: null,
                                timeStamp: null,
                                message: null
                            };
                        }
                    } else {
                        let defId = me.$route.params.pathMatch.join('/');
                        if(me.process && me.process.processDefinitionId) {
                            defId = me.process.processDefinitionId;
                        }
                        let versionInfo = await backend.getDefinitionVersions(defId, {
                            sort: 'desc',
                            type: 'bpmn',
                            orderBy: 'timeStamp',
                            size: 1
                        });
                        console.log(versionInfo);
                        if(versionInfo) {
                            versionInfo.sort((a, b) => parseFloat(b.version) - parseFloat(a.version));
                            const highestVersion = versionInfo.length > 0 ? versionInfo[0].version : null;
                            me.information.version = highestVersion
                        } else {
                            me.information.version = "0.0"
                        }
                        
                        me.information.proc_def_id = defId
                        me.information.name = defId
                    }
                } else {
                    me.isNew = true;
                    me.information.proc_def_id = me.process.processDefinitionId;
                    me.information.name = me.process.processDefinitionName;
                }
            } else {
                me.isNew = true;
                me.isVersion = false;
                if (me.$route.query && me.$route.query.id && me.$route.query.name) {
                    me.information.id = me.$route.query.id;
                    me.information.name = me.$route.query.name;
                    me.information.message = '';
                } else {
                    me.information = {
                        arcv_id: '',
                        version: 0.0,
                        name: me.processName ? me.processName : '',
                        proc_def_id: '',
                        snapshot: '',
                        diff: '',
                        timeStamp: '',
                        message: ''
                    };
                }
            }
            // me.isOpen = true;
        },
        save() {
            var me = this;
            this.$try({
                context: me,
                action: async () => {
                    if (!me.information.proc_def_id) return; // 항상 ID는 필수.
                    if (me.isNew && !me.information.name) return; // 초기 저장시에는 이름 필수.

                    me.$emit('save', {
                        arcv_id: me.process
                            ? `${me.process.processDefinitionId}_${me.newVersion}`
                            : `${me.information.proc_def_id}_${me.newVersion}`,
                        version: this.isVersion ? me.newVersion : null,
                        name: me.information.name,
                        proc_def_id: me.information.proc_def_id,
                        prevSnapshot: me.information.snapshot,
                        prevDiff: me.information.diff,
                        type: 'bpmn',
                        message: me.information.message,
                        release: me.isRelease,
                        releaseName: me.information.releaseName
                    });
                }
            });
        },
        close() {
            this.$emit('close', false);
        },
        validate() {
            // idRules 검증
            if (this.information.proc_def_id) {
                for (const rule of this.idRules) {
                    const result = rule(this.information.proc_def_id);
                    if (result !== true) {
                        return false;
                    }
                }
            } else {
                return false;
            }
            if (this.information.name) {
                if (this.information.name.length < 1) {
                    return false; 
                }
            } else {
                return false;
            }
            return true;
        }
    }
};
</script>
