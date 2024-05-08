<template>
    <div>
        <v-progress-linear
            v-if="loading"
            style="position: absolute; z-index: 999"
            indeterminate
            class="my-progress-linear"
        ></v-progress-linear>
        <v-snackbar
            v-model="snackbar"
            class="custom-snackbar"
            :timeout="snackbarSuccessStatus ? 3000 : 15000"
            :color="snackbarColor"
            elevation="24"
            location="top"
            >{{ snackbarMessage }}
            <v-btn v-if="snackbarMessageDetail" variant="plain" @click="show = !show">
                {{ show ? '자세히 보기' : '자세히 보기' }}
            </v-btn>
            <v-expand-transition>
                <div v-if="show">{{ snackbarMessageDetail }}</div>
            </v-expand-transition>
            <template v-slot:actions v-if="!snackbarSuccessStatus">
                <v-btn color="pink" variant="text" @click="snackbar = false">x </v-btn>
            </template>
        </v-snackbar>
        <RouterView></RouterView>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { createClient } from '@supabase/supabase-js';
import { RouterView } from 'vue-router';
export default {
    components: {
        RouterView
    },
    data: () => ({
        show: false,
        loading: false,
        snackbarSuccessStatus: false,
        snackbarMessage: '',
        snackbarMessageDetail: null,
        snackbar: false,
        snackbarColor: null,
        storage: null
    }),
    async created() {
        this.storage = StorageBaseFactory.getStorage();
        // window.$supabase = createClient(window._env_.DB_URL, window._env_.DB_PW);
        window.$supabase = createClient(
            'http://127.0.0.1:54321',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );
        window.$mode = 'uEngine';
        // window.$mode = 'ProcessGPT';
        window.$app_ = this;
        
        // const subdomain = window.location.host.split('.')[0];
        // if(subdomain != 'www'){
        //     let option = {
        //         key: "id"
        //     }
        //     const res = await this.storage.getObject(`db://tenant_def/${subdomain}`, option);
        //     if(res){
        //         window.$supabase = createClient(res.url, res.secret, {
        //             auth: {
        //                 autoRefreshToken: false,
        //                 persistSession: false
        //             }
        //         });
        //     } else {
        //         alert('해당 주소는 존재하지 않는 주소입니다. 가입 후 이용하세요.');
        //         window.location.href = 'http://www.process-gpt.io';
        //     }
        // }
    },
    methods: {
        async try(options, parameters, options_) {
            if (options && !options.action) {
                options = {
                    parameters: parameters,
                    action: options
                };
                Object.assign(options, options_);
            }
            try {
                window.$app_.loading = true;
                await options.action(options.parameters);
                if (options.successMsg) {
                    // console.log(options.successMsg)
                    window.$app_.snackbarMessage = options.successMsg;
                    window.$app_.snackbarColor = 'success';
                    window.$app_.snackbar = true;
                    window.$app_.snackbarSuccessStatus = true;
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
                    window.$app_.snackbarMessage = errorMessage;
                    window.$app_.snackbarColor = 'error';
                    window.$app_.snackbar = true;
                    window.$app_.snackbarSuccessStatus = false;
                    if (e.response && e.response.data && e.response.data.message) {
                        window.$app_.snackbarMessageDetail = e.response.data.message;
                    }
                }
                console.log(e);
            } finally {
                window.$app_.loading = false;
            }
        }
    }
};
</script>

<style>
/* .custom-snackbar {
    position: fixed !important;
    bottom: auto !important;
    top: 50px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 1010 !important;
} */

.custom-snackbar .v-snackbar__content {
    text-align: center;
    font-size: 16px !important;
    font-weight: 500 !important;
}
</style>
