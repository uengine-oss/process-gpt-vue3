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
    data: () => ({
    }),
    async created() {
        // window.$supabase = createClient(window._env_.DB_URL, window._env_.DB_PW);
        window.$supabase = createClient("http://127.0.0.1:54321", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU", {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        window.$mode = 'uEngine'
        // window.$mode = 'ProcessGPT'
    },
    methods: {
        async try(options, parameters) {
            if (options && !options.action) {
                options = {
                    parameters: parameters,
                    action: options
                }
            }

            try {
                await options.action(options.parameters)

                if (options.successMsg) {
                    // console.log(options.successMsg)
                }
                console.log('successfully done');

            } catch (e) {
                if (options.onFail) {
                    options.onFail(e);
                }

                let errorMessage = e.message;
                let currentException = e;
                while (currentException.cause) {
                    errorMessage += ' | Cause: ' + currentException.cause.message;
                    currentException = currentException.cause;
                }
                if (errorMessage) {
                    // alert(errorMessage)
                }
                console.log(e);
            }
        },
    }
}
</script>