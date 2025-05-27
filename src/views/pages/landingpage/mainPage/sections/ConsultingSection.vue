<template>
  <section id="consulting" class="consulting">
    <div class="container">
      <div class="section-header">
        <h2>프로세스 컨설팅 AI 및 관리</h2>
        <p>AI 기반 프로세스 컨설팅으로 비즈니스 프로세스를 혁신하세요</p>
      </div>
      <TabComponent :tabs="consultingTabs" />
    </div>
  </section>
</template>

<script>
import TabComponent from '../ui/TabComponent.vue'

export default {
  name: 'ConsultingSection',
  components: {
    TabComponent
  },
  data() {
    return {
      consultingTabs: [
        {
          title: '프로세스 컨설팅 AI',
          description: '사용자는 컨설팅 AI 채팅을 통해 필요한 비지니스 프로세스 정의를 생성할 수 있습니다. 채팅창을 통해 원하는 비지니스 프로세스 내용을 입력하고, 개선하거나 추가하고 싶은 내용이 있는 경우 더 자세한 내용을 입력합니다.',
          listItems: [
            '자연어 기반 프로세스 정의 생성',
            '대화형 인터페이스로 쉽게 접근',
            '실시간 피드백 및 개선 제안'
          ],
          image: 'https://bpm-intro.uengine.io/assets/static/process_consulting_ai_chat2.340ac0c.e456661f6a6fb73183a6cd6d37a35ed9.png'
        },
        {
          title: '프로세스 정의 및 폼 생성',
          description: 'AI는 채팅을 통해 사용자의 입력을 분석하여 비지니스 프로세스 정의를 BPMN 다이어그램으로 자동 생성합니다. 각 단계별로 필요한 폼을 생성할 수 있으며, 사용자 업무와 스크립트 업무를 구분하여 프로세스를 생성할 수 있습니다.',
          listItems: [
            'BPMN 다이어그램 자동 생성',
            '단계별 맞춤형 폼 생성',
            '사용자/스크립트 업무 구분'
          ],
          image: 'https://bpm-intro.uengine.io/assets/static/process_definition_chat4.c837ed4.35897c6e9abd1244cceff0d92a409c38.png'
        },
        {
          title: '조직도 생성',
          description: '채팅을 통해 조직도를 생성할 수 있고 조직도 차트를 통해 확인 및 직접 관리할 수 있습니다. 조직도는 팀(부서), 롤(역할), 직원들을 등록, 수정, 삭제할 수 있습니다.',
          listItems: [
            'AI 기반 조직도 자동 생성',
            '팀, 역할, 직원 관리',
            '직관적인 조직도 차트 시각화'
          ],
          image: 'https://bpm-intro.uengine.io/assets/static/organization_chart_chat3.c2c687d.560d8fe80cd0b68186e9a1bd8b36cc58.png'
        }
      ]
    }
  }
}
</script>

<style scoped>
.consulting {
  padding: 80px 0;
  background-color: var(--light-color);
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

@media (max-width: 768px) {
  .consulting {
    padding: 60px 0;
  }
  
  .section-header h2 {
    font-size: 1.8rem;
  }
}
</style>
