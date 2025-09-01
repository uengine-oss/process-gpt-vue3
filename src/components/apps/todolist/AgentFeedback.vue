<template>
  <div class="agent-feedback">
    <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>
    
    <!-- 학습중 상태 표시 -->
    <div v-if="feedbackState === 'started'" class="learning-progress">
      <div class="progress-dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
      <span>{{ $t('agentFeedback.learningInProgress') }}</span>
    </div>

    <!-- 피드백 완료시 여러 카드로 표시 -->
    <div v-else-if="feedbackState === 'completed' && feedbackContent.length > 0" class="feedback-cards">
      <div v-for="(feedback, index) in feedbackContent" :key="index" class="feedback-card">
        <div class="task-header">
          <div class="task-left">
            <div class="task-avatar">
              <img v-if="feedback.profile" :src="feedback.profile" alt="Agent" class="avatar-image" />
              <span v-else>{{ feedback.agent ? feedback.agent.charAt(0) : 'A' }}</span>
            </div>
            <div class="task-info">
              <h3 class="task-title">{{ feedback.agent || $t('agentFeedback.agent') }}</h3>
              <p class="task-description">{{ feedback.goal || $t('agentFeedback.goal') }}</p>
            </div>
          </div>
          <div class="task-header-right">
            <div class="task-status completed">
              <div class="status-dot"></div>
              <span>{{ $t('agentFeedback.learningCompleted') }}</span>
            </div>
          </div>
        </div>
        <div class="task-result">
          <div class="result-header">
            <h4 class="result-title">{{ $t('agentFeedback.feedbackContent') }}</h4>
          </div>
          <div class="result-content">
            <div class="feedback-text">
              {{ feedback.feedback }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 피드백 완료했지만 내용이 없는 경우 -->
    <div v-else-if="feedbackState === 'completed'" class="empty-feedback">
      <div class="empty-icon">📝</div>
      <h3>{{ $t('agentFeedback.noLearning') }}</h3>
    </div>

    <!-- 대기 상태 -->
    <div v-else class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>{{ $t('agentFeedback.waitingInProgress') }}</h3>
      <p>{{ $t('agentFeedback.learningInProgressDescription') }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AgentFeedback',
  props: {
    workItem: Object
  },
  data() {
    return {
      events: [],
      channel: null,
      errorMessage: null
    }
  },
  computed: {
    allAgents() {
      // 모든 task_started 이벤트에서 agent 정보들 추출
      const taskStartedEvents = this.events.filter(ev => ev.event_type === 'task_started');
      return taskStartedEvents.map(event => {
        const data = this.parseData(event);
        return {
          role: data?.role || '에이전트',
          goal: data?.goal || '',
          profile: data?.agent_profile || ''
        }
      });
    },
    feedbackState() {
      // feedback_started, feedback_completed 순서대로 체크
      const started = this.events.find(ev => ev.event_type === 'feedback_started');
      const completed = this.events.find(ev => ev.event_type === 'feedback_completed');
      if (completed) return 'completed';
      if (started) return 'started';
      return 'waiting';
    },
    feedbackContent() {
      const completed = this.events.find(ev => ev.event_type === 'feedback_completed');
      if (!completed) return [];
      
      const data = this.parseData(completed);
      const feedbacks = data?.feedbacks || [];
      
      if (!Array.isArray(feedbacks)) return [];
      
      // agent 정보와 피드백 매칭
      return feedbacks.map(feedback => {
        // feedback의 agent 이름으로 allAgents에서 매칭 시도
        const matchedAgent = this.allAgents.find(agent => 
          agent.role && feedback.agent && agent.role.includes(feedback.agent.replace(' 에이전트', ''))
        );
        
        return {
          agent: feedback.agent || '에이전트',
          feedback: feedback.feedback || feedback.content || '피드백 내용이 없습니다.',
          profile: matchedAgent?.profile || '',
          goal: matchedAgent?.goal || ''
        };
      });
    }
  },
  methods: {
    parseData(event) {
      try {
        return typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return null;
      }
    },
    getTaskIdFromWorkItem() {
      if (this.workItem && this.workItem.worklist) {
        return this.workItem.worklist.taskId;
      }
      return null;
    },
    async loadData() {
      try {
        this.errorMessage = null;
        this.events = [];
        const taskId = this.getTaskIdFromWorkItem();
        
        console.group('🔄 [AgentFeedback] 초기 데이터 로드');
        console.log('workItem:', this.workItem);
        console.log('작업 ID:', taskId);
        
        if (!taskId) {
          this.errorMessage = 'taskId를 찾을 수 없습니다.';
          console.error('taskId를 찾을 수 없습니다. workItem 구조:', this.workItem);
          console.groupEnd();
          return;
        }

        const { data, error } = await window.$supabase
          .from('events')
          .select('*')
          .eq('todo_id', taskId)
          .in('event_type', ['task_started', 'feedback_started', 'feedback_completed'])
          .order('timestamp', { ascending: true });
          
        if (error) {
          this.errorMessage = '이벤트 데이터를 불러오는 중 오류가 발생했습니다: ' + error.message;
          throw error;
        }
        if (data) {
          this.events = data;
          console.log('로드된 이벤트 수:', data.length);
          console.table(data.map(event => ({
            이벤트_ID: event.id,
            할일_ID: event.todo_id,
            이벤트_타입: event.event_type,
            타임스탬프: new Date(event.timestamp).toLocaleString('ko-KR')
          })));
        }
        console.groupEnd();
      } catch (error) {
        this.errorMessage = '이벤트 데이터를 불러오는 중 오류가 발생했습니다: ' + (error.message || error);
        console.error('Failed to load data from Supabase:', error);
      }
    },
    setupRealtimeSubscription() {
      try {
        this.channel = window.$supabase
          .channel('events')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'events'
          }, ({ new: row }) => {
            const taskId = this.getTaskIdFromWorkItem();
            const todoId = row.todo_id;
            const exists = this.events.some(e => e.id === row.id);

            console.group('📥 [AgentFeedback] 실시간 이벤트 수신');
            console.log('수신된 이벤트:', {
              이벤트_ID: row.id,
              작업_ID: taskId,
              할일_ID: todoId,
              이벤트_타입: row.event_type,
              타임스탬프: new Date(row.timestamp).toLocaleString('ko-KR'),
              ID_일치여부: todoId === taskId ? '✅ 일치' : '❌ 불일치'
            });

            if (!exists && ['task_started', 'feedback_started', 'feedback_completed'].includes(row.event_type) && todoId === taskId) {
              this.events = [...this.events, row];
              console.log('✅ 이벤트가 추가되었습니다');
              console.log('현재 총 이벤트 수:', this.events.length);
            } else {
              console.log('❌ 이벤트가 추가되지 않았습니다', {
                이미존재: exists,
                유효한이벤트타입: ['task_started', 'feedback_started', 'feedback_completed'].includes(row.event_type),
                ID일치: todoId === taskId
              });
              if (todoId !== taskId) {
                console.warn('[ID 불일치] 이벤트 todo_id:', todoId, 'vs 현재 taskId:', taskId, '이벤트 전체:', row);
              }
            }
            console.groupEnd();
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIPTION_ERROR') {
              this.errorMessage = '실시간 이벤트 구독에 실패했습니다.';
            }
          });
      } catch (error) {
        this.errorMessage = '실시간 구독 중 오류가 발생했습니다: ' + (error.message || error);
      }
    },
    cleanup() {
      if (this.channel) {
        window.$supabase.removeChannel(this.channel);
      }
    }
  },
  async created() {
    try {
      this.supabase = await window.$supabase.auth.getSession();
    } catch (error) {
      console.error('Supabase 세션 오류:', error);
    }
    
    await this.loadData();
    this.setupRealtimeSubscription();
  },
  beforeUnmount() {
    this.cleanup();
  }
}
</script>

