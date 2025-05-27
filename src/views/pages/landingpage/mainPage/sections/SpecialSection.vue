<template>
  <section class="special bg-blue-50" id="special">
    <div class="container mx-auto pb-12">
      <div class="section-header">
        <h2>Process GPT의 핵심 차별점</h2>
      </div>
      <!-- <h2 class="text-3xl font-bold text-center mb-16">Process GPT의 핵심 차별점</h2> -->
      <!-- <div class="intro-text">
        <p>Process GPT는 기존 AI 에이전트 시스템과 달리 비즈니스 프로세스를 자동으로 식별하고 구현하는 혁신적인 접근 방식을 제공합니다. 사용자는 코딩 지식 없이도 자연어 대화만으로 복잡한 비즈니스 프로세스를 정의하고 실행할 수 있습니다.</p>
      </div> -->
      <p class="text-lg text-gray-700 text-center max-w-4xl mx-auto mb-12">Process GPT는 기존 AI 에이전트 시스템과 달리 비즈니스 프로세스를 자동으로 식별하고 구현하는 혁신적인 접근 방식을 제공합니다. 사용자는 코딩 지식 없이도 자연어 대화만으로 복잡한 비즈니스 프로세스를 정의하고 실행할 수 있습니다.</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div class="bg-white p-8 rounded-lg shadow-md">
            <div class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">1</div>
            <h3 class="text-xl font-bold mb-4">코딩 지식 불필요</h3>
            <p class="text-gray-700">일반 사용자가 프로그래밍 개념 없이도 프로세스 흐름의 적합성만 피드백하면 AI가 내부적으로 BPMN 기반 프로세스를 정의합니다.</p>
          </div>
          <div class="bg-white p-8 rounded-lg shadow-md">
            <div class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">2</div>
            <h3 class="text-xl font-bold mb-4">자가 학습 및 개선</h3>
            <p class="text-gray-700">업무 프로세스 인스턴스가 발생할 때 사용자 피드백을 통해 자동으로 프로세스가 개선되며 지속적인 발전이 이루어집니다.</p>
          </div>
          <div class="bg-white p-8 rounded-lg shadow-md">
            <div class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">3</div>
            <h3 class="text-xl font-bold mb-4">프로세스 컨설팅 서비스</h3>
            <p class="text-gray-700">사용자와의 대화를 통해 비즈니스 프로세스를 도출하고, 자동 투어를 통해 피드백을 수집하며 프로세스를 정립합니다.</p>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div class="bg-white p-8 rounded-lg shadow-md">
            <div class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">4</div>
            <h3 class="text-xl font-bold mb-4">자동화된 에이전트 배치</h3>
            <p class="text-gray-700">프로세스에 필요한 에이전트를 자동으로 식별하여 BPMN의 SwimLane(업무 역할)에 매핑하고 프롬프트를 자동 생성합니다.</p>
          </div>
          <div class="bg-white p-8 rounded-lg shadow-md">
            <div class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">5</div>
            <h3 class="text-xl font-bold mb-4">BPMN 기반 표준 프로세스 표기법</h3>
            <p class="text-gray-700">약 20년 동안 축적된 비즈니스 프로세스 표기법을 활용하여 업계 표준을 준수하는 프로세스를 구현합니다.</p>
          </div>
        </div>
      </div>
  </section>
</template>

<script>
import TabComponent from '../ui/TabComponent.vue'

export default {
  name: 'SpecialSection',
  components: {
    TabComponent
  },
  data() {
    return {
      specialTabs: [
        {
          title: '대화로 프로세스 정의',
          description: '생성형 AI를 통한 프로세스 정의 생성과 함께 가시화가 가능합니다. 생성 후에 관리자가 세부 수정을 할 수 있으며, 세부 수정사항도 자연어로 기술할 수 있습니다.',
          listItems: [
            '생성형 AI를 통한 프로세스 정의',
            '실시간 가시화',
            '자연어 기반 세부 수정'
          ],
          image: 'bpmn-diagram.png'
        },
        {
          title: '대화로 UI 생성',
          description: 'AI를 기반으로 최신 프레임워크 기반의 멀티스크린에 최적화된 업무 화면을 즉시 생성할 수 있고 생성된 화면을 원하는 대로 수정할 수 있습니다.',
          listItems: [
            '대화형 UI 생성',
            '멀티스크린 최적화',
            '생성된 UI 커스터마이징'
          ],
          image: 'bpmn-diagram.png'
        },
        {
          title: '대화로 시스템 연동',
          description: 'AI를 기반으로 내부 시스템들의 Open API Spec을 해석하여 프로세스 데이터 값들과 어떻게 연동하면 될지를 자동으로 생성합니다.',
          listItems: [
            'API 자동 해석',
            '시스템 연동 자동화',
            '데이터 매핑 최적화'
          ],
          image: 'bpmn-diagram.png'
        }
      ]
    }
  }
}
</script>

<style scoped>
.special {
  padding: 80px 0;
  background-color: rgb(var(--v-theme-primary), 0.1) !important;
}



.section-header {
  text-align: center;
  margin-bottom: 50px;
}

.section-header h2 {
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--text-color-dark);
  margin-bottom: 15px;
}

.section-header p {
  font-size: 1.1rem;
  color: var(--text-color);
  max-width: 700px;
  margin: 0 auto;
}

.intro-text {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
}

.intro-text p {
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--text-color);
}

@media (max-width: 768px) {
  .special {
    padding: 60px 0;
  }
  
  .section-header h2 {
    font-size: 1.8rem;
  }
}
</style>
