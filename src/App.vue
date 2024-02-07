<template>
    <RouterView></RouterView>
</template>

<script>
import { createClient } from '@supabase/supabase-js';
import { RouterView } from "vue-router";

export default {
    components: {
        RouterView
    },
    async created() {
        window.$supabase = createClient("http://127.0.0.1:54321", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0");
    },
    methods:{
        async try(options) {
            if(!options) {
                alert("options must have following: {context, action, onFail(optional), successMsg, failMsg}")
            }
            if(!options.context) {
                alert("options must have following: {context, action, onFail(optional), successMsg, failMsg}")
            }
            if(!options.action) {
                alert("options must have following: {context, action, onFail(optional), successMsg, failMsg}")
            }

            let context = options.context;

            await options.action(context)

            try{
                if(options.successMsg){
                    console.log(options.successMsg)
                }
            } catch(e) {
                if(options.onFail){
                    options.onFail(e)
                }
                
                console.log(e)
            }
        },
    }
}
</script>