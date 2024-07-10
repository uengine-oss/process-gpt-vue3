<template>
    <div>
        <v-row class="ma-0 pa-0">
            <v-col cols="3" class="pa-4">
                <v-list>
                    <template v-for="(guideSlide, index) in guideSlides" :key="index">
                        <v-list-item
                            v-for="(item, itemIndex) in guideSlide.items" :key="itemIndex"
                            :class="{'active-slide': activeIndex === index + '_' + itemIndex}"
                            @click="scrollToSlide(index, itemIndex)"
                        >
                            <v-list-item-title>{{ item.title }}</v-list-item-title>
                        </v-list-item>
                    </template>
                </v-list>
            </v-col>
            <v-col cols="9" class="tenant-info-box pa-4"
                style="height:calc(100vh - 50px); overflow:auto;"
                @scroll="handleScroll"
            >
                <template v-for="(guideSlide, index) in guideSlides" :key="index">
                    <div v-for="(item, itemIndex) in guideSlide.items" :key="itemIndex" class="mb-16">
                        <h2 class="text-grey200" :ref="'slide' + index + '_' + itemIndex">{{ item.title }}</h2>
                        <template v-for="(image, imageIndex) in item.images" :key="imageIndex">
                            <img :src="image" :class="image == '/src/assets/images/tenant/help/1.png' ? 'create-account-img' : 'tenant-info-image'"/>
                        </template>
                        <div style="font-size:18px;" v-for="(desc, descIndex) in item.description" :key="descIndex" v-html="desc"></div>
                        <template v-for="(textField, textFieldIndex) in item.textFields" :key="textFieldIndex">
                            <div v-if="textField.value" class="d-flex tenant-info-text-filed">
                                <VTextField
                                    :value="`${value.id}.process-gpt.io`" 
                                    type="text"
                                    disabled
                                ></VTextField>
                                <v-tooltip text="Copy">
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-bind="props" icon variant="text" @click="copyToClipboard">
                                            <v-icon>mdi-content-copy</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                            </div>
                            <VTextField v-else v-model.trim="value[getModel(textField.model)]"
                                :label="textField.label"
                                :type="textField.type"
                                :ref="textField.ref"
                                :disabled="isEdit || textField.disabled"
                                class="tenant-info-text-filed"
                                required
                            ></VTextField>
                        </template>
                    </div>
                </template>
                <v-row no-gutters class="pa-0 pb-16">
                    <v-btn 
                        size="large" 
                        class="mt-2" 
                        color="primary"  
                        rounded="pill"
                        type="submit"
                        :loading="isLoading"
                        @click="createInfoTenant()"
                    >생성하기</v-btn>
                </v-row>
            </v-col>
        </v-row>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import createAccount from '@/assets/images/tenant/help/1.png';
