<template>
    <div>

        <mashup v-model="uiCode" @change="update"></mashup>
    </div>
</template>

<script>
import Mashup from './designer/Mashup.vue';


export default {
    name: 'UIDefinition',
    components: {
        Mashup
    },
    props: {
        
        uiCode: String,
        
    },
    data: () => ({
        
    }),
    computed() {
    },
    watch: {
        
    },
    created() { },
    mounted() {
        // Initial Data
        
    },
    methods: {
        update(uiCode){
            this.uiCode = this.uiCode
        }
        
    }
};
</script>