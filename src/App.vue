<template>
    <v-snackbar v-model="snackbar" :timeout="timeout">
        {{ text }}
        <template v-slot:actions>
            <v-btn color="red" variant="text" @click="snackbar = false">
                Close
            </v-btn>
        </template>
    </v-snackbar>

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
        snackbar: false,
        text: '',
        timeout: 3000
    }),
    async created() {
        // window.$supabase = createClient(window._env_.DB_URL, window._env_.DB_PW);
        window.$supabase = createClient("http://127.0.0.1:54321", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0");
        window.$mode = 'uEngine'
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
                    this.text = options.successMsg
                    this.snackbar = true
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