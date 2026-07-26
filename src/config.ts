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
    actTheme: 'BLUE_THEME',
    boxed: true,
    setBorderCard: false
};

export default config;
