<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';

const password = ref('');
const confirmPassword = ref('');
const isLoading = ref(false);

const passwordRules = ref([
    (v: string) => !!v || '비밀번호는 필수입니다',
    (v: string) => v.length >= 8 || '비밀번호는 최소 8자 이상이어야 합니다',
]);

const confirmPasswordRules = ref([
    (v: string) => !!v || '비밀번호 확인은 필수입니다',
    (v: string) => v === password.value || '비밀번호가 일치하지 않습니다',
]);

// TODO: 실제 사용자 ID를 가져오는 로직 구현 필요
// 예: URL 파라미터, 로컬 스토리지, 또는 다른 방법으로 사용자 ID 획득
const getUserId = () => {
    // 임시로 하드코딩된 UUID 반환
    // 실제 구현에서는 적절한 방법으로 사용자 ID를 가져와야 함
    return localStorage.getItem('uid');
};

async function setPassword() {
    if (password.value !== confirmPassword.value) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }

    isLoading.value = true;
    
    try {
        const response = await axios.post('/execution/set-password', {
            input: {
                user_id: getUserId(),
                password: password.value
            }
        });
        
        // 성공 처리
        alert('비밀번호가 성공적으로 설정되었습니다.');
        window.location.href = '/definition-map';
        
    } catch (error) {
        console.error('비밀번호 설정 실패:', error);
        alert('비밀번호 설정에 실패했습니다. 다시 시도해주세요.');
    } finally {
        isLoading.value = false;
    }
}
</script>

<template>
    <div>
        <v-form ref="form" @submit.prevent="setPassword" lazy-validation class="mt-sm-13 mt-8">
            <v-label class="text-subtitle-1 font-weight-medium pb-2 text-lightText">새 비밀번호</v-label>
            <VTextField 
                v-model="password" 
                :rules="passwordRules" 
                required 
                type="password"
                placeholder="새 비밀번호를 입력하세요"
            ></VTextField>
            
            <v-label class="text-subtitle-1 font-weight-medium pb-2 text-lightText mt-4">비밀번호 확인</v-label>
            <VTextField 
                v-model="confirmPassword" 
                :rules="confirmPasswordRules" 
                required 
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
            ></VTextField>
            
            <v-btn 
                size="large" 
                color="primary" 
                block 
                type="submit" 
                rounded="pill" 
                class="mt-6"
                :loading="isLoading"
                :disabled="isLoading"
            >
                비밀번호 설정
            </v-btn>
        </v-form>
    </div>
</template> 