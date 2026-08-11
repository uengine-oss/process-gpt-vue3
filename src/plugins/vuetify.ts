import { createVuetify } from 'vuetify';
import '@mdi/font/css/materialdesignicons.css';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import colors from 'vuetify/util/colors';

//DragScroll
import { VueDraggableNext } from 'vue-draggable-next';
//Data tables
// import { VDataTable } from 'vuetify/components/VDataTable';
import { BLUE_THEME, AQUA_THEME, PURPLE_THEME, GREEN_THEME, CYAN_THEME, ORANGE_THEME } from '@/theme/LightTheme';
import {
    DARK_BLUE_THEME,
    DARK_AQUA_THEME,
    DARK_ORANGE_THEME,
    DARK_PURPLE_THEME,
    DARK_GREEN_THEME,
    DARK_CYAN_THEME
} from '@/theme/DarkTheme';

// Material Design 기본 색상을 테마에 추가하는 헬퍼 함수
const addMaterialColors = (theme: any) => ({
    ...theme,
    colors: {
        ...theme.colors,
        red: colors.red.base,
        pink: colors.pink.base,
        purple: colors.purple.base,
        'deep-purple': colors.deepPurple.base,
        indigo: colors.indigo.base,
        blue: colors.blue.base,
        'light-blue': colors.lightBlue.base,
        cyan: colors.cyan.base,
        teal: colors.teal.base,
        green: colors.green.base,
        'light-green': colors.lightGreen.base,
        lime: colors.lime.base,
        yellow: colors.yellow.base,
        amber: colors.amber.base,
        orange: colors.orange.base,
        'deep-orange': colors.deepOrange.base,
        brown: colors.brown.base,
        grey: '#808080',
        gray: '#808080', // gray와 grey 둘 다 지원
        'blue-grey': colors.blueGrey.base,
        black: colors.shades.black,
        white: colors.shades.white
    }
});

export default createVuetify({
    components: {
        // VDataTable,
        draggable: VueDraggableNext
    },
    directives,

    theme: {
        defaultTheme: 'AQUA_THEME',
        themes: {
            BLUE_THEME: addMaterialColors(BLUE_THEME),
            AQUA_THEME: addMaterialColors(AQUA_THEME),
            PURPLE_THEME: addMaterialColors(PURPLE_THEME),
            GREEN_THEME: addMaterialColors(GREEN_THEME),
            CYAN_THEME: addMaterialColors(CYAN_THEME),
            ORANGE_THEME: addMaterialColors(ORANGE_THEME),
            DARK_BLUE_THEME: addMaterialColors(DARK_BLUE_THEME),
            DARK_AQUA_THEME: addMaterialColors(DARK_AQUA_THEME),
            DARK_ORANGE_THEME: addMaterialColors(DARK_ORANGE_THEME),
            DARK_PURPLE_THEME: addMaterialColors(DARK_PURPLE_THEME),
            DARK_GREEN_THEME: addMaterialColors(DARK_GREEN_THEME),
            DARK_CYAN_THEME: addMaterialColors(DARK_CYAN_THEME)
        }
    },
    // 새 디자인 시스템의 형태 언어에 맞춘 기본값.
    // (색·타이포·그림자는 theme.ts + ds/vuetify-bridge/overrides.css 가 덮는다)
    defaults: {
        global: {
            // Material 의 단계별 그림자를 쓰지 않는다 — 경계는 0.5px 헤어라인으로 표현
            elevation: 0
        },
        VCard: {
            rounded: 'md',
            flat: true
        },
        VTextField: {
            variant: 'outlined',
            density: 'compact',
            color: 'primary'
        },
        VStepper: {
            variant: 'outlined',
            density: 'compact',
            color: 'primary'
        },
        VTextarea: {
            variant: 'outlined',
            density: 'compact',
            color: 'primary'
        },
        VSelect: {
            variant: 'outlined',
            density: 'compact',
            color: 'primary'
        },
        VAutocomplete: {
            variant: 'outlined',
            density: 'compact',
            color: 'primary'
        },
        VListItem: {
            minHeight: '32px'
        },
        VTooltip: {
            location: 'top'
        }
    }
});
