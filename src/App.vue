<template>
    <div>
        <v-progress-linear v-if="loading"
            style="position: absolute; z-index:999;"
            indeterminate
            class="my-progress-linear"
        ></v-progress-linear>
        <RouterView></RouterView>
    </div>
</template>

<script>
import { createClient } from '@supabase/supabase-js';
import { RouterView } from "vue-router";

export default {
    components: {
        RouterView
    },
    data: () => ({
        loading: false
    }),
    async created() {
        // window.$supabase = createClient(window._env_.DB_URL, window._env_.DB_PW);
        window.$supabase = createClient("http://127.0.0.1:54321", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0");
        window.$mode = 'uEngine'
        window.$app_ = this
    },
    methods: {
        async try(options, parameters, options_) {
            if (options && !options.action) {
                options = {
                    parameters: parameters,
                    action: options
                }

                Object.assign(options, options_);
            }

            try {
                window.$app_.mode = true
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
            finally {
                this.loading = false
            }
        },
    }
}
</script>