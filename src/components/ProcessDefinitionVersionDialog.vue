<template>
    <div>
        <v-dialog v-model="isOpen" max-width="400" @click:outside="close()">
            <v-card>
                <v-row class="ma-0 pa-2">
                    <v-card-title>{{
                        isNew ? $t('ProcessDefinitionVersionDialog.title') : $t('ProcessDefinitionVersionDialog.title2')
                    }}</v-card-title>
                    <v-spacer></v-spacer>
                    <v-btn @click="close()" icon variant="text" density="comfortable">
                        <Icons :icon="'close'" :size="16" />
                    </v-btn>
                </v-row>
                <v-card-text>
                    <v-switch v-model="isVersion" color="primary" :label="`${$t('ProcessDefinitionVersionDialog.update')}`"></v-switch>
                    <div v-if="isVersion">
                        <v-switch
                            v-model="isMajor"
                            :label="
                                this.isMajor
                                    ? `${$t('ProcessDefinitionVersionDialog.majorUpdate')}: ${newVersion}`
                                    : `${$t('ProcessDefinitionVersionDialog.minorUpdate')}: ${newVersion}`
                            "
                            color="primary"
                            :disabled="isNew"
                            hide-details
                        ></v-switch>
                        <v-switch
                            v-model="isRelease"
                            :label="`${$t('ProcessDefinitionVersionDialog.release')}`"
                            color="primary"
                            :disabled="isNew"
                            hide-details
                        ></v-switch>
                        <div v-if="isNew">
                            <v-text-field
                                v-model="information.proc_def_id"
                                :label="$t('ProcessDefinitionVersionDialog.id')"
                                :rules="[(v) => !!v || 'ID is required']"
                                required
                                class="pb-2"
                            ></v-text-field>
                            <v-text-field
                                v-model="information.name"
                                :label="$t('ProcessDefinitionVersionDialog.name')"
                                :rules="[(v) => !!v || 'Name is required']"
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
                </v-card-text>
                <v-row class="ma-0 pa-4 pt-0 pr-5">
                    <v-spacer></v-spacer>
                    <v-btn v-if="!loading" @click="save()" color="primary" rounded>{{ $t('ProcessDefinitionVersionDialog.save') }}</v-btn>
                    <v-progress-circular v-if="loading" color="primary" :size="25" indeterminate style="margin: 5px"></v-progress-circular>
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
        loading: Boolean,
        processName: String
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
            message: null
        },
        isOpen: false // inner var
    }),
    computed: {
        newVersion() {
            // 4.13
            let major = Math.floor(this.information.version); // 4
            let minor = this.information.version.toString().includes('.') ? Number(this.information.version.toString().split('.')[1]) : 0; // 13

            if (this.isMajor) {
                major += 1;
                return Number(major).toFixed(1); // major 업데이트 시, major만 1 증가하고 minor를 0으로 초기화
            }
            minor += 1;
            return `${major}.${minor}`;
        },
        useLock() {
            if (window.$mode == 'ProcessGPT') {
                return true;
            } else {
                return false;
            }
        }
    },
    watch: {
        open: function (newVal) {
            if (newVal) {
                this.load();
            } else {
                this.isOpen = false;
            }
        },
        $route: function (newVal) {
            if (newVal) {
                if (this.isOpen) {
                    this.load();
                }
            }
        }
    },
    created() {},
    methods: {
        load() {
            var me = this;
            this.$try({
                context: me,
                action: async () => {
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
                                // Uengine
                                me.information.proc_def_id = me.$route.params.pathMatch.join('/');
                                me.information.name = me.$route.params.pathMatch.join('/');
                            }
                        } else {
                            me.isNew = true;
                            me.information.proc_def_id = me.process.processDefinitionId;
                            me.information.name = me.process.processDefinitionName;
                        }
                    } else {
                        me.isNew = true;
                        if (me.$route.query && me.$route.query.id && me.$route.query.name) {
                            me.information.id = me.$route.query.id;
                            me.information.name = me.$route.query.name;
                            me.information.message = '';
                        }
                    }
                    me.isOpen = true;
                }
            });
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
                        message: me.information.message
                    });
                }
            });
        },
        close() {
            this.$emit('close', false);
        }
    }
};
</script>
