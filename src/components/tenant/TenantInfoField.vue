<template>
    <div style="width:100%; display: flex; flex-direction: column; align-items: center;">
        <div style="width: 100%; max-width: 500px;">
            <v-sheet class="mb-5" :color="color" tile>
                <div class="d-flex flex-column align-center">
                    <h2 class="text-grey200">{{ guideSlides[0].title }}</h2>
                    <img :src="guideSlides[0].image" style="width: 200%; margin-top: 20px;"/>
                    <div class="text-grey100" style="margin-top: 20px; text-align: center;" v-html="guideSlides[0].description"></div>
                </div>
                <div style="margin-top: 120px;" class="d-flex flex-column align-center">
                    <h2 class="text-grey200">{{ guideSlides[1].title }}</h2>
                    <img :src="guideSlides[1].image" style="width: 200%; margin-top: 20px;"/>
                    <div class="text-grey100" style="margin-top: 20px; text-align: center;" v-html="guideSlides[1].description"></div>
                </div>
                <div style="margin-top: 120px;" class="d-flex flex-column align-center">
                    <h2 class="text-grey200">{{ guideSlides[2].title }}</h2>
                    <img :src="guideSlides[2].image" style="width: 200%; margin-top: 20px;"/>
                    <div class="text-grey100" style="margin-top: 20px; text-align: center;" v-html="guideSlides[2].description"></div>
                </div>
                <div style="margin-top: 120px;" class="d-flex flex-column align-center">
                    <h2 class="text-grey200">{{ guideSlides[3].title }}</h2>
                    <img :src="guideSlides[3].image" style="width: 200%; margin-top: 20px;"/>
                    <div class="text-grey100" style="margin-top: 20px; text-align: center;" v-html="guideSlides[3].description"></div>
                </div>
            </v-sheet>
            
            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Password *' }}</v-label>
            <VTextField 
                v-model.trim="value.password"
                type="password"
                required
                ref="password"
            ></VTextField>

            <v-sheet class="mb-5" :color="color" tile>
                <div style="margin-top: 120px;" class="d-flex flex-column align-center">
                    <h2 class="text-grey200">{{ guideSlides[4].title }}</h2>
                    <img :src="guideSlides[4].image" style="width: 200%; margin-top: 20px;"/>
                    <img :src="guideSlides[5].image" style="width: 200%; margin-top: 20px;"/>
                    <div class="text-grey100" style="margin-top: 20px; text-align: center;" v-html="guideSlides[4].description"></div>
                </div>
                <div style="margin-top: 120px;" class="d-flex flex-column align-center">
                    <h2 class="text-grey200">{{ guideSlides[6].title }}</h2>
                    <img :src="guideSlides[6].image" style="width: 200%; margin-top: 20px;"/>
                    <div class="text-grey100" style="margin-top: 20px; text-align: center;" v-html="guideSlides[6].description"></div>
                </div>
            </v-sheet>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'URL *' }}</v-label>
            <VTextField 
                v-model.trim="value.url" 
                type="url"
                required
                ref="url"
            ></VTextField>

            <v-sheet class="mb-5" :color="color" tile>
                <div style="margin-top: 120px;" class="d-flex flex-column align-center">
                    <h2 class="text-grey200">{{ guideSlides[7].title }}</h2>
                    <img :src="guideSlides[7].image" style="width: 200%; margin-top: 20px;"/>
                    <img :src="guideSlides[8].image" style="width: 200%; margin-top: 20px;"/>
                    <div class="text-grey100" style="margin-top: 20px; text-align: center;" v-html="guideSlides[7].description"></div>
                </div>
            </v-sheet>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Secret *' }}</v-label>
            <VTextField 
                v-model.trim="value.secret"
                type="password"
                required
                ref="secret"
            ></VTextField>

            <v-sheet class="mb-5" :color="color" tile>
                <div style="margin-top: 120px;" class="d-flex flex-column align-center">
                    <h2 class="text-grey200">{{ guideSlides[9].title }}</h2>
                    <img :src="guideSlides[9].image" style="width: 200%; margin-top: 20px;"/>
                    <img :src="guideSlides[10].image" style="width: 200%; margin-top: 20px;"/>
                    <div class="text-grey100" style="margin-top: 20px; text-align: center;" v-html="guideSlides[9].description"></div>
                </div>
            </v-sheet>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Host *' }}</v-label>
            <VTextField 
                v-model.trim="value.host"
                type="url"
                required
                ref="host"
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Database Name *' }}</v-label>
            <VTextField 
                v-model.trim="value.databaseName"
                type="text"
                required
                ref="databaseName"
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'Port *' }}</v-label>
            <VTextField 
                v-model.trim="value.port"
                type="number"
                required
                ref="port"
            ></VTextField>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ 'User *' }}</v-label>
            <VTextField 
                v-model.trim="value.user"
                type="text"
                required
                ref="user"
            ></VTextField>

            <v-sheet class="mb-5" :color="color" tile>
                <div style="margin-top: 120px;" class="d-flex flex-column align-center">
                    <h2 class="text-grey200">{{ guideSlides[11].title }}</h2>
                    <div class="text-grey100" style="margin-top: 20px; text-align: center;" v-html="guideSlides[11].description"></div>
                </div>
            </v-sheet>

            <v-label class="text-subtitle-1 font-weight-medium pb-2">{{ $t('createAdminAccount.tenantID') }}</v-label>
            <VTextField
                v-model.trim="value.id" 
                type="text"
                :disabled="isEdit"
                required
                ref="tenantId"
            ></VTextField>


            <!-- <v-label class="text-subtitle-1 font-weight-medium pb-2">
                {{ $t('createAdminAccount.supabaseConnectionInfo') }}
                <v-btn icon @click="openHelpPage">
                    <v-icon>mdi-help-circle</v-icon>
                </v-btn>
            </v-label>
            <v-divider class="mb-4" /> -->
        </div>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import help_image_1 from '@/assets/images/tenant/help/1.png';
