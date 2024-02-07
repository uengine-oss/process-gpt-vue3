<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { profileImages } from '@/components/pages/account-settings/profileImage';
import { getGlobalContext } from '@/stores/auth';

/*Location Select*/
const select = ref('United States');
const location = ref(['United States', 'United Kingdom', 'India', 'Russia']);

/*Currency Select*/
const Currencyselect = ref('US Dollar ($)');
const Currency = ref(['US Dollar ($)','United Kingdom (Pound)', 'India (INR)', 'Russia (Ruble)',]);

/*change password*/
const currenypwd = ref('123456789142');
const newpwd = ref('123456789142');
const confirmpwd = ref('123456789142');

/*personal detail*/
const storemodel = ref('Maxima Studio');
const storemail = ref('info@modernize.com');
const storephone = ref('+91 12345 65478');
const storeaddress = ref('814 Howard Street, 120065, India');

// 유저 정보 관련
import StorageBase from '@/utils/StorageBase';
const storage = StorageBase.getStorage("supabase");

// 유저 이름 변경
const userInfo = storage?.getUser();
 
// 프로필 이미지 변경 관련

const picture = localStorage.getItem("picture");
const imageChangeDialog = ref(false);
const selectedProfileImage = ref("")

function imageChange(profileImageUrl: string) {
    selectedProfileImage.value = profileImageUrl; // picture ref 업데이트
    imageChangeDialog.value = false; // 다이얼로그 닫기
}

// 유저 프로필 저장 관련
function saveUserProfile() {
    if (selectedProfileImage.value) {
        localStorage.setItem("picture", selectedProfileImage.value);
        window.location.reload();
    }
}

// 암호 표시
const showCurrentPwd = ref(false);
const showNewPwd = ref(false);
const showConfirmPwd = ref(false);

</script>