<style scoped>
.agent-feedback {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
  background: #fafbfc;
  min-height: auto;
  max-height: 70vh;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.error-banner {
  background: #ffe0e0;
  color: #b71c1c;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-weight: 600;
  text-align: center;
  border: 1px solid #ffbdbd;
}
.task-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e1e8ed;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}
.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.task-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}
.task-avatar {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%);
  color: white;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}
.task-info {
  flex: 1;
  min-width: 0;
}
.task-title {
  font-size: 16px;
  font-weight: 600;
  color: #1d2129;
  margin: 0 0 4px 0;
  line-height: 1.3;
}
.task-description {
  font-size: 14px;
  color: #606770;
  margin: 0;
  line-height: 1.4;
  word-break: break-word;
}
.task-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.task-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', '맑은 고딕', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.task-status.completed {
  background: #e8f5e8;
  color: #2d7d32;
}
.task-status.running {
  background: #fff3e0;
  color: #f57c00;
}
.task-status.waiting {
  background: #e3e3e3;
  color: #888;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.task-result {
  background: #f8fafb;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e4e6ea;
}
.result-header {
  padding: 12px 16px;
  background: #f0f2f5;
  border-bottom: 1px solid #e4e6ea;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.result-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.learning-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  background: linear-gradient(90deg, #f8f9ff 0%, #f0f2ff 100%);
  border-radius: 12px;
  border: 1px solid #e1e8ff;
  font-size: 16px;
  color: #60A5FA;
  font-weight: 500;
  text-align: center;
}
.progress-dots {
  display: flex;
  gap: 4px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #60A5FA;
  animation: pulse 1.4s ease-in-out infinite both;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e1e8ed;
}
.empty-state .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.empty-state h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1d2129;
  margin: 0 0 8px 0;
}
.empty-state p {
  font-size: 14px;
  color: #606770;
  margin: 0;
}

.empty-feedback {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e1e8ed;
}

.empty-feedback .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-feedback h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1d2129;
  margin: 0;
}

/* 피드백 카드들 스타일 */
.feedback-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.feedback-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e1e8ed;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.feedback-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #d1d9e0;
}

.feedback-text {
  font-size: 14px;
  line-height: 1.6;
  color: #1d2129;
  padding: 4px 0;
}

.no-feedback {
  text-align: center;
  padding: 24px;
  color: #606770;
  font-size: 14px;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .agent-feedback { 
    padding: 16px 12px; 
  }
  
  .feedback-card { 
    padding: 16px; 
  }
  
  .task-header { 
    flex-direction: column; 
    gap: 12px; 
    align-items: stretch; 
  }
  
  .task-header-right { 
    justify-content: flex-start; 
  }
  
  .task-status { 
    align-self: flex-start; 
  }
}
</style> 