import help_image_2 from '@/assets/images/tenant/help/2.png';
import help_image_3 from '@/assets/images/tenant/help/3.png';
import help_image_4 from '@/assets/images/tenant/help/4.png';
import help_image_5 from '@/assets/images/tenant/help/5.png';
import help_image_6 from '@/assets/images/tenant/help/6.png';
import help_image_7 from '@/assets/images/tenant/help/7.png';
import help_image_8 from '@/assets/images/tenant/help/8.png';
import help_image_9 from '@/assets/images/tenant/help/9.png';
import help_image_10 from '@/assets/images/tenant/help/10.png';
import help_image_11 from '@/assets/images/tenant/help/11.png';

export default {
    name: 'TenantInfoField',
    props: {
        modelValue: {
            type: Object,
            required: true,
        },
        isEdit: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue'],
    expose: ['validCheck'],

    computed: {
        value: {
            get() {
                return this.modelValue
            },
            set(value) {
                this.$emit('update:modelValue', value)
            }
        }
    },

    data: () => ({
        storage: null,
        guideSlides: [
            {
                image: help_image_1,
                title: 'STEP 1. Supabase 계정 만들기',
                description: '1. <a href="https://supabase.com/dashboard/sign-up" target="_blank">Supabase 회원가입 페이지</a>로 들어가서 계정을 생성합니다.'
            },

            {
                image: help_image_2,
                title: 'STEP 2. Supabase 프로젝트 만들기',
                description: '1. 계정 생성 이후 화면에서 New Project 버튼을 클릭해서 새로운 프로젝트를 생성합니다.'
            },
            {
                image: help_image_3,
                title: 'STEP 2. Supabase 프로젝트 만들기',
                description: '1. 새롭게 생성할 기관명을 Name 항목에 입력하고, Create organization 버튼을 클릭해서 새로운 기관을 생성합니다.'
            },
            {
                image: help_image_4,
                title: 'STEP 2. Supabase 프로젝트 만들기',
                description: '1. 생성한 Organization 내에 프로젝트(DB)를 생성해야합니다. 생성할 프로젝트명을 Project name 항목에 입력하고, 사용할 데이터베이스 비밀번호를 입력합니다.<br> 2. 입력한 비밀번호를 아래의 Password 입력창에 붙혀넣어줍니다.<br> 3. Region을 위의 스크린샷과 같이 Seoul로 선택하고, Create new project 버튼을 클릭해서 프로젝트를 생성합니다.'
            },

            {
                image: help_image_5,
                title: 'STEP 3. Supabase 연결 정보 입력하기',
                description: '1. 프로젝트 생성이 완료되면 왼쪽 최하단의 톱니바퀴 모양 아이콘을 클릭합니다.<br>2. 화면에 표시되는 Settings 메뉴리스트중 API 메뉴를 선택합니다.'
            },
            {
                image: help_image_6,
            },
            {
                image: help_image_7,
                title: 'STEP 3. Supabase 연결 정보 입력하기',
                description: '1. Project URL 섹션에 있는 URL 항목을 복사하여 아래의 URL 입력창에 붙혀넣습니다.'
            },
            {
                image: help_image_8,
                title: 'STEP 3. Supabase 연결 정보 입력하기',
                description: '1. Project API keys 섹션의 Reveal 버튼을 클릭하여 Secret 키 값을 확인할 수 있습니다. <br> 2. Secret 키를 복사하여 아래의 Secret 입력창에 붙혀넣습니다.'
            },
            {
                image: help_image_9,
            },
            {
                image: help_image_10,
                title: 'STEP 3. Supabase 연결 정보 입력하기',
                description: '1. Settings 메뉴리스트중 Database 메뉴를 선택합니다. <br>2. Connection parameters 섹션에서 Host, Database name, Port, User 값을 복사하여 아래의 각 입력창에 붙혀넣습니다.'
            },
            {
                image: help_image_11,
            },
            {
                title: 'STEP 4. 사용할 테넌트명(회사명) 입력하기',
                description: '1. 사용할 테넌트명을 아래의 ID 입력창에 입력하고 생성하기 버튼을 클릭해서 테넌트를 생성합니다.<br>입력한 테넌트명은 서브도메인으로 사용됩니다. <br>e.g. { 입력한 테넌트명 }.process-gpt.io'
            }
        ]
    }),

    async created() {
        this.storage = StorageBaseFactory.getStorage()
    },

    methods: {
        openHelpPage() {
            window.open('/tenant/help', '_blank')
        },

        async validCheck() {
            if(!this.value.password || this.value.password === '') {
                this.$refs.password.focus()
                this.$emit('stopLoading');
                throw new Error("Password를 입력해주세요.")
            }
            
            if(!this.value.url || this.value.url === '') {
                this.$refs.url.focus()
                this.$emit('stopLoading');
                throw new Error("URL을 입력해주세요.")
            }

            if(!this.value.secret || this.value.secret === '') {
                this.$refs.secret.focus()
                this.$emit('stopLoading');
                throw new Error("Secret을 입력해주세요.")
            }

            if(!this.value.host || this.value.host === '') {
                this.$refs.host.focus()
                this.$emit('stopLoading');
                throw new Error("Host를 입력해주세요.")
            }

            if(!this.value.databaseName || this.value.databaseName === '') {
                this.$refs.databaseName.focus()
                this.$emit('stopLoading');
                throw new Error("Database Name을 입력해주세요.")
            }

            if(!this.value.port || this.value.port === '') {
                this.$refs.port.focus()
                this.$emit('stopLoading');
                throw new Error("Port를 입력해주세요.")
            }

            if(this.value.port.match(/^[0-9]+$/) === null) {
                this.$refs.port.focus()
                this.$emit('stopLoading');
                throw new Error("Port는 숫자만 입력해주세요.")
            }

            if(!this.value.user || this.value.user === '') {
                this.$refs.user.focus()
                this.$emit('stopLoading');
                throw new Error("User를 입력해주세요.")
            }

            if(!this.value.id || this.value.id === '') {
                this.$refs.tenantId.focus()
                this.$emit('stopLoading');
                throw new Error("테넌트 ID를 입력해주세요.")
            }

            if(this.isEdit === false) {
                const dbTenantInfo = await this.storage.getObject(`tenant_def/${this.value.id}`, {key: 'id'})
                if(dbTenantInfo !== undefined) {
                    this.$refs.tenantId.focus()
                    this.$emit('stopLoading');
                    throw new Error(`'${this.value.id}'는 이미 존재하는 테넌트 ID입니다. 다른 ID를 사용해주세요.`)
                }
            }
        }
    }
};
</script>
