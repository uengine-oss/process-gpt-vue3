

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

const isGsMode = (window as any)._env_?.VITE_GS_MODE === 'true'
    || import.meta.env.VITE_GS_MODE === 'true';

const gsHiddenTitles = ['Chats', 'Proposals', 'Dashboard', 'Heatmap'];
const gsHiddenHeaders = ['Analytics'];

const allSidebarItems: menu[] = [
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
];

const sidebarItem: menu[] = isGsMode
    ? allSidebarItems.filter(item => {
        if (item.header && gsHiddenHeaders.includes(item.header)) return false;
        if (item.title && gsHiddenTitles.includes(item.title)) return false;
        return true;
    })
    : allSidebarItems;

export default sidebarItem;
