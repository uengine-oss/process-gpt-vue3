<template>
    <div>
        <RouterView></RouterView>
        <!-- $app.try -->
        <v-snackbar v-model="snackbar.active" :color="snackbar.color">
            {{ snackbar.text }}
        </v-snackbar>
        <v-overlay v-model="overlay">
            <v-progress-circular
                color="primary"
                indeterminate
            ></v-progress-circular>
        </v-overlay>
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
        snackbar: {
            active: false,
            color: '',
            text: '',
        },
        overlay: false,
    }),
    watch: {
        snackbar(val) {
            console.log(val)
        },
    },
    async created() {
        // window.$supabase = createClient(window._env_.DB_URL, window._env_.DB_PW);
        window.$supabase = createClient("http://127.0.0.1:54321", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0");
        window.$mode = "uEngine"
    },
    methods: {
        async try(options, parameters) {
            var me = this;
            me.snackbar = {
                active: false,
                color: '',
                text: '',
            };

            if(options && !options.action){
                options = {
                    parameters: parameters,
                    action: options
                }
            }
            try {
                me.overlay = true;
                await options.action(options.parameters)

                if (options.successMsg) {
                    me.snackbar.active = true;
                    me.snackbar.color = 'success';
                    me.snackbar.text = options.successMsg;
                    // console.log(options.successMsg)
                }
                me.overlay = false;
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
                // alert(errorMessage)
                if (errorMessage) {
                    me.snackbar.active = true;
                    me.snackbar.color = 'error';
                    me.snackbar.text = errorMessage;
                }
                me.overlay = false;
                console.log(e);
            }
        },
    }
}
</script>