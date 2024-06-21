<template>
    <v-container class="bg-surface" style="height: 100%">
        <v-row no-gutters>
            <v-icon @click="closeTab" size="24">mdi-arrow-left</v-icon>
        </v-row>

        <v-row no-gutters justify="center" style="margin-top: 25.25px;">
            <h1 class="text-grey200" style="font-size: 40px;">Supabase 연결 정보 가이드</h1>
        </v-row>
        <v-row no-gutters justify="center">
            <p class="font-weight-semibold text-grey100 text-h5">
                다음 가이드를 통해서 Supabase 데이터베이스를 만들고, 관련 연결 정보를 얻는 방법을 습득할 수 있습니다.
            </p>
        </v-row>
        
        <v-row>
            <div class="guide-content">
                <div v-for="(slide, i) in guideSlides" :key="i">
                    <v-sheet class="mb-5" :color="color" tile>
                        <div class="d-flex flex-column align-center">
                            <h2 class="text-grey200">{{ slide.title }}</h2>
                            <img :src="slide.image" style="width: 60%; margin-top: 20px;"/>
                            <div class="text-grey100" style="margin-top: 20px; text-align: center;" v-html="slide.description"></div>
                        </div>
                    </v-sheet>
                </div>
            </div>
        </v-row>
    </v-container>
</template>

<script>
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
import help_image_12 from '@/assets/images/tenant/help/12.png';

export default {
    name: 'TenantHelpPage',

    data() {
        return {
            slideNumber: 0,
            guideSlides: [
                {
                    image: help_image_1,
                    title: 'STEP 1. Supabase 계정 만들기',
                    description: '<a href="https://supabase.com/dashboard/sign-up" target="_blank">Supabase 회원가입 페이지</a>로 들어가서 계정을 만들어주세요.'
                },

                {
                    image: help_image_2,
                    title: 'STEP 2. Supabase 프로젝트 만들기',
                    description: '<a href="https://supabase.com/dashboard/projects" target="_blank">Supabase 프로젝트 생성 페이지</a>로 들어가서 `+ New Project` 버튼을 클릭해서 새로운 프로젝트를 생성해 주세요.'
                },
                {
                    image: help_image_3,
                    title: 'STEP 2. Supabase 프로젝트 만들기',
                    description: '새롭게 생성할 기관명을 Name 항목에 입력하고, 위의 스크린샷과 같이 선택한 후, `Create organization` 버튼을 눌러서 새로운 기관을 생성해 주세요.'
                },
                {
                    image: help_image_4,
                    title: 'STEP 2. Supabase 프로젝트 만들기',
                    description: '새롭게 생성할 프로젝트명을 `Project name` 항목에 입력하고, 데이터베이스 비밀번호를 입력해 주세요.<br>해당 비밀번호는 Supabase 연결 정보의 Password에서 사용됩니다.<br> Region을 위의 스크린샷과 같이 Seoul로 선택하고, `Create new project` 버튼을 눌러서 새로운 프로젝트를 생성합니다.'
                },

                {
                    image: help_image_5,
                    title: 'STEP 3. Supabase 연결 정보 확인하기',
                    description: '왼쪽 아래의 톱니바퀴 모양 아이콘을 클릭해 주세요.'
                },
                {
                    image: help_image_6,
                    title: 'STEP 3. Supabase 연결 정보 확인하기',
                    description: '왼쪽 Settings에서 API 메뉴를 선택해 주세요.'
                },
                {
                    image: help_image_7,
                    title: 'STEP 3. Supabase 연결 정보 확인하기',
                    description: '`Project URL` 섹션에 있는 URL 항목을 Copy 버튼을 클릭해서 복사해 주세요. 이 값은 Supabase 연결 정보의 URL에서 사용됩니다.'
                },
                {
                    image: help_image_8,
                    title: 'STEP 3. Supabase 연결 정보 확인하기',
                    description: '`Project URL` 섹션의 Secret 값을 확인하기 위해서 Reveal 버튼을 클릭해 주세요.'
                },
                {
                    image: help_image_9,
                    title: 'STEP 3. Supabase 연결 정보 확인하기',
                    description: '`Project URL` 섹션에 있는 Secret 항목을 Copy 버튼을 클릭해서 복사해 주세요. 이 값은 Supabase 연결 정보의 Secret에서 사용됩니다.'
                },
                {
                    image: help_image_10,
                    title: 'STEP 3. Supabase 연결 정보 확인하기',
                    description: '왼쪽 Settings에서 Database 메뉴를 선택해 주세요.'
                },
                {
                    image: help_image_11,
                    title: 'STEP 3. Supabase 연결 정보 확인하기',
                    description: '`Connection parameters` 섹션에서 Supabase 연결 정보인 Host, Database name, Port, User, Password를 확인할 수 있습니다. Copy 버튼을 눌러서 복사해 주세요.'
                },
                {
                    image: help_image_12,
                    title: 'STEP 4. Supabase 연결 정보 입력하기',
                    description: '복사시킨 정보들을 `Supabase 연결 정보`에 입력해서 테넌트 생성을 완료할 수 있습니다.'
                }
            ]
        }
    },

    methods: {
        closeTab() {
            try {
                window.close();
            } catch(e) {
                // 스크립트로 탭을 열지 않은 경우, 탭을 닫을 수 없습니다.
                // 이 경우에는 테넌트 관리 페이지로 이동시킵니다.
                this.$router.push('/tenant/manage')
            }
        }
    },
};
</script>
