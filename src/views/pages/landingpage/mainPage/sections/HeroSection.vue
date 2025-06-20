<template>
  <section class="hero">
    <div class="container">
      <div class="hero-content">
        <h1>AI를 기반한 프로세스 관리에서 실행까지를 손쉽게 시작하세요</h1>
        <p>Process GPT로 비즈니스 프로세스를 자연어로 정의하고 실행 가능한 모델로 변환하세요. 전통적인 BPM 작업을 단순화하고 비용과 노력을 줄일 수 있습니다.</p>
        <div class="hero-buttons">
          <!-- 텍스트를 중앙 정렬하기 위해 flex와 justify-center 클래스 추가 -->
          <!-- '시작하기' 버튼과 동일한 구조로 마켓플레이스 버튼 정렬 (to, color, class, height 순서로 통일) -->
          <v-btn @click="gotoStart()"
              to="/definition-map"
              color="#1976D2"
              class="rounded-pill"
              height="48"
          >베타 테스트하기</v-btn>
          <v-btn 
              to="https://www.youtube.com/watch?v=kd6_hKSQDYc&list=PLEr96Fo5umW9KIzFLelvN4pc8jsdcEl65"
              target="_blank"
              color="secondary"
              class="rounded-pill"
              height="48"
          >갤러리 보기</v-btn>
          <!-- <v-btn 
              to="/marketplace"
              color="secondary"
              class="rounded-pill"
              height="48"
              @click="scrollToTop"
          >마켓플레이스</v-btn> -->
          <!-- <a href="#" class="btn btn-secondary">마켓플레이스</a> -->
        </div>
        <div class="mt-6">
            <a
                class="font-medium text-decoration-none"
                href="/assets/images/mainPages/process_gpt_presentation.pdf"
                target="_blank"
                rel="noopener"
                style="width: fit-content; display: block; color: #1976D2;"
            >
              <v-row>
                <div>Technical Report 보기</div>
                <v-icon class="ml-1" style="margin-top: 1px;" size="18" color="#1976D2">mdi-open-in-new</v-icon>
              </v-row>
            </a>
        </div>
      </div>
      <div class="hero-image">
        <img src="@/assets/images/mainPages/main-img-gpt.png" alt="Process GPT 대시보드" />
      </div>
    </div>
  </section>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
  name: 'HeroSection',
  methods: {
    scrollToTop() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    },
    // vue3 Composition API 방식에 맞게 setup()에서 정의하는 형태로 변경 필요
    // setup() 함수 내에서 사용할 수 있도록 export default 바깥 또는 setup() 내부에 정의해야 함
    // 아래는 Options API 내 methods에 맞게 변환한 예시 (isLogin, router는 setup에서 가져와야 함)
    // 한글 주석 추가

    // vue3에서는 methods에 함수 선언식으로 작성
    async gotoStart() {
        // 로그인 여부 확인
        const isLogin = await backend.checkDBConnection();
        if(!isLogin) {
            await this.$router.push('/auth/login');
            return;
        }

        // 적절한 URL로 이동하는 함수
        let gotoUrl = "";

        if (window.$isTenantServer) gotoUrl = '/tenant/manage';
        // 둘 다 '/definition-map'으로 이동하도록 수정
        else gotoUrl = '/definition-map';

        await this.$router.push(gotoUrl);
    },
  }
}
</script>

<style scoped>
.hero {
  padding: 60px 0;
  background-color: var(--bg-color-light);
  position: relative;
  overflow: hidden;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.hero-content {
  flex: 1;
  max-width: 600px;
  margin-right: 40px;
}

.hero h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-color-dark);
  margin-bottom: 20px;
  line-height: 1.2;
}

.hero p {
  font-size: 1.1rem;
  color: var(--text-color);
  margin-bottom: 30px;
  line-height: 1.6;
}

.hero-buttons {
  display: flex;
  gap: 15px;
}

.btn {
  display: inline-block;
  padding: 12px 24px;
  border-radius: 5px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s ease;
  cursor: pointer;
}

  /* .btn-primary {
    background-color: var(--primary-color);
    color: white;
  }

  .btn-primary:hover {
    background-color: var(--primary-color-dark);
    transform: translateY(-2px);
  }

  .btn-secondary {
    background-color: transparent;
    color: var(--primary-color);
    border: 1px solid var(--primary-color);
  }

  .btn-secondary:hover {
    background-color: var(--primary-color-light);
    transform: translateY(-2px);
  } */

.hero-image {
  flex: 1;
  max-width: 500px;
}

.hero-image img {
  width: 100%;
  height: auto;
  border-radius: 10px;
  /* box-shadow: 0 10px 30px var(--shadow-color); */
}

@media (max-width: 992px) {
  .container {
    flex-direction: column;
  }
  
  .hero-content {
    margin-right: 0;
    margin-bottom: 40px;
    text-align: center;
    max-width: 100%;
  }
  
  .hero-buttons {
    justify-content: center;
  }
  
  .hero-image {
    max-width: 100%;
  }
}

@media (max-width: 576px) {
  .hero {
    padding: 100px 0 40px;
  }
  
  .hero h1 {
    font-size: 1.8rem;
  }
  
  .hero-buttons {
    flex-direction: column;
    width: 100%;
  }
  
  .btn {
    width: 100%;
    text-align: center;
  }
}
</style>
