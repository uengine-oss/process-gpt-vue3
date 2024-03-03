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
                alert('successfully done')
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