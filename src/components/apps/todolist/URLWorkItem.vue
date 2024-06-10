<template>
    <div style="height: calc(100vh - 255px); padding: 20px" >
        <URLForm :url="url" :isCompleted="isComplete"></URLForm>
    </div>
</template>

<script>
import URLForm from '@/components/designer/URLForm.vue';

export default  {
    props: {
        workItem: {
            type: Object,
            default: function () {
                return null;
            }
        },
        workItemStatus: {
            type: String,
            default: function () {
                return null
            }
        },
        isDryRun: Boolean,
        dryRunActivity: {
            type: Object,
            default: function () {
                return {}
            }
        },

        isComplete: Boolean
    },
    components: {
        URLForm
    },
    computed:{
        url(){
            var me = this
            if(me.isDryRun){
                return me.dryRunActivity.url
            } else {
                return me.workItem.worklist.tool.replace('urlHandler:','')
            }
        }
    },
}
</script>
