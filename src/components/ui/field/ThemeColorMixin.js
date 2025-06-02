/**
 * 테마 색상 관리를 위한 간단한 믹스인
 * 컴포넌트에서 간편하게 테마 색상을 사용할 수 있습니다.
 */
export default {
    data() {
        return {
            themeColor: '#0085DB' // 기본 색상
        };
    },

    methods: {
        /**
         * 로컬스토리지에서 테마 색상 로드
         */
        loadThemeColor() {
            const savedSettings = JSON.parse(localStorage.getItem('userSettings') ?? '{}');
            this.themeColor = savedSettings.themeColorCode || '#0085DB';
        },

        /**
         * 16진수 색상 코드를 RGBA로 변환
         * @param {string} hex - 16진수 색상 코드 (#RRGGBB)
         * @param {number} alpha - 투명도 (0-1)
         * @returns {string} - rgba 형식의 색상 문자열
         */
        hexToRgba(hex, alpha) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        },

        /**
         * localStorage 변경 이벤트 핸들러
         */
        handleStorageChange(event) {
            if (event.key === 'userSettings') {
                try {
                    const savedSettings = JSON.parse(event.newValue || '{}');
                    if (savedSettings.themeColorCode && savedSettings.themeColorCode !== this.themeColor) {
                        this.themeColor = savedSettings.themeColorCode;
                    }
                } catch (e) {
                    console.error('테마 색상 파싱 오류:', e);
                }
            }
        }
    },

    created() {
        this.loadThemeColor();
    },

    mounted() {
        // localStorage 변경 이벤트 리스너 등록
        window.addEventListener('storage', this.handleStorageChange);
    },

    beforeUnmount() {
        // localStorage 변경 이벤트 리스너 제거
        window.removeEventListener('storage', this.handleStorageChange);
    }
}; 