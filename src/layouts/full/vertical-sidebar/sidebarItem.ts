

export interface menu {
    header?: string;
    title?: string;
    icon?: any;
    to?: string;
    chip?: string;
    BgColor?: string;
    chipBgColor?: string;
    chipColor?: string;
    chipVariant?: string;
    chipIcon?: string;
    children?: menu[];
    disabled?: boolean;
    type?: string;
    subCaption?: string;
}

const sidebarItem: menu[] = [
    {
        title: "TodoList",
        icon: 'server-line-duotone',
        BgColor: 'primary',
        to: "/todolist",
    },
    // {
    //     title: 'Calendar',
    //     icon: 'calendar-line-duotone',
    //     BgColor: 'primary',
    //     to: '/calendar'
    // },
    {
        title: "Chats",
        icon: 'chat-round-unread-line-duotone',
        BgColor: 'primary',
        to: "/chats",
    },
    {
        title: "Proposals",
        icon: 'chat-round-unread-line-duotone',
        BgColor: 'primary',
        to: "/proposals",
    },
    {
        header: '인스턴스'
    },
    {
        title: "프로세스 실행",
        icon: 'chat-dots-linear',
        BgColor: 'primary',
        to: '/instances/chat',
    },
    {
        header: '정의 관리'
    },
    {
        title: "조직도 정의",
        icon: 'users-group-rounded-line-duotone',
        BgColor: 'primary',
        to: "/organization",
    },
     {
        title: "시스템 정의",
        icon: 'server-line-duotone',
        BgColor: 'primary',
        to: "/system",
    },
    {
        title: "프로세스 정의",
        icon: 'chat-dots-linear',
        BgColor: 'primary',
        to: "/definitions/chat",
    },
    {
        title: "화면 정의",
        icon: 'chat-dots-linear',
        BgColor: 'primary',
        to: "/ui-definitions/chat",
    },
    {
        title: "정의 목록",
        icon: 'list-outline',
        BgColor: 'primary',
        to: "/definitions",
        children: []
    },
    {
        title: "정의 목록",
        icon: 'list-outline',
        BgColor: 'primary',
        to: "/definitions",
        children: []
    },
    {
        title: "프로세스 체계도",
        icon: 'sitemap',
        BgColor: 'primary',
        to: "/process-architecture",
    },
    {
        title: "프로세스 계층",
        icon: 'file-tree',
        BgColor: 'primary',
        to: "/process-hierarchy",
    },
    {
        header: 'Analytics'
    },
    {
        title: "Dashboard",
        icon: 'dashboard',
        BgColor: 'primary',
        to: "/analytics",
    },
    {
        title: "Heatmap",
        icon: 'ibm-process-mining',
        BgColor: 'primary',
        to: "/analytics/heatmap",
    },
    {
        title: "피벗 테이블",
        icon: 'tuning-square-2-linear',
        BgColor: 'primary',
        to: "/analytics/pivot",
    },
    {
        title: "퍼포먼스",
        icon: 'graph-up-linear',
        BgColor: 'primary',
        to: "/analytics/performance",
    },
    {
        title: "자연어 질의",
        icon: 'chat-round-line-linear',
        BgColor: 'primary',
        to: "/analytics/query",
    },
]

export default sidebarItem;
