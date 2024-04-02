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
            component: () => import('@/components/apps/todolist/TodolistCard.vue'),
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
            component: () => import('@/views/apps/instance-list/InstanceList.vue')
        },
        {
            name: 'instances',
            path: '/instances/:id',
            component: () => import('@/views/apps/instance-list/InstanceList.vue')
        },
        
        {
            name: 'organization',
            path: '/organization',
            component: () => import('@/views/apps/organization/Organization.vue'),
        },
        {
            name: 'Definition Chat',
            path: '/definitions/chat',
            component: () => import('@/components/ProcessDefinitionChat.vue'),
        },
        {
            name: 'definitions',
            path: '/definitions/:id',
            component: () => import('@/components/ProcessDefinitionChat.vue'),
        },
        {
            name: 'ui-definitions',
            path: '/ui-definitions/chat',
            component: () => import('@/components/UIDefinitionChat.vue'),
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
            component: () => import('@/components/apps/definition-map/ProcessDefinitionMap.vue'),
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
            component: () => import('@/views/dashboard/dashboard2.vue'),
        },
        {
            name: 'Email',
            path: '/apps/email',
            component: () => import('@/views/apps/email/Email.vue')
        },
        {
            name: 'ecom Products',
            path: '/ecommerce/products-one',
            component: () => import('@/views/apps/eCommerce/ProductsOne.vue')
        },
        {
            name: 'ecom Products Two',
            path: '/ecommerce/products-two',
            component: () => import('@/views/apps/eCommerce/ProductsTwo.vue')
        },
        {
            name: 'Product detail One',
            path: '/ecommerce/product/detail/one/:id',
            component: () => import('@/views/apps/eCommerce/ProductDetailsOne.vue')
        },
        {
            name: 'Product detail Two',
            path: '/ecommerce/product/detail/two/:id',
            component: () => import('@/views/apps/eCommerce/ProductDetails.vue')
        },
        {
            name: 'Product Checkout',
            path: '/ecommerce/checkout',
            component: () => import('@/views/apps/eCommerce/ProductCheckout.vue')
        },
        {
            name: 'Product Listing',
            path: '/ecommerce/productlist',
            component: () => import('@/views/apps/eCommerce/ProductList.vue')
        },
        {
            name: 'Posts',
            path: '/apps/blog/posts',
            component: () => import('@/views/apps/blog/Posts.vue')
        },
        {
            name: 'Detail',
            path: '/apps/blog/:id',
            component: () => import('@/views/apps/blog/Detail.vue')
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
            name: 'Notes',
            path: '/apps/notes',
            component: () => import('@/views/apps/notes/Notes.vue')
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
        }
    ]
};

export default MainRoutes;
