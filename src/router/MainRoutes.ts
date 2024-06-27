const MainRoutes = {
    path: '/main',
    meta: {
        requiresAuth: true
    },
    redirect: '/main',
    component: () => import('@/layouts/full/FullLayout.vue'),
    children: [
        {
            name: 'Todolist',
            path: '/todolist',
            component: () => import('@/components/apps/todolist/TodolistCard.vue')
        },
        {
            name: 'WorkItem',
            path: '/todolist/:taskId',
            // component: () => import('@/components/ProcessInstance.vue')
            component: () => import('@/components/apps/todolist/WorkItem.vue'),
        },
        {
            name: 'System',
            path: '/system',
            // component: () => import('@/components/ProcessInstance.vue')
            component: () => import('@/components/ui/SystemList.vue'),
        },
        {
            name: 'InstanceCard',
            path: '/instancelist/:instId',
            component: () => import('@/components/apps/todolist/InstanceCard.vue'),
        },
        {
            name: 'Chats',
            path: '/chats',
            component: () => import('@/views/apps/chat/Chats.vue')
        },
        {
            name: 'Proposals',
            path: '/proposals',
            component: () => import('@/views/apps/proposal/Proposals.vue')
        },
        {
            name: 'Instance Chat',
            path: '/instances/chat',
            component: () => import('@/components/ProcessInstance.vue')
        },

        {
            name: 'organization',
            path: '/organization',
            component: () => import('@/views/apps/organization/Organization.vue')
        },
        {
            name: 'definitions',
            path: '/definitions/:pathMatch(.*)*',
            component: () => import('@/components/ProcessDefinitionChat.vue')
        },
        {
            name: 'forms',
            path: '/forms/:pathMatch(.*)*',
            component: () => import('@/components/ProcessDefinitionChat.vue')
        },
        {
            name: 'ui-definitions',
            path: '/ui-definitions/chat',
            component: () => import('@/components/UIDefinitionChat.vue')
        },
        {
            name: 'ui-definitions',
            path: '/ui-definitions/:pathMatch(.*)*',
            component: () => import('@/components/UIDefinitionChat.vue')
        },
        {
            name: 'Definition Map',
            path: '/definition-map',
            component: () => import('@/components/apps/definition-map/ProcessDefinitionMap.vue'),
            props: { componentName: 'DefinitionMapList' }
        },
        {
            name: 'Mega Process Detail',
            path: '/definition-map/mega/:id',
            component: () => import('@/components/apps/definition-map/ProcessDefinitionMap.vue'),
            props: { componentName: 'ViewProcessDetails' }
        },
        {
            name: 'Major Process Detail',
            path: '/definition-map/major/:id',
            component: () => import('@/components/apps/definition-map/ProcessDefinitionMap.vue')
        },
        {
            name: 'Sub Process Detail',
            path: '/definition-map/sub/:id',
            component: () => import('@/components/apps/definition-map/ProcessDefinitionMap.vue'),
            props: { componentName: 'SubProcessDetail' }
        },

        {
            name: 'dashboard 2',
            path: '/dashboard2',
            component: () => import('@/views/dashboard/dashboard2.vue')
        },
        {
            name: 'Email',
            path: '/apps/email',
            component: () => import('@/views/apps/email/Email.vue')
        },
        {
            name: 'UserProfile One',
            path: '/apps/user/profileone',
            component: () => import('@/views/apps/user-profile/profile-one/ProfileOne.vue')
        },
        {
            name: 'UserProfile Two',
            path: '/apps/user/profiletwo',
            component: () => import('@/views/apps/user-profile/profile-two/ProfileTwo.vue')
        },
        {
            name: 'UserFollowers',
            path: '/apps/user/profiletwo/followers',
            component: () => import('@/views/apps/user-profile/profile-two/Followers.vue')
        },
        {
            name: 'UserFriends',
            path: '/apps/user/profiletwo/friends',
            component: () => import('@/views/apps/user-profile/profile-two/Friends.vue')
        },
        {
            name: 'UserGallery',
            path: '/apps/user/profiletwo/gallery',
            component: () => import('@/views/apps/user-profile/profile-two/Gallery.vue')
        },

        {
            name: 'Teams',
            path: '/apps/user/profileone/teams',
            component: () => import('@/views/apps/user-profile/profile-one/Teams.vue')
        },
        {
            name: 'Projects',
            path: '/apps/user/profileone/projects',
            component: () => import('@/views/apps/user-profile/profile-one/Projects.vue')
        },
        {
            name: 'Connection',
            path: '/apps/user/profileone/connection',
            component: () => import('@/views/apps/user-profile/profile-one/Connection.vue')
        },
        {
            name: 'Contact',
            path: '/apps/contacts',
            component: () => import('@/views/apps/contact/Contact.vue')
        },
        {
            name: 'Calendar',
            path: '/calendar',
            component: () => import('@/views/apps/calendar/Calendar.vue')
        },
        {
            name: 'Kanban',
            path: '/apps/kanban',
            component: () => import('@/views/apps/kanban/Kanban.vue')
        },
        {
            name: 'Account Setting',
            path: '/pages/account-settings',
            component: () => import('@/views/pages/account-settings/AccountSettings.vue')
        },
        {
            name: 'Alert',
            path: '/ui-components/alert',
            component: () => import('@/views/ui-elements/UiAlert.vue')
        },
        {
            name: 'Accordion',
            path: '/ui-components/accordion',
            component: () => import('@/views/ui-elements/UiExpansionPanel.vue')
        },
        {
            name: 'Avtar',
            path: '/ui-components/avatar',
            component: () => import('@/views/ui-elements/UiAvatar.vue')
        },
        {
            name: 'Chip',
            path: '/ui-components/chip',
            component: () => import('@/views/ui-elements/UiChip.vue')
        },
        {
            name: 'Dialog',
            path: '/ui-components/dialogs',
            component: () => import('@/views/ui-elements/UiDialog.vue')
        },
        {
            name: 'List',
            path: '/ui-components/list',
            component: () => import('@/views/ui-elements/UiList.vue')
        },
        {
            name: 'Menus',
            path: '/ui-components/menus',
            component: () => import('@/views/ui-elements/UiMenus.vue')
        },
        {
            name: 'Rating',
            path: '/ui-components/rating',
            component: () => import('@/views/ui-elements/UiRating.vue')
        },
        {
            name: 'Tabs',
            path: '/ui-components/tabs',
            component: () => import('@/views/ui-elements/UiTabs.vue')
        },
        {
            name: 'Tooltip',
            path: '/ui-components/tooltip',
            component: () => import('@/views/ui-elements/UiTooltip.vue')
        },
        {
            name: 'Typography',
            path: '/ui-components/typography',
            component: () => import('@/views/style-animation/Typography.vue')
        },
        {
            name: 'Line',
            path: '/charts/line-chart',
            component: () => import('@/views/charts/ApexLineChart.vue')
        },
        {
            name: 'Area',
            path: '/charts/area-chart',
            component: () => import('@/views/charts/ApexAreaChart.vue')
        },
        {
            name: 'Gredient',
            path: '/charts/gredient-chart',
            component: () => import('@/views/charts/ApexGredientChart.vue')
        },
        {
            name: 'Column',
            path: '/charts/column-chart',
            component: () => import('@/views/charts/ApexColumnChart.vue')
        },
        {
            name: 'Candlestick',
            path: '/charts/candlestick-chart',
            component: () => import('@/views/charts/ApexCandlestickChart.vue')
        },
        {
            name: 'Donut & Pie',
            path: '/charts/doughnut-pie-chart',
            component: () => import('@/views/charts/ApexDonutPieChart.vue')
        },
        {
            name: 'Radialbar & Radar',
            path: '/charts/radialbar-chart',
            component: () => import('@/views/charts/ApexRadialRadarChart.vue')
        },
        {
            name: 'Editor',
            path: '/forms/editor',
            component: () => import('@/views/forms/plugins/editor/Editor.vue')
        },
        {
            name: 'Tabler',
            path: '/icons/tabler',
            component: () => import('@/views/icons/TablerIcons.vue')
        },
        {
            name: 'Classes',
            path: '/school-pages/classes',
            component: () => import('@/views/school-pages/classes/Classes.vue')
        },
        {
            name: 'Attendence',
            path: '/school-pages/attendance',
            component: () => import('@/views/school-pages/attendence/index.vue')
        },
        {
            name: 'Class Detail',
            path: '/school-pages/classes/details/:id',
            component: () => import('@/views/school-pages/classes/ClassDetail.vue')
        },
        {
            name: 'API Test',
            path: '/api/test',
            component: () => import('@/components/TestPage.vue')
        }
    ]
};

export default MainRoutes;
