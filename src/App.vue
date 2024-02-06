<template>
    <RouterView></RouterView>
</template>

<script>
import { RouterView } from "vue-router";

export default {
    components: {
        RouterView
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