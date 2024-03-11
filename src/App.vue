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
        
        window.$supabase = createClient(window._env_.DB_URL, window._env_.DB_PW);

    },
    methods: {
        async try(options, parameters) {
            if(options && !options.action){
                options = {
                    parameters: parameters,
                    action: options
                }
            }
            
            try {

                await options.action(options.parameters)

                if (options.successMsg) {
                    console.log(options.successMsg)
                }
                // alert('successfully done')
                console.log('successfully done')
            } catch (e) {
                if (options.onFail) {
                    options.onFail(e)
                }

                let errorMessage = e.message;
                let currentException = e;
                while (currentException.cause) {
                    errorMessage += ' | Cause: ' + currentException.cause.message;
                    currentException = currentException.cause;
                }


                alert(errorMessage)

                

                console.log(e)
            }
        },
    }
}
</script>