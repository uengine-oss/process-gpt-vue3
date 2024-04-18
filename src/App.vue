<template>
    <div>
        <v-progress-linear v-if="loading"
            style="position: absolute; z-index:999;"
            indeterminate
            class="my-progress-linear"
        ></v-progress-linear>
        <v-snackbar class="custom-snackbar"
            v-model="snackbar"
            :timeout="2000"
            :color="snackbarColor"
            elevation="24"
        >
            {{ snackbarMessage }}
        </v-snackbar>
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
        loading: false,
        snackbarMessage : String,
        snackbar: false,
        snackbarColor : null,
    }),
    async created() {
        // window.$supabase = createClient(window._env_.DB_URL, window._env_.DB_PW);
        window.$supabase = createClient("http://127.0.0.1:54321", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU", {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        // window.$mode = 'uEngine'
        window.$mode = 'ProcessGPT'
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
                window.$app_.loading = true
                await options.action(options.parameters)
                if (options.successMsg) {
                    // console.log(options.successMsg)
                    window.$app_.snackbarMessage = options.successMsg
                    window.$app_.snackbarColor = 'success'
                    window.$app_.snackbar = true;
                }
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
                    window.$app_.snackbarMessage = errorMessage
                    window.$app_.snackbarColor = 'error'
                    window.$app_.snackbar = true;
                }
                console.log(e);
            }
            finally {
                window.$app_.loading = false
            }
        },
    }
}
</script>

<style>
.custom-snackbar {
    position: fixed !important;
    bottom: auto !important;
    top: 50px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 1010 !important;
}
.custom-snackbar .v-snackbar__content {
    text-align: center;
    font-size:16px !important;
    font-weight: 500 !important;
}
</style>