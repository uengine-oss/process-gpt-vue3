<template>
    <div>
        <v-progress-linear
            v-if="loading"
            style="position: absolute; z-index: 999"
            indeterminate
            class="my-progress-linear"
        ></v-progress-linear>
        <v-overlay v-model="loading" :scrim="true" :persistent="true"></v-overlay>
        <v-snackbar
            v-model="snackbar"
            class="custom-snackbar"
            :timeout="snackbarSuccessStatus ? 3000 : 15000"
            :color="snackbarColor"
            elevation="24"
            location="top"
            >{{ snackbarMessage }}
            <v-btn v-if="snackbarColor == 'error'" variant="plain" @click="show = !show">
                {{ show ? '자세히 보기' : '자세히 보기' }}
            </v-btn>
            <v-expand-transition>
                <div v-if="snackbarColor == 'error' && show">{{ snackbarMessageDetail }}</div>
            </v-expand-transition>
            <template v-slot:actions v-if="!snackbarSuccessStatus">
                <v-btn color="pink" variant="text" @click="snackbar = false">x </v-btn>
            </template>
        </v-snackbar>
        <!-- v-if="!loadScreen" -->
        <div v-if="!loadScreen" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; background-color: white;"
            class="main-page-skeleton"
        >
            <v-row class="ma-0 pa-0" style="height: 100%;">
                <v-col cols="2" class="pa-4">
                    <v-skeleton-loader type="card"></v-skeleton-loader>
                </v-col>
                <v-col cols="10" class="pa-4">
                    <v-skeleton-loader class="main-page-skeleton-right1" type="card"></v-skeleton-loader>
                    <v-skeleton-loader class="main-page-skeleton-right2" type="card"></v-skeleton-loader>
                </v-col>
            </v-row>
        </div>
        <RouterView v-else></RouterView>
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
        storage: null,
        loadScreen: false,
    }),
    async created() {
        window.$app_ = this;
        window.addEventListener('load', () => {
            this.loadScreen = true;
        });
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
                if (options && options.onFail) {
                    options.onFail(e);
                }
                if (options.errorMsg) {
                    window.$app_.snackbarMessage = options.errorMsg;
                    window.$app_.snackbarColor = 'error';
                    window.$app_.snackbar = true;
                    window.$app_.snackbarSuccessStatus = false;
                } else {
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
