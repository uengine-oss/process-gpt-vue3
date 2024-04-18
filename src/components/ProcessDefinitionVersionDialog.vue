<template>
    <div>
        <v-dialog v-model="isOpen" max-width="400">
            <v-card>
                <v-card-title class="ma-0 pa-0" style="padding: 15px 0px 0px 25px !important;">{{ isNew ? 'Save Definition' : 'Version Up'}}</v-card-title>
                <v-btn icon style="position:absolute; right:5px; top:5px;" @click="close()">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
                <v-card-text>
                    <v-col>
                        <v-switch v-model="isMajor"
                            :label="this.isMajor ? `Major Update: ${newVersion}` : `Minor Update: ${newVersion}`"
                            color="primary" :disabled="isNew" hide-details></v-switch>
                        <v-text-field v-if="isNew" v-model="information.proc_def_id" label="ID"
                            :rules="[v => !!v || 'ID is required']" required></v-text-field>
                        <v-text-field v-if="isNew" v-model="information.name" label="Name" :rules="[v => !!v || 'Name is required']"
                            required></v-text-field>
                    </v-col>

                </v-card-text>
                <v-card-actions style="justify-content: right;">
                    <v-btn v-if="!loading" @click="save()"> SAVE </v-btn>
                    <v-progress-circular v-if="loading" color="primary" :size="25" indeterminate
                        style="margin: 5px;"></v-progress-circular>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
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
    },
    data: () => ({
        storage: null,
        isMajor: false, // default:false (minor)
        isNew: false,
        information: {
            arcv_id: null,
            version: 0.0,
            name: null,
            proc_def_id: null,
            snapshot: null,
            diff: null,
            timeStamp: null
        },
        isOpen: false, // inner var
    }),
    computed: {
        newVersion() {
            // 4.13
            let major = Math.floor(this.information.version); // 4
            let minor = this.information.version.toString().includes('.') ? Number(this.information.version.toString().split('.')[1]) : 0; // 13

            if (this.isMajor) {
                major += 1;
                return Number(major).toFixed(1) // major 업데이트 시, major만 1 증가하고 minor를 0으로 초기화
            }
            minor += 1;
            return `${major}.${minor}`
        },
    },
    watch: {
        "open": function (newVal) {
            if (newVal) {
                this.load();
            } else {
                this.isOpen = false
            }
        }
    },
    created() {
        var me = this
        me.storage = StorageBaseFactory.getStorage();
    },
    methods: {
        load() {
            var me = this
            this.$try({
                context: me,
                action: async () => {
                    if (me.process) {
                        me.isNew = false
                        let result = await me.storage.list(`proc_def_arcv`, {
                            sort: 'desc',
                            orderBy: 'timeStamp',
                            size: 1,
                            match: { 'proc_def_id': me.process.processDefinitionId }
                        })
                        if (result.length > 0) {
                            me.information = result[0]
                        } else {
                            me.isNew = true
                            me.information.proc_def_id = me.process.processDefinitionId;
                            me.information.name = me.process.processDefinitionName;
                        }
                    } else {
                        me.isNew = true
                        if (me.$route.query && me.$route.query.id && me.$route.query.name) {
                            me.information.id = me.$route.query.id;
                            me.information.name = me.$route.query.name;
                        }
                    }
                    me.isOpen = true
                }
            })
        },
        save() {
            var me = this
            this.$try({
                context: me,
                action: async () => {
                    if (!me.information.proc_def_id) return; // 항상 ID는 필수.
                    if (me.isNew && !me.information.name) return; // 초기 저장시에는 이름 필수.

                    me.$emit('save', {
                        arcv_id: me.process ? `${me.process.processDefinitionId}_${me.newVersion}` : `${me.information.proc_def_id}_${me.newVersion}`,
                        version: Number(me.newVersion),
                        name: me.information.name,
                        proc_def_id: me.process ? me.process.processDefinitionId : me.information.proc_def_id,
                        prevSnapshot: me.information.snapshot,
                        prevDiff: me.information.diff,
                    })
                },
                successMsg: '저장되었습니다.'
            })
        },
        close() {
            this.$emit('close', false)
        }
    }
};
</script>
