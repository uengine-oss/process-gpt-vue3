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
            :timeout="-1"
            :color="snackbarColor"
            elevation="24"
            location="top"
        >{{ snackbarMessage }}
            <v-btn v-if="snackbarMessageDetail" variant="plain" @click="show = !show">
                {{ show ? $t('App.view') : $t('App.view') }}
            </v-btn>
            <v-expand-transition>
                <div v-if="snackbarMessageDetail && show" style="text-align: left;">{{ snackbarMessageDetail }}</div>
            </v-expand-transition>
            <template v-slot:actions>
                <v-btn color="pink" variant="text" @click="snackbar = false">x</v-btn>
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
// import { createClient } from '@supabase/supabase-js';
import { RouterView } from 'vue-router';
import BackendFactory from "@/components/api/BackendFactory";

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
        loadScreen: false,
        notificationsWatched: false,
        currentChatRoomId: null,
        notificationChannel: null,
        backend: null
    }),
    async created() {
        window.$app_ = this;
        window.addEventListener('load', () => {
            if (window.$mode !== 'ProcessGPT') {
                this.loadScreen = true;
            }
        });

        window.addEventListener('fcmTokenReceived', (event) => {
            localStorage.setItem('fcm_token', event.token);
        }); 
        
        // 클릭 이벤트로 스낵바 닫기
        document.addEventListener('click', this.closeSnackbarOnEvent);
        
        // 안드로이드 뒤로가기 버튼 이벤트 리스너 등록
        window.addEventListener('androidBackButton', this.handleAndroidBackButton);
    },
    async mounted() {
        if (window.$mode == 'ProcessGPT') {
            if (window.location.pathname.includes('external-forms')) {
                this.loadScreen = true;
                return;
            }

            if (!window.$pal) {
                this.loadScreen = false;
                if(window.location.pathname.includes('privacy')) {
                    this.loadScreen = true;
                    return;
                }
                this.backend = BackendFactory.createBackend();
                if (window.$isTenantServer) {
                    await this.backend.checkDBConnection();
                    this.loadScreen = true;
                } else {
                    const isValidTenant = await this.backend.getTenant(window.$tenantName);
                    if (!isValidTenant && window.$tenantName !== 'localhost') {
                        alert(window.$tenantName + " 존재하지 않는 경로입니다.");
                        if (localStorage.getItem('email')) {
                            window.location.href = 'https://www.process-gpt.io/tenant/manage';
                        } else {
                            window.location.href = 'https://www.process-gpt.io/auth/login';
                        }
                        return;
                    } else {
                        // 루트 페이지인 경우 로그인 체크 건너뛰기 옵션 추가
                        const skipLoginCheck = window.location.pathname === '/';
                        const userInfo = await this.backend.getUserInfo();
                        if(!skipLoginCheck) {
                            if(userInfo) {
                                const res = await this.backend.setTenant(window.$tenantName);
                                if (!res) {
                                    this.$try({}, null, {
                                        errorMsg: this.$t('StorageBaseSupabase.unRegisteredTenant')
                                    })
                                    window.location.href = 'https://www.process-gpt.io/tenant/manage';
                                }
                            } else {
                                this.$router.push('/auth/login');
                            }
                        }
                        this.loadScreen = true;
                    }
                }
            }

            if (localStorage.getItem('email')) {
                this.watchNotifications(localStorage.getItem('email'));

                this.EventBus.on('chat-room-selected', (chatRoomId) => {
                    this.currentChatRoomId = chatRoomId;
                });

                this.EventBus.on('chat-room-unselected', () => {
                    this.currentChatRoomId = null;
                });
                
                // 페이지 로드 시 브라우저 알림 권한 요청
                this.requestNotificationPermission();
            }
        }
    },
    methods: {
        closeSnackbarOnEvent() {
            // 클릭 이벤트 발생 시 스낵바 닫기
            if (this.snackbar) {
                this.snackbar = false;
            }
        },
        async watchNotifications(email){
            // this.backend = BackendFactory.createBackend();
            await this.backend.watchNotifications((notification) => {
                if (notification.user_id === email && (Notification && Notification.permission === 'granted')) {
                    let notiHeader = null;
                    let notiBody = null;
                    if(notification.type === 'workitem_bpm') {
                        notiHeader = 'New Todo';
                        notiBody = notification.title || '새 할 일 목록 추가';
                    } else if(notification.type === 'chat') {
                        if (!this.currentChatRoomId || (this.currentChatRoomId && !notification.url.includes(this.currentChatRoomId))) {
                            notiHeader = notification.from_user_id || '알 수 없는 사용자';
                            const chatRoomName = notification.description || '채팅방';
                            const messageContent = notification.title || '새 메시지';
                            notiBody = `${chatRoomName}\n${messageContent}`;
                        }
                    }
                    if(notiHeader && notiBody) {
                        new Notification(notiHeader, {
                            body: notiBody,
                            icon: '/process-gpt-favicon.png',
                            badge: '/process-gpt-favicon.png',
                            tag: `noti-${notification.id || Date.now()}`,
                            data: { url: notification.url }
                        }).onclick = function() {
                            window.focus();
                            window.location.href = notification.url;
                        };
                    }
                }   
                
            });
        },
        // 알림 권한 요청 메서드
        requestNotificationPermission() {
            // 브라우저가 알림을 지원하는지 확인
            if (!('Notification' in window)) {
                console.log('이 브라우저는 알림을 지원하지 않습니다.');
                return;
            }

            // 이미 권한이 결정되지 않은 경우에만 요청
            if (Notification && (Notification.permission !== 'granted' && Notification.permission !== 'denied')) {
                // 브라우저 내장 알림 허용 UI가 표시됨
                Notification.requestPermission();
            }
        },
        async try(options, parameters, options_) {
            if (options && !options.action) {
                options = {
                    parameters: parameters,
                    action: options
                };
                options = Object.assign(options, options_);
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
        },
        
        // 안드로이드 뒤로가기 버튼 처리
        handleAndroidBackButton() {
            const isPopupOpen = this.checkIfPopupOrModalIsOpen();
            
            if (isPopupOpen) {
                // 팝업 닫기
                this.closePopupOrModal();
                // 안드로이드에 처리 완료 알림
                if (window.AndroidBridge && window.AndroidBridge.handleBackButton) {
                    window.AndroidBridge.handleBackButton(true);
                }
            } else {
                // 처리하지 않음을 알림 (WebView 히스토리로 넘어감)
                if (window.AndroidBridge && window.AndroidBridge.handleBackButton) {
                    window.AndroidBridge.handleBackButton(false);
                }
            }
        },
        
        // 팝업이나 모달이 열려있는지 확인 (DOM에서 직접 확인)
        checkIfPopupOrModalIsOpen() {
            // Vuetify 다이얼로그 확인
            const dialogs = document.querySelectorAll('.v-dialog.v-overlay--active');
            if (dialogs.length > 0) return true;
            
            // Vuetify 메뉴 확인
            const menus = document.querySelectorAll('.v-menu .v-overlay--active');
            if (menus.length > 0) return true;
            
            // Vuetify 툴팁 확인 (보통 닫기 대상은 아니지만)
            // const tooltips = document.querySelectorAll('.v-tooltip.v-overlay--active');
            // if (tooltips.length > 0) return true;
            
            // 기타 모달 클래스 확인 (커스텀 모달이 있을 경우)
            // const customModals = document.querySelectorAll('.modal.show, .popup.active, [role="dialog"][aria-hidden="false"]');
            // if (customModals.length > 0) return true;
            
            // v-overlay가 활성화된 것들 중 스낵바가 아닌 것 확인
            const overlays = document.querySelectorAll('.v-overlay--active:not(.v-snackbar)');
            if (overlays.length > 0) return true;
            
            return false;
        },
        
        // 팝업 닫기 (DOM 요소에 직접 접근)
        closePopupOrModal() {
            // 1. v-dialog 직접 제거
            const dialogs = document.querySelectorAll('.v-dialog.v-overlay--active');
            if (dialogs.length > 0) {
                dialogs.forEach(dialog => {
                    dialog.remove();
                });
                
                // overlay도 제거
                const overlays = document.querySelectorAll('.v-overlay');
                overlays.forEach(overlay => overlay.remove());
                
                return true;
            }
            
            // 2. v-menu 제거
            const menus = document.querySelectorAll('.v-menu .v-overlay--active');
            if (menus.length > 0) {
                menus.forEach(menu => menu.remove());
                return true;
            }
            
            // 3. 기타 커스텀 모달 제거
            // const customModals = document.querySelectorAll('.modal.show, .popup.active');
            // if (customModals.length > 0) {
            //     customModals.forEach(modal => modal.remove());
            //     return true;
            // }
            
            return false;
        }
    },
    beforeUnmount() {
        // 이벤트 리스너 정리
        document.removeEventListener('click', this.closeSnackbarOnEvent);
        window.removeEventListener('androidBackButton', this.handleAndroidBackButton);
        
        if (window.$mode == 'ProcessGPT') {
            // 구독 정리
            if (this.notificationChannel) {
                this.notificationChannel.unsubscribe();
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