<template>
    <v-card elevation="10" >
        <v-row class="ma-sm-n2 ma-n1">
            <v-col cols="12" sm="6">
                <v-card elevation="10">
                    <v-card-item>
                        <h5 class="text-h5">프로필 이미지 변경</h5>
                        <div class="text-subtitle-1 text-grey100 mt-2">{{ $t('test123.test') }}</div>
                        <div class="text-center mt-6 mb-6">
                            <v-avatar size="120">
                                <img :src="selectedProfileImage || picture || ''" height="120" alt="image" />
                            </v-avatar>
                        </div>
                        <div class="d-flex justify-center">
                            <v-dialog width="650" v-model="imageChangeDialog">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" color="primary" class="mx-2" rounded="pill" text="이미지 선택">이미지 선택</v-btn>
                                </template>

                                <v-card style="padding:30px;">
                                    <v-row>
                                        <v-col>
                                            <v-row>
                                                <img v-for="(profileImage, name) in profileImages"
                                                    @click="() => imageChange(profileImage)"
                                                    class="change-profile-image"
                                                    :key="name"
                                                    :src="profileImage"
                                                    width="100" height="100" alt="Mathew"
                                                    style="border-radius: 50%; padding:10px;"
                                                />
                                            </v-row>
                                        </v-col>
                                    </v-row>
                                </v-card>
                            </v-dialog>
                            <!-- <v-btn color="error" class="mx-2" variant="outlined" rounded="pill">Reset</v-btn> -->
                        </div>
                        <div class="text-subtitle-1 text-grey100 text-center my-sm-8 my-6">JPG, GIF 또는 PNG가 허용됩니다. 최대 크기 800K</div>
                    </v-card-item>
                </v-card>
            </v-col>
            <v-col cols="12" sm="6">
                <v-card elevation="10">
                    <v-card-item>
                        <h5 class="text-h5">비밀번호 변경</h5>
                        <div class="text-subtitle-1 text-grey100 mt-2">비밀번호를 변경하려면 여기에서 확인하세요.</div>
                        <div class="mt-5">
                            <v-label class="mb-2 font-weight-medium">현재 비밀번호</v-label>
                            <v-text-field
                                color="primary"
                                variant="outlined"
                                :type="showCurrentPwd ? 'text' : 'password'"
                                v-model="currenypwd"
                                :append-icon="showCurrentPwd ? 'mdi-eye-off' : 'mdi-eye'"
                                @click:append="showCurrentPwd = !showCurrentPwd"
                            />

                            <v-label class="mb-2 font-weight-medium">새 비밀번호</v-label>
                            <v-text-field
                                color="primary"
                                variant="outlined"
                                :type="showNewPwd ? 'text' : 'password'"
                                v-model="newpwd"
                                :append-icon="showNewPwd ? 'mdi-eye-off' : 'mdi-eye'"
                                @click:append="showNewPwd = !showNewPwd"
                            />

                            <v-label class="mb-2 font-weight-medium">비밀번호 확인</v-label>
                            <v-text-field
                                color="primary"
                                variant="outlined"
                                :type="showConfirmPwd ? 'text' : 'password'"
                                v-model="confirmpwd"
                                :append-icon="showConfirmPwd ? 'mdi-eye-off' : 'mdi-eye'"
                                @click:append="showConfirmPwd = !showConfirmPwd"
                                hide-details
                            />
                            </div>
                    </v-card-item>
                </v-card>
            </v-col>
            <v-col cols="12">
                <v-card elevation="10">
                    <v-card-item>
                        <h5 class="text-h5">개인정보</h5>
                        <div class="text-subtitle-1 text-grey100 mt-2">개인 세부정보를 변경하려면 여기에서 수정하고 저장하세요.</div>
                        <div class="mt-5">
                            <v-row>
                                <v-col cols="12" md="6">
                                     <v-label class="mb-2 font-weight-medium">이름</v-label>
                                        <v-text-field
                                            color="primary"
                                            variant="outlined"
                                            type="text"
                                            v-model="userInfo.name"
                                            hide-details
                                        />
                                </v-col>
                                <!-- <v-col cols="12" md="6">        
                                        <v-label class="mb-2 font-weight-medium">Location</v-label>
                                         <v-select
                                            v-model="select"
                                            :items="location"
                                            item-title="state"
                                            item-value="abbr"
                                            label="Select"
                                            return-object
                                            single-line
                                            variant="outlined"
                                            hide-details
                                        ></v-select>
                                </v-col> -->
                                <!-- <v-col cols="12" md="6">        
                                        <v-label class="mb-2 font-weight-medium">Currency</v-label>
                                         <v-select
                                            v-model="Currencyselect"
                                            :items="Currency"
                                            item-title="state"
                                            item-value="abbr"
                                            label="Select"
                                            return-object
                                            single-line
                                            variant="outlined"
                                            hide-details
                                        ></v-select>
                                </v-col> -->
                                <v-col cols="12" md="6">        
                                        <v-label class="mb-2 font-weight-medium">이메일</v-label>
                                        <v-text-field
                                            color="primary"
                                            variant="outlined"
                                            type="email"
                                            v-model="userInfo.email"
                                            hide-details
                                        ></v-text-field>
                                </v-col>
                                <v-col cols="12" md="6">        
                                        <v-label class="mb-2 font-weight-medium">전화번호</v-label>
                                        <v-text-field
                                            color="primary"
                                            variant="outlined"
                                            type="text"
                                            v-model="storephone"
                                            hide-details
                                        ></v-text-field>
                                </v-col>
                                <v-col cols="12">        
                                        <v-label class="mb-2 font-weight-medium">주소</v-label>
                                        <v-text-field
                                            color="primary"
                                            variant="outlined"
                                            type="text"
                                            v-model="storeaddress"
                                            hide-details
                                        ></v-text-field>
                                </v-col>
                            </v-row>
                        </div>
                    </v-card-item>
                </v-card>
            </v-col>
        </v-row>
        <div class="d-flex justify-end mt-5 pb-3">
            <v-btn @click="saveUserProfile()"
                size="large" color="primary" rounded="pill" class="mr-4"
            >저장
            </v-btn>
            <!-- <v-btn size="large" class="bg-lighterror text-error"  rounded="pill">닫기</v-btn> -->
        </div>
    </v-card>
</template>


<style>
    .change-profile-image:hover {
        cursor: pointer;
        opacity: 0.8;
    }
</style>