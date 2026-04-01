export default {
    install(app) {
        app.config.globalProperties.$setLocale = function () {
            try {
                const browserLang = navigator.language || navigator.languages[0] || 'ko';
                this.$i18n.locale = browserLang.startsWith('ko') ? 'ko' : 'en';
            } catch (e) {
                this.$i18n.locale = 'ko';
            }
        };
    }
};
