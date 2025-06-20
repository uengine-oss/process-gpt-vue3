<template>
  <div>
    <!-- 문의하기 모달 -->
    <div v-if="showForm" class="contact-form-container">
      <div class="relative w-full p-6 bg-white rounded-lg shadow-xl">
        <div class="flex justify-between items-center mb-4">
          <div style="width: 32px;"></div>
          <h2 class="text-3xl font-bold pb-4">문의하기</h2>
          <button @click="toggleForm" 
            class="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full" 
            style="width: 32px; margin-top: -15px;">✖
          </button>
        </div>
        <form id="modal-contact-form" @submit.prevent="submitForm" class="space-y-4">
          <input v-model="formData.classification" type="hidden">
          <!-- <input type="hidden" name="type" value="Process GPT"> -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="text-left">
              <label class="block mb-1 font-medium">이름 <span class="text-red-500">*</span></label>
              <input v-model="formData.name" type="text" required class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ui-primary" placeholder="이름을 입력해 주세요">
            </div>
            <div class="text-left mb-3">
              <label class="block mb-1 font-medium">이메일 <span class="text-red-500">*</span></label>
              <input v-model="formData.email" type="email" required class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ui-primary" placeholder="답변받으실 이메일 주소를 입력해 주세요">
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="text-left">
              <label class="block mb-1 font-medium">회사 <span class="text-red-500">*</span></label>
              <input v-model="formData.company" type="text" required class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ui-primary" placeholder="회사명 또는 소속기관을 입력해 주세요">
            </div>
            <div class="text-left mb-3">
              <label class="block mb-1 font-medium">직급</label>
              <input v-model="formData.position" type="text" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ui-primary" placeholder="직급을 입력해 주세요">
            </div>
          </div>
          <div class="text-left">
            <label class="block mb-1 font-medium">문의내용 <span class="text-red-500">*</span></label>
            <textarea v-model="formData.message" required rows="4" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ui-primary" placeholder="문의 내용을 입력해 주세요" style="resize: none;"></textarea>
          </div>
          <div class="flex items-center my-2 mb-2">
            <input v-model="policyAgreed" type="checkbox" required class="mr-2">
            <span class="text-sm">
              (필수) 
              <a href="#" @click.prevent="showPrivacyPolicy = true" class="text-ui-primary" style="text-decoration: underline;">
                개인정보 수집 및 이용
              </a>
              에 동의합니다.
            </span>
          </div>
          <p v-if="policyError" class="text-sm text-red-600">{{ policyError }}</p>
          <div class="flex justify-center">
            <button type="submit" class="px-6 py-3 font-bold btn btn-privacy-modal rounded-lg hover:bg-ui-primary-dark">
              문의하기
            </button>
          </div>
          
        </form>
      </div>
    </div>

    <!-- 개인정보 모달 -->
    <div v-if="showPrivacyPolicy" class="privacy-modal" @click.self="showPrivacyPolicy = false">
      <div class="privacy-modal-content">
        <div class="privacy-modal-header">
          <h2 class="text-xl font-bold">개인정보 수집 및 이용 동의</h2>
        </div>
        <div class="privacy-modal-body">
          <div class="prose max-w-none text-left">
            유엔진솔루션즈(이하 "회사")가 문의하신 내용에 대한 답변을 제공하기 위해 개인정보를 수집·이용하고자 하는 경우에는 ｢개인정보 보호법｣등 관계 법령에 따라 본인의 동의가 필요합니다. 
            <br>회사 제품 구매 및 컨설팅 문의 응답, 회사가 제공하는 서비스 이용과정을 위한 최소한의 개인정보를 수집하고 이용합니다.
            <br>수집된 정보는 발송 외 다른 목적으로 이용되지 않으며, 서비스가 종료될 경우 즉시 파기됩니다.
          </div>
        </div>
        <div class="privacy-modal-footer">
          <button @click="showPrivacyPolicy = false" class="px-8 py-2 font-bold btn btn-privacy-modal rounded-lg hover:bg-ui-primary-dark">
            닫기
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>

export default {
  name: 'ContactFormModal',
  components: {
  },
  data() {
    return {
      showForm: false,
      showPrivacyPolicy: false,
      formData: {
        classification: 'Process GPT',
        name: '',
        email: '',
        company: '',
        position: '',
        message: ''
      },
      policyAgreed: false,
      policyError: '',
      fieldErrors: {
        name: false,
        email: false,
        company: false,
        message: false
      }
    };
  },

  methods: {
    toggleForm() {
      this.showForm = !this.showForm;
      this.$emit('form-toggle', this.showForm);
      if (!this.showForm) {
        this.resetForm();
      }
    },

    validateField(field) {
      this.fieldErrors[field] = !this.formData[field].trim();
      return !this.fieldErrors[field];
    },

    validateForm() {
      let isValid = true;
      const requiredFields = ['name', 'email', 'company', 'message'];

      requiredFields.forEach(field => {
        if (!this.validateField(field)) {
          isValid = false;
        }
      });

      if (!this.policyAgreed) {
        this.policyError = '개인정보 수집 및 이용에 동의해주세요.';
        isValid = false;
      } else {
        this.policyError = '';
      }

      return isValid;
    },

    async submitForm() {
      if (!this.validateForm()) {
        return;
      }

      try {
        const formData = new FormData();
        Object.entries(this.formData).forEach(([key, value]) => {
          formData.append(key, value);
        });

        // 운영용(help계정 연결) - mjkydzab / 테스트용 - mqapyyrq
        const response = await fetch('https://formspree.io/f/mjkydzab', { 
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          alert('문의가 성공적으로 전송되었습니다.');
          this.resetForm();
          this.showForm = false; // 모달창 닫기
          this.$emit('form-toggle', false); // 부모 컴포넌트에 상태 변경 알림
        } else {
          throw new Error('Network response was not ok');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('문의 전송 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    },

    resetForm() {
      this.formData = {
        name: '',
        email: '',
        company: '',
        position: '',
        message: ''
      };
      this.policyAgreed = false;
      this.policyError = '';
      this.fieldErrors = {
        name: false,
        email: false,
        company: false,
        message: false
      };
      this.showForm = false;
    }
  }
};
</script>

<style scoped>
.contact-form-container {
  position: absolute;
  top: 250px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 1200px;
  background-color: white;
  z-index: 10;
  border-radius: 8px;
}

.contact-form-container .relative {
  width: 100%;
  padding: 2rem;
}

.privacy-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.privacy-modal-content {
  background-color: white;
  border-radius: 8px;
  width: 31.5rem; /* 21rem * 1.5 */
  max-width: 90%;
  margin: 0 auto;
}

.privacy-modal-header {
  padding: 1.5rem;
  margin-top: 1rem;
  /* border-bottom: 1px solid #e5e7eb; */
}

.privacy-modal-body {
  padding: 0 1.5rem;
}

.privacy-modal-footer {
  padding: 1.5rem;
  margin-bottom: 1rem;
  /* border-top: 1px solid #e5e7eb; */
  text-align: center;
}

.btn-privacy-modal {
  background-color: #1976D2;
  color: white;
}

button {
  transition: all 0.2s ease-in-out;
}

@media (max-width: 376px){
  .contact-form-container {
    top: 315px;
  }
}
</style> 