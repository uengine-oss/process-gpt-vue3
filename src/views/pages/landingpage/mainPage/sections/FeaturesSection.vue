<template>
  <section id="features" class="features">
    <div class="container">
      <div class="section-header">
        <h2>Process GPT 주요 기능</h2>
        <p>강력한 기능으로 프로세스 관리를 혁신하세요</p>
      </div>
      <TabComponent :tabs="featuresTabs" />
    </div>
  </section>
</template>

<script>
import TabComponent from '../ui/TabComponent.vue'

export default {
  name: 'FeaturesSection',
  components: {
    TabComponent
  },
  data() {
    return {
      featuresTabs: [
        {
          title: 'AI 기반 채팅',
          description: '다른 사용자와 채팅 중 AI를 통해 업무 추천을 받고 관련 프로세스 인스턴스를 실행할 수 있습니다. AI 음성 채팅을 통해 사용자는 정의된 프로세스에 대해 다양한 질의 응답을 확인할 수 있습니다.',
          listItems: [
            '일반 채팅 및 AI 음성 채팅 지원',
            '정의된 프로세스 정보 확인',
            '진행 중/완료된 프로세스 인스턴스 확인'
          ],
          image: 'https://bpm-intro.uengine.io/assets/static/process_gpt_ai_chat8.7b11e6d.7c2b0b84292fa472be65813642969233.png'
        },
        {
          title: '프로세스 인스턴스 실행',
          description: '사용자는 정의된 프로세스 인스턴스를 실행할 수 있습니다. 폼 입력 또는 스크립트 실행을 통해 인스턴스의 워크아이템을 수행할 수 있습니다.',
          listItems: [
            '정의된 프로세스 인스턴스 실행',
            '폼 입력을 통한 워크아이템 수행',
            '스크립트 실행 지원'
          ],
          image: 'https://bpm-intro.uengine.io/assets/static/process_instance_execute.2665e34.d23b7f04feb583b65455e68db5e0306d.png'
        },
        {
          title: '할 일 목록',
          description: '사용자는 할 일 목록을 확인하고 추가 및 할 일 상태를 변경할 수 있습니다. 효율적인 업무 관리를 위한 직관적인 인터페이스를 제공합니다.',
          listItems: [
            '할 일 목록 확인 및 관리',
            '할 일 상태 변경',
            '우선순위 설정 및 필터링'
          ],
          image: 'https://bpm-intro.uengine.io/assets/static/todolist.b467650.270ea796eaaca1bfae27534115b34dc8.png'
        }
      ]
    }
  }
}
</script>

<style scoped>
.features {
  padding: 80px 0;
  background-color: var(--bg-color);
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
  .features {
    padding: 60px 0;
  }
  
  .section-header h2 {
    font-size: 1.8rem;
  }
}
</style>
