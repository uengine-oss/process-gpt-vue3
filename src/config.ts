export type ConfigProps = {
    Sidebar_drawer: any;
    mini_sidebar: boolean;
    setHorizontalLayout: boolean;
    setRTLLayout: boolean;
    actTheme: string;
    boxed: boolean;
    setBorderCard: boolean;
};

const config: ConfigProps = {
    Sidebar_drawer: null,
    mini_sidebar: false,
    setHorizontalLayout: false, // Horizontal layout
    setRTLLayout: false, // RTL layout
    actTheme: 'AQUA_THEME',
    // boxed=true 는 본문/헤더에 .maxWidth(max-width:1300px; margin:0 auto)를 씌운다.
    // 화면이 1300px 를 넘으면 남는 폭이 전부 좌우 여백이 되어(1920px 에서 한쪽 ~300px)
    // 사이드바와 본문 사이가 과도하게 벌어진다.
    // false 로 두면 헤더는 .full-header(전체폭 - 사이드바 - 60px), 본문은 컨테이너 패딩만 남는다.
    boxed: false,
    setBorderCard: false
};

export default config;