import selectNewProject from '@/assets/images/tenant/help/2.png';
import createOrganization from '@/assets/images/tenant/help/3.png';
import createProject from '@/assets/images/tenant/help/4.png';
import apiUrlCopy from '@/assets/images/tenant/help/5.png';
import secretCopy from '@/assets/images/tenant/help/6.png';
import databaseCopy from '@/assets/images/tenant/help/7.png';
import siteUrl from '@/assets/images/tenant/help/8.png';

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
        },
        isLoading: Boolean
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
        activeIndex: 0,
        guideSlides: [
            {
                step: 1,
                items: [
                    {
                        title: 'STEP 1. 계정 만들기',
                        images: [
                            createAccount
                        ],
                        description: [
                            '( *암호는 대문자, 소문자, 숫자, 특수문자가 모두 포함돼야 합니다. )<br>',
                            '1. <a href="https://supabase.com/dashboard/sign-up" target="_blank">Supabase 회원가입 페이지</a>로 들어가서 계정을 생성합니다.',
                        ]
                    }
                ]
            },
            {
                step: 2,
                items: [
                    {
                        title: 'STEP 2. 프로젝트 또는 조직 만들기',
                        images: [
                            selectNewProject
                        ],
                        description: [
                            '1. 계정 생성 이후 화면에서 새 프로젝트(New Project) 또는 신규 조직(New organization)을 선택합니다.<br>',
                            '2. 선택 후 New Project를 클릭합니다.'
                        ]
                    },
                    {
                        title: 'STEP 2. 신규 조직(New organization) 생성',
                        images: [
                            createOrganization
                        ],
                        description: [
                            '(*이미 조직(organization)이 있으면 이 단계는 건너뛰어도 괜찮습니다.)<br>',
                            '1. 새롭게 생성할 조직(New organization)명을 Name 항목에 입력합니다.<br>',
                            '2. Create organization 버튼을 클릭해서 새로운 기관을 생성합니다.'
                        ]
                    },
                    {
                        title: 'STEP 2. 새 프로젝트(New Project) 만들기',
                        images: [
                            createProject
                        ],
                        description: [
                            '1. 생성한 조직(organization)을 선택하고, 생성할 프로젝트명을 Project name 항목에 입력합니다.<br>',
                            '2. 사용할 데이터베이스 비밀번호를 입력합니다.<br>',
                            '(*입력한 비밀번호를 아래의 Database Password 입력창에 붙혀넣어줍니다.)<br>',
                            '3. Region을 위의 스크린샷과 같이 Seoul로 선택합니다.<br>',
                            '4. Create new project 버튼을 클릭해서 프로젝트를 생성합니다.<br>',
                        ],
                        textFields: [
                            {
                                label: 'Database Password',
                                type: 'password',
                                model: 'password',
                                ref: 'password',
                            }
                        ]
                    }
                ]
            },
            {
                step: 3,
                items: [
                    {
                        title: 'STEP 3. Project URL 연결하기',
                        images: [
                            apiUrlCopy
                        ],
                        description: [
                            '1. 프로젝트 생성이 완료되면 왼쪽 최하단의 톱니바퀴 모양 아이콘을 클릭합니다.<br>',
                            '2. 화면에 표시되는 Settings 메뉴리스트중 API 메뉴를 선택합니다.<br>',
                            '3. (*Project URL 섹션에 있는 URL 항목을 복사하여 아래의 URL 입력창에 붙혀넣습니다.)'
                        ],
                        textFields: [
                            {
                                label: 'URL',
                                type: 'url',
                                model: 'url',
                                ref: 'url',
                            },
                        ]
                    },
                    {
                        title: 'STEP 3. Secret API Key 연결',
                        images: [
                            secretCopy
                        ],
                        description: [
                            '1. Project API keys 섹션의 Reveal 버튼을 클릭하여 Secret 키 값을 확인할 수 있습니다.<br>',
                            '(*Secret 키를 복사하여 아래의 Secret 입력창에 붙혀넣습니다.)'
                        ],
                        textFields: [
                            {
                                label: 'Secret',
                                type: 'password',
                                model: 'secret',
                                ref: 'secret',
                            },
                        ]
                    },
                    {
                        title: 'STEP 3. DataBase 연결',
                        images: [
                            databaseCopy
                        ],
                        description: [
                            '1. Settings 메뉴리스트중 Database 메뉴를 선택합니다.<br>',
                            '2. Connection parameters 섹션에서 Host, Database name, Port, User 값을 복사하여 아래의 각 입력창에 붙혀넣습니다.'
                        ],
                        textFields: [
                            {
                                label: 'Host',
                                type: 'url',
                                model: 'host',
                                ref: 'host',
                            },
                            {
                                label: 'Database Name',
                                type: 'text',
                                model: 'databaseName',
                                ref: 'databaseName',
                            },
                            {
                                label: 'Port',
                                type: 'number',
                                model: 'port',
                                ref: 'port',
                            },
                            {
                                label: 'User',
                                type: 'text',
                                model: 'user',
                                ref: 'user',
                            },
                        ]
                    },
                ]
            },
            {
                step: 4,
                items: [
                    {
                        title: 'STEP 4. 사용할 회사명 입력하기',
                        description: [
                            '1. 사용할 회사명을 아래의 ID 입력창에 입력하고 생성하기 버튼을 클릭해서 회사를 생성합니다.<br>',
                            '입력한 회사명은 서브도메인으로 사용됩니다.<br>',
                            'e.g. { 입력한 회사명 }.process-gpt.io'
                        ],
                        textFields: [
                            {
                                label: '회사 ID',
                                type: 'text',
                                model: 'id',
                                ref: 'tenantId',
                            },
                        ]
                    },
                ]
            },
            {
                step: 5,
                items: [
                    {
                        title: 'STEP 5. Supabase Site URL 설정하기',
                        images: [
                            siteUrl
                        ],
                        description: [
                            '1. 왼쪽 메뉴 중 자물쇠 아이콘(Authentication) 메뉴를 선택합니다.<br>',
                            '2. URL Configuration을 클릭합니다.<br>',
                            '2. 아래 보이는 STEP 4에서 입력한 회사명이 포함된 Site URL을 복사 버튼을 눌러 복사 후 복사하여 Site URL 입력란에 입력합니다.<br>',
                            '4. save 버튼을 눌러 저장합니다.'
                        ],
                        textFields: [
                            {
                                label: 'Site URL',
                                disabled: true,
                                value: true
                            },
                        ]
                    }
                ]
            }
        ],
    }),

    async created() {
        this.storage = StorageBaseFactory.getStorage()
    },

    methods: {
        getModel(model) {
            return model
        },
        createInfoTenant() {
            this.$emit('beforeCreateTenant');
        },
        handleScroll() {
            const slideKeys = Object.keys(this.$refs).filter(key => key.startsWith('slide'));
            slideKeys.forEach((key) => {
                const slides = this.$refs[key];
                slides.forEach((slide) => {
                    if (slide) {
                        const rect = slide.getBoundingClientRect();
                        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
                            this.activeIndex = key.replace('slide', '');
                        }
                    }
                });
            });
        },
        scrollToSlide(index, itemIndex) {
            const slide = this.$refs['slide' + index + '_' + itemIndex];
            if (slide && slide[0]) {
                slide[0].scrollIntoView();
            }
        },

        async validCheck() {
            try {
                if (!this.value.password || this.value.password === '') {
                    try {
                        this.$refs.password.focus();
                    } catch (e) {
                        this.$emit('stopLoading');
                        throw new Error("STEP2의 새 프로젝트 만들기에서 Database Password를 입력해 주세요.");
                    }
                }

                if (!this.value.url || this.value.url === '') {
                    try {
                        this.$refs.url.focus();
                    } catch (e) {
                        this.$emit('stopLoading');
                        throw new Error("STEP3의 Project URL 연결하기에서 URL을 입력해 주세요.");
                    }
                }

                if (!this.value.secret || this.value.secret === '') {
                    try {
                        this.$refs.secret.focus();
                    } catch (e) {
                        this.$emit('stopLoading');
                        throw new Error("STEP3의 Secret API Key 연결에서 Secret을 입력해주세요.");
                    }
                }

                if (!this.value.host || this.value.host === '') {
                    try {
                        this.$refs.host.focus();
                    } catch (e) {
                        this.$emit('stopLoading');
                        throw new Error("STEP3의 DataBase 연결에서 Host를 입력해주세요.");
                    }
                }

                if (!this.value.databaseName || this.value.databaseName === '') {
                    try {
                        this.$refs.databaseName.focus();
                    } catch (e) {
                        this.$emit('stopLoading');
                        throw new Error("STEP3의 DataBase 연결에서 Database Name을 입력해주세요.");
                    }
                }

                if (!this.value.port || this.value.port === '') {
                    try {
                        this.$refs.port.focus();
                    } catch (e) {
                        this.$emit('stopLoading');
                        throw new Error("STEP3의 DataBase 연결에서 Port를 입력해주세요.");
                    }
                }

                if (this.value.port.match(/^[0-9]+$/) === null) {
                    try {
                        this.$refs.port.focus();
                    } catch (e) {
                        this.$emit('stopLoading');
                        throw new Error("STEP3의 DataBase 연결에서 Port는 숫자만 입력해주세요.");
                    }
                }

                if (!this.value.user || this.value.user === '') {
                    try {
                        this.$refs.user.focus();
                    } catch (e) {
                        this.$emit('stopLoading');
                        throw new Error("STEP3의 DataBase 연결에서 User를 입력해주세요.");
                    }
                }

                if (!this.value.id || this.value.id === '') {
                    try {
                        this.$refs.tenantId.focus();
                    } catch (e) {
                        this.$emit('stopLoading');
                        throw new Error("STEP4의 사용할 회사명 입력하기에서 회사 ID를 입력해주세요.");
                    }
                }

                if (this.isEdit === false) {
                    const dbTenantInfo = await this.storage.getObject(`tenant_def/${this.value.id}`, { key: 'id' });
                    if (dbTenantInfo !== undefined) {
                        try {
                            this.$refs.tenantId.focus();
                        } catch (e) {
                            this.$emit('stopLoading');
                            throw new Error(`STEP4의 사용할 회사명 입력하기에서 '${this.value.id}'는 이미 존재하는 회사 ID입니다. 다른 ID를 사용해주세요.`);
                        }
                    }
                }
            } catch (error) {
                this.$emit('stopLoading');
                throw error; // 에러를 다시 던져서 상위 호출 스택으로 전달합니다.
            }
        },

        copyToClipboard() {
            const textToCopy = `${this.value.id}.process-gpt.io`;
            navigator.clipboard.writeText(textToCopy).then(() => {
                this.$emit('showSnackbar', 'Copied to clipboard');
            }).catch(err => {
                console.error('Failed to copy: ', err);
            });
        }
    }
};
</script>

<style>
.active-slide {
    background-color: #f0f0f0; /* Change this to your desired highlight color */
}
.tenant-info-image {
    width:70%;
    margin-top:20px;
}

.tenant-info-text-filed {
    width:70%;
    margin-top:20px;
}

.create-account-img {
    width:35%;
}

@media only screen and (max-width:1280px) {
    .tenant-info-image {
        width:100%;
    }
    .tenant-info-text-filed {
        width:100%;
    }
    .create-account-img {
        width:100%;
    }
}
</style>
