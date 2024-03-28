<template>
    <div>
        <v-dialog v-model="isOpen" max-width="400">
            <v-card>
                <v-card-title class="ma-0 pa-0" style="padding: 15px 0px 0px 25px !important;">Version Up</v-card-title>
                <v-btn icon style="position:absolute; right:5px; top:5px;" @click="close()">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
                <v-card-text>
                    <v-col>
                        <v-switch
                            v-model="isMajor"
                            :label="this.isMajor ? `Major Update: ${newVersion}`: `Minor Update: ${newVersion}`"
                            color="primary"
                            hide-details
                        ></v-switch>
                        <v-text-field
                            v-model="information.name"
                            label="Version Name"
                            :rules="[v => !!v || 'Version name is required']"
                            required
                        ></v-text-field>
                    </v-col>  

                </v-card-text>
                <v-card-action style="text-align: right;">
                    <v-btn @click="save()"> save </v-btn>
                </v-card-action>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
// import xmljs from 'xml-js';
// import diff from 'deep-diff';
import diffMatchPatch from 'diff-match-patch';

export default {
    name: 'ProcessDefinitionVersionDialog',
    components: {},
    props: {
        open: Boolean,
        definition: Object,
        xml: String,
    },
    data: () => ({
        storage: null,
        isMajor: false, // default:false (minor)
        information: {
            arcv_id: null,
            version: 0.0,
            name: null,
            proc_def_id: null,
            snapshot: null,
            diff: null,
            timeStamp: null
        },
        basePath: 'proc_def_arcv',
        isOpen: false, // inner var
    }),
    computed: {
        newVersion(){
            // 4.13
            let major = Math.floor(this.information.version); // 4
            let minor = Number(this.information.version.toString().split('.')[1]); // 13

            if(this.isMajor){
                major+= 1;
                return Number(major).toFixed(1) // major 업데이트 시, major만 1 증가하고 minor를 0으로 초기화
            } 
            minor+= 1;
            return `${major}.${minor}`
        },
    },
    watch: {
        "open": function(newVal) {
            if (newVal) {
                this.load();
            } else {
                this.isOpen = false
            }
        }
    },
    created() { 
        var me = this
        if (!me.$app.try) me.$app = me.$app._component.methods;
        me.storage = StorageBaseFactory.getStorage();
    },
    methods: {
        load(){
            var me = this
            this.$app.try({
                context: me,
                action: async () => {
                    let tempId = 'SalesManagementProcess'; // me.definition.processDefinitionId
                    let result = await me.storage.list(`${me.basePath}/${tempId}`, { 
                        sort: 'desc',
                        orderBy: 'timeStamp',
                        size: 1,
                        match: {'proc_def_id': tempId}
                        // startAt: orderBy key contains values
                        // endAt: orderBy key contains values
                        // startAfter:  orderBy key then value
                        // endBefore: orderBy key then value
                    })
                    if(result.length > 0) me.information = result[0]
                    me.isOpen = true
                }
            })
        },
        save(){
            var me = this
            this.$app.try({
                context: me,
                action: async () => {
                    let tempId = 'SalesManagementProcess' // me.definition.processDefinitionId
                    let tempName = '영업관리 프로세스' // me.definition.processDefinitionName
                    const oldValue = me.information.snapshot
                    const newValue = me.xml
                    let diffs = null

                    // const xml2js = require('xml2js');
                    // const parser = new xml2js.Parser({explicitArray: false});

                    // const oldObject = xmljs.xml2js(oldValue, {compact: false});
                    // const newObject = xmljs.xml2js(newValue, {compact: false});
                    const dmp = new diffMatchPatch();

                    // let differences = jsondiffpatch.diff(oldObject, newObject)
                    // let diff = diff(oldValue, newValue);
                    // diffs = dmp.diff_main(oldValue, newValue);

                    // console.log('!!!!', diffs);

                    // const differences = diff(oldObject, newObject);
                    // console.log(oldValue, newValue, differences)


                    this.storage.putObject(this.basePath, {
                        arcv_id: `${tempId}_${this.newVersion}`,
                        version: Number(this.newVersion),
                        name: tempName,
                        proc_def_id: tempId,
                        snapshot: newValue,
                        diff: diffs,
                        timeStamp: new Date()
                    });
                }
            })
        },
        close(){
            this.$emit('close')
        }
    }
};
</script>

