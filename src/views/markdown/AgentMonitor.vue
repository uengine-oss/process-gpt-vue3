<template>
    <!-- 메인 컨테이너: 전체 화면 높이 -->
    <v-container fluid class="pa-0 main-container">
      <v-row class="h-100 no-gutters">
        <!-- 좌측 패널: 타임라인 영역 -->
        <v-col cols="4" class="timeline-panel pa-0 pl-10 pr-10">
          <v-timeline dense align-top>
            <!-- Task별 타임라인 아이템 -->
            <v-timeline-item
              v-for="(task, index) in tasks"
              :key="task.id"
              side="start"
              fill-dot
              :dot-color="getTaskDotColor(task)"
              :class="{ 'pulse-dot': !task.isCompleted }"
              @click="selectTask(index)"
              class="timeline-item"
            >
              <!-- 시간 표시 영역 -->
              <template #opposite>
                <div class="time-status">
                  <span class="time-text">{{ formatTime(task.startTime) }}</span>
                </div>
              </template>
              
              <!-- Task 카드 -->
              <v-card 
                :elevation="getCardElevation(index)" 
                :class="getCardClasses(task, index)"
                class="pa-2 task-card"
              >
                <v-card-text class="pa-2 card-content">
                  <!-- 에이전트 정보 -->
                  <div class="agent-info">
                    <v-chip 
                      x-small 
                      outlined
                      class="agent-chip dark-grey-chip"
                    >
                      <span class="agent-text">{{ task.role }}</span>
                    </v-chip>
                  </div>
                  
                  <!-- 목표 설명 -->
                  <div class="goal-description">
                    <div class="goal-text-compact">{{ task.goal }}</div>
                  </div>
                  
                  <!-- 진행 상태 -->
                  <div class="task-status">
                    <v-icon 
                      :color="getStatusIconColor(task)" 
                      size="14"
                      :class="{ 'rotate-icon': !task.isCompleted, 'mr-1': true }"
                    >
                      {{ getStatusIcon(task) }}
                    </v-icon>
                    <span :class="getStatusTextClass(task)">
                      {{ getStatusText(task) }}<span v-if="!task.isCompleted" class="loading-dots"></span>
                    </span>
                  </div>
                </v-card-text>
              </v-card>
            </v-timeline-item>
          </v-timeline>
        </v-col>
  
        <!-- 우측 패널: 내용 표시 영역 -->
        <v-col cols="8" class="content-panel">
          <div class="content-wrapper">
            <!-- 헤더: 제목과 네비게이션 -->
            <div v-if="currentTask" class="content-header">
              <div>
                <h2>{{ currentTask.role }}</h2>
                <div class="subtitle">{{ currentTask.goal }}</div>
                <div class="subtitle">{{ formatTime(currentTask.startTime) }}</div>
              </div>
              <!-- Task 네비게이션 버튼 -->
              <div class="navigation-controls">
                <v-btn 
                  icon 
                  small 
                  :disabled="isPrevDisabled" 
                  @click="navigateTask('prev')"
                >
                  <v-icon>mdi-chevron-left</v-icon>
                </v-btn>
                <span class="mx-2">{{ currentIndex + 1 }} / {{ tasks.length }}</span>
                <v-btn 
                  icon 
                  small 
                  :disabled="isNextDisabled" 
                  @click="navigateTask('next')"
                >
                  <v-icon>mdi-chevron-right</v-icon>
                </v-btn>
              </div>
            </div>
            
            <!-- 메인 컨텐츠: Task Output 표시 -->
            <div v-if="currentTask" class="content-body">
              <div v-if="hasOutput" class="output">
                <div v-if="isJsonOutput(currentTask.output)" class="json-output">
                  <pre>{{ formatJsonOutput(currentTask.output) }}</pre>
                </div>
                <div v-else-if="isSlideContent(currentTask.output)" class="slides-container">
                  <!-- 슬라이드 헤더 -->
                  <div class="slides-header">
                    <div class="header-left">
                      <h3>프레젠테이션 모드</h3>
                      <div class="keyboard-hint">
                        <span>← → 키 또는 스페이스바로 이동</span>
                      </div>
                    </div>
                    <div class="slide-navigation">
                      <v-btn 
                        icon 
                        small 
                        :disabled="currentSlideIndex === 0" 
                        @click="previousSlide"
                      >
                        <v-icon>mdi-chevron-left</v-icon>
                      </v-btn>
                      <span class="slide-counter">{{ currentSlideIndex + 1 }} / {{ slides.length }}</span>
                      <v-btn 
                        icon 
                        small 
                        :disabled="currentSlideIndex === slides.length - 1" 
                        @click="nextSlide"
                      >
                        <v-icon>mdi-chevron-right</v-icon>
                      </v-btn>
                    </div>
                  </div>
                  
                  <!-- 슬라이드 컨텐츠 -->
                  <div class="slide-content" v-if="currentSlide">
                    <div v-html="currentSlide" class="slide-inner"></div>
                  </div>
                  
                  <!-- 슬라이드 인디케이터 -->
                  <div class="slide-indicators">
                    <span 
                      v-for="(slide, index) in slides" 
                      :key="index"
                      :class="['indicator', { active: index === currentSlideIndex }]"
                      @click="goToSlide(index)"
                    ></span>
                  </div>
                </div>
                <div v-else v-html="formatMarkdownOutput(currentTask.output)"></div>
              </div>
              <div v-else-if="isTaskCompleted" class="output">
                <p>완료된 작업이지만 결과 내용이 없습니다.</p>
              </div>
              <div v-else class="output">
                <div class="working-message">
                  <span class="agent-working">{{ currentTask.role }} 에이전트가 작업을 수행중입니다</span>
                  <div class="loading-spinner"></div>
                </div>
              </div>
            </div>
            
            <!-- Task가 없을 때 표시 -->
            <div v-else class="empty-state">
              <v-alert type="info">Task가 없습니다.</v-alert>
            </div>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </template>
  
  <script>
  import { marked } from 'marked'
  
  export default {
    name: 'AgentMonitor',
    data() {
      return {
        events: [],
        currentIndex: 0,
        currentSlideIndex: 0,
        channel: null,
        EVENT_TYPES: Object.freeze({
          TASK_STARTED: 'task_started',
          TASK_COMPLETED: 'task_completed'
        }),
        COLORS: Object.freeze({
          SUCCESS: 'success',
          PRIMARY: 'primary'
        }),
        STORAGE_KEYS: Object.freeze({
          TASK_INDEX: 'task_index'
        }),
        supabase: null
      }
    },
    computed: {
      tasks() {
        return this.processTasks(this.events)
      },
      currentTask() {
        return this.tasks[this.currentIndex]
      },
      slides() {
        if (!this.currentTask?.output || !this.isSlideContent(this.currentTask.output)) return []
        return this.parseSlides(this.currentTask.output)
      },
      currentSlide() {
        return this.slides[this.currentSlideIndex]
      },
      isPrevDisabled() {
        return this.currentIndex === 0
      },
      isNextDisabled() {
        return this.currentIndex === this.tasks.length - 1
      },
      hasOutput() {
        return this.currentTask?.isCompleted && this.currentTask?.output
      },
      isTaskCompleted() {
        return this.currentTask?.isCompleted
      }
    },
    methods: {
      processTasks(eventList) {
        const sortedEvents = this.sortEventsByTimestamp(eventList)
        const filteredEvents = this.filterRelevantEvents(sortedEvents)
        return this.buildTasksFromEvents(filteredEvents)
      },
      sortEventsByTimestamp(eventList) {
        return [...eventList].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      },
      filterRelevantEvents(eventList) {
        return eventList.filter(event => 
          event.type === this.EVENT_TYPES.TASK_STARTED || 
          event.type === this.EVENT_TYPES.TASK_COMPLETED
        )
      },
      buildTasksFromEvents(eventList) {
        const taskList = []
        const taskMap = new Map()
        eventList.forEach(event => {
          const jobId = this.parseEventData(event, 'job_id') || event.job_id || event.id
          if (event.type === this.EVENT_TYPES.TASK_STARTED) {
            const task = this.createTask(event, jobId)
            taskList.push(task)
            taskMap.set(jobId, task)
          } else if (event.type === this.EVENT_TYPES.TASK_COMPLETED && taskMap.has(jobId)) {
            this.completeTask(taskMap.get(jobId), event)
          }
        })
        return taskList
      },
      createTask(event, jobId) {
        return {
          id: event.id,
          jobId,
          goal: this.parseEventData(event, 'goal') || 'Task',
          role: this.parseEventData(event, 'role') || 'Agent',
          startTime: event.timestamp,
          isCompleted: false,
          output: null
        }
      },
      completeTask(task, event) {
        task.isCompleted = true
        task.output = this.parseEventData(event, 'final_result')
      },
      parseEventData(event, field) {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
          return data?.[field] || null
        } catch (error) {
          console.warn(`Failed to parse event data for field "${field}":`, error)
          return null
        }
      },
      formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      },
      getTaskDotColor(task) {
        return task.isCompleted ? this.COLORS.SUCCESS : this.COLORS.PRIMARY
      },
      getCardElevation(index) {
        return index === this.currentIndex ? 4 : 1
      },
      getCardClasses(task, index) {
        const baseClass = task.isCompleted ? 'completed' : 'progress'
        const selectedClass = index === this.currentIndex ? 'selected' : ''
        const animationClass = !task.isCompleted ? 'shimmer-border' : ''
        return [baseClass, selectedClass, animationClass].filter(Boolean)
      },
      getStatusIconColor(task) {
        return task.isCompleted ? this.COLORS.SUCCESS : this.COLORS.PRIMARY
      },
      getStatusIcon(task) {
        return task.isCompleted ? 'mdi-check-circle' : 'mdi-clock-outline'
      },
      getStatusTextClass(task) {
        return task.isCompleted ? 'completed-text' : 'progress-text'
      },
      getStatusText(task) {
        return task.isCompleted ? '완료' : '처리중'
      },
      isJsonOutput(output) {
        if (!output) return false
        const trimmed = output.trim()
        return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
               (trimmed.startsWith('[') && trimmed.endsWith(']'))
      },
      isSlideContent(output) {
        if (!output) return false
        return output.includes('---') && output.includes('#')
      },
      parseSlides(output) {
        const slidesSeparator = /^---$/gm
        const rawSlides = output.split(slidesSeparator)
        return rawSlides
          .filter(slide => slide.trim().length > 0)
          .map(slide => marked(slide.trim().replace(/\\n/g, '\n')))
      },
      formatJsonOutput(output) {
        try {
          const parsed = JSON.parse(output)
          return JSON.stringify(parsed, null, 2)
        } catch {
          return output
        }
      },
      formatMarkdownOutput(output) {
        return marked(output.replace(/\\n/g, '\n'))
      },
      selectTask(index) {
        this.currentIndex = index
        this.currentSlideIndex = 0
      },
      navigateTask(direction) {
        if (direction === 'prev' && !this.isPrevDisabled) {
          this.currentIndex--
          this.currentSlideIndex = 0
        } else if (direction === 'next' && !this.isNextDisabled) {
          this.currentIndex++
          this.currentSlideIndex = 0
        }
      },
      previousSlide() {
        if (this.currentSlideIndex > 0) {
          this.currentSlideIndex--
        }
      },
      nextSlide() {
        if (this.currentSlideIndex < this.slides.length - 1) {
          this.currentSlideIndex++
        }
      },
      goToSlide(index) {
        if (index >= 0 && index < this.slides.length) {
          this.currentSlideIndex = index
        }
      },
      saveState() {
        try {
          localStorage.setItem(this.STORAGE_KEYS.TASK_INDEX, this.currentIndex.toString())
        } catch (error) {
          console.warn('Failed to save state to localStorage:', error)
        }
      },
      restoreState() {
        try {
          const saved = localStorage.getItem(this.STORAGE_KEYS.TASK_INDEX)
          if (saved && this.tasks.length > parseInt(saved)) {
            this.currentIndex = parseInt(saved)
          }
        } catch (error) {
          console.warn('Failed to restore state from localStorage:', error)
        }
      },
      async loadData() {
        try {
          const { data, error } = await window.$supabase
            .from('events')
            .select('*')
            .order('timestamp', { ascending: true })
          if (error) throw error
          if (data) {
            this.events = data
            this.restoreState()
          }
        } catch (error) {
          console.error('Failed to load data from Supabase:', error)
        }
      },
      setupRealtimeSubscription() {
        this.channel = window.$supabase
          .channel('events')
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'events' 
          }, ({ new: row }) => {
            this.events.push(row)
          })
          .subscribe()
      },
      cleanup() {
        if (this.channel) {
            window.$supabase.removeChannel(this.channel)
        }
        window.removeEventListener('beforeunload', this.saveState)
        this.saveState()
      },
      handleKeydown(event) {
        if (this.currentTask && this.isSlideContent(this.currentTask.output)) {
          switch (event.key) {
            case 'ArrowRight':
            case ' ':
              event.preventDefault()
              this.nextSlide()
              break
            case 'ArrowLeft':
              event.preventDefault()
              this.previousSlide()
              break
            case 'Home':
              event.preventDefault()
              this.goToSlide(0)
              break
            case 'End':
              event.preventDefault()
              this.goToSlide(this.slides.length - 1)
              break
          }
        }
      }
    },
    async created() {
        this.supabase =  await window.$supabase.auth.getSession();
        console.log(this.supabase);
        this.loadData()
        this.setupRealtimeSubscription()
        window.addEventListener('beforeunload', this.saveState)
        document.addEventListener('keydown', this.handleKeydown)
    },
    beforeUnmount() {
      this.cleanup()
      document.removeEventListener('keydown', this.handleKeydown)
    }
  }
  </script>
  
  <style scoped>
  /* === 기본 레이아웃 === */
  .main-container {
    height: 100vh;
  }
  
  .h-100 { 
    height: 100%; 
  }
  
  /* === 패널 스타일 === */
  .timeline-panel, 
  .content-panel { 
    height: 100%; 
    overflow-y: auto; 
    scrollbar-width: none; 
    -ms-overflow-style: none; 
  }
  
  .timeline-panel::-webkit-scrollbar, 
  .content-panel::-webkit-scrollbar { 
    display: none; 
  }
  
  .timeline-panel { 
    background: #fafafa; 
    border-right: 1px solid #e0e0e0; 
  }
  
  .content-panel { 
    background: #f5f5f5; 
  }
  
  /* === 컨텐츠 영역 === */
  .content-wrapper { 
    padding: 20px; 
    height: 100%; 
    display: flex; 
    flex-direction: column; 
  }
  
  .content-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: flex-start; 
    margin-bottom: 20px; 
    padding-bottom: 15px; 
    border-bottom: 1px solid #e0e0e0; 
  }
  
  .content-header h2 { 
    margin: 0; 
    font-size: 1.5rem; 
    color: #333; 
  }
  
  .subtitle { 
    font-size: 0.9rem; 
    color: #666; 
    margin-top: 5px; 
  }
  
  .content-body { 
    flex: 1; 
    overflow-y: auto; 
  }
  
  .navigation-controls {
    display: flex;
    align-items: center;
  }
  
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  
  /* === 타임라인 요소 === */
  .timeline-item {
    cursor: pointer;
  }
  
  /* 진행중인 dot 맥박 애니메이션 */
  .pulse-dot :deep(.v-timeline-item__dot) {
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.7);
    }
    70% {
      transform: scale(1.1);
      box-shadow: 0 0 0 10px rgba(33, 150, 243, 0);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
    }
  }
  
  .time-status { 
    text-align: right; 
  }
  
  .time-text { 
    font-size: 0.85rem; 
    color: rgba(0,0,0,0.54); 
  }
  
  /* === Task 카드 스타일 === */
  .task-card {
    min-height: 130px;
    max-height: 160px;
  }
  
  .card-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 8px !important;
  }
  
  .agent-info {
    margin-bottom: 8px;
    flex-shrink: 0;
  }
  
  .agent-chip {
    height: auto !important;
    min-height: 20px !important;
    max-width: 100%;
  }
  
  .dark-grey-chip {
    border-color: #424242 !important;
    color: #424242 !important;
  }
  
  .dark-grey-chip .agent-text {
    color: #424242 !important;
    font-weight: 600;
  }
  
  .agent-text {
    font-size: 0.7rem;
    line-height: 1.2;
    word-break: break-word;
    white-space: normal;
  }
  
  .goal-description {
    margin-bottom: 6px;
    flex: 1;
  }
  
  .goal-text-compact {
    font-size: 0.8rem;
    color: rgba(0,0,0,0.87);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
  }
  
  .task-status {
    display: flex;
    align-items: center;
    margin-top: 4px;
    flex-shrink: 0;
  }
  
  /* 진행중 아이콘 회전 애니메이션 */
  .rotate-icon {
    animation: rotate 2s linear infinite;
  }
  
  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  
  /* 로딩 점들 애니메이션 */
  .loading-dots::after {
    content: '';
    animation: loading-dots 1.5s steps(4, end) infinite;
  }
  
  @keyframes loading-dots {
    0%, 20% {
      content: '';
    }
    40% {
      content: '.';
    }
    60% {
      content: '..';
    }
    80%, 100% {
      content: '...';
    }
  }
  
  .completed-text {
    color: #4caf50;
    font-weight: 500;
    font-size: 0.8rem;
  }
  
  .progress-text {
    color: #2196f3;
    font-weight: 500;
    font-size: 0.8rem;
  }
  
  /* === 카드 상태별 스타일 === */
  .progress { 
    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); 
    border-left: 4px solid #2196f3; 
  }
  
  /* 진행중 카드 shimmer 테두리 효과 */
  .shimmer-border {
    position: relative;
    overflow: hidden;
  }
  
  .shimmer-border::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(33, 150, 243, 0) 0%,
      rgba(33, 150, 243, 0.3) 50%,
      rgba(33, 150, 243, 0) 100%
    );
    animation: shimmer 3s infinite;
    z-index: 1;
    pointer-events: none;
  }
  
  @keyframes shimmer {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }
  
  .completed { 
    background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); 
    border-left: 4px solid #4caf50; 
  }
  
  .selected { 
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3); 
    transform: scale(1.02);
    border: 2px solid #1976d2 !important;
    border-radius: 8px !important;
  }
  
  .selected.completed {
    border: 2px solid #388e3c !important;
    box-shadow: 0 4px 12px rgba(56, 142, 60, 0.3);
  }
  
  /* === Output 영역 스타일 === */
  .output { 
    background: #fff; 
    color: #222; 
    padding: 1.5rem; 
    border-radius: 8px; 
    word-break: break-word; 
    font-size: 1rem; 
    line-height: 1.7; 
  }
  
  /* 작업 진행 메시지 스타일 */
  .working-message {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem;
    font-size: 1.1rem;
    color: #333;
  }
  
  .agent-working {
    font-weight: 500;
    margin-right: 1rem;
  }
  
  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #2196f3;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* === JSON 출력 스타일 === */
  .json-output pre {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    padding: 1rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    color: #333;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  
  /* === 마크다운 요소 스타일 === */
  .output :deep(h1), .output :deep(h2), .output :deep(h3) { 
    color: #424242; 
    border-bottom: 2px solid #e0e0e0; 
    padding-bottom: 0.3rem; 
    margin: 1.5rem 0 0.8rem 0; 
  }
  
  .output :deep(pre) { 
    background: #f5f5f5; 
    padding: 1rem; 
    border-radius: 4px; 
    white-space: pre-wrap; 
    overflow-x: hidden; 
  }
  
  .output :deep(code) { 
    background: #f0f0f0; 
    padding: 2px 4px; 
    border-radius: 3px; 
  }
  
  .output :deep(ul), .output :deep(ol) { 
    margin-left: 1.5rem; 
  }
  
  .output :deep(blockquote) { 
    border-left: 4px solid #ddd; 
    margin: 1rem 0; 
    padding-left: 1rem; 
    color: #666; 
  }
  
  /* === 슬라이드 스타일 === */
  .slides-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .slides-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }
  
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  
  .slides-header h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }
  
  .keyboard-hint {
    font-size: 0.8rem;
    opacity: 0.8;
    font-weight: 400;
  }
  
  .slide-navigation {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .slide-counter {
    font-size: 0.9rem;
    font-weight: 500;
    min-width: 60px;
    text-align: center;
  }
  
  .slide-content {
    flex: 1;
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
    position: relative;
    overflow-y: auto;
  }
  
  .slide-inner {
    width: 100%;
    text-align: center;
    animation: slideIn 0.5s ease-in-out;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  .slide-inner :deep(h1) {
    font-size: 2.5rem;
    color: #2c3e50;
    margin-bottom: 1rem;
    font-weight: 700;
  }
  
  .slide-inner :deep(h2) {
    font-size: 2rem;
    color: #34495e;
    margin-bottom: 1rem;
    font-weight: 600;
  }
  
  .slide-inner :deep(h3) {
    font-size: 1.5rem;
    color: #7f8c8d;
    margin-bottom: 0.8rem;
    font-weight: 500;
  }
  
  .slide-inner :deep(h4) {
    font-size: 1.2rem;
    color: #95a5a6;
    margin-bottom: 0.5rem;
    font-weight: 400;
  }
  
  .slide-inner :deep(p) {
    font-size: 1.1rem;
    line-height: 1.6;
    color: #2c3e50;
    margin-bottom: 1rem;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }
  
  .slide-inner :deep(ul) {
    text-align: left;
    max-width: 600px;
    margin: 1rem auto;
    font-size: 1.1rem;
    line-height: 1.8;
  }
  
  .slide-inner :deep(li) {
    margin-bottom: 0.8rem;
    color: #34495e;
  }
  
  .slide-inner :deep(strong) {
    color: #e74c3c;
    font-weight: 600;
  }
  
  .slide-indicators {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
    background: #fff;
    border-top: 1px solid #e9ecef;
    gap: 0.5rem;
  }
  
  .indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #dee2e6;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .indicator:hover {
    background: #adb5bd;
    transform: scale(1.2);
  }
  
  .indicator.active {
    background: #667eea;
    transform: scale(1.3);
  }
  
  /* 슬라이드 특별 스타일 */
  .slide-inner :deep(h1:first-child) {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    padding: 1rem 0;
  }
  
  .slide-inner :deep(h2:first-child) {
    border-bottom: 3px solid #667eea;
    padding-bottom: 0.5rem;
    display: inline-block;
  }
  
  /* 반응형 디자인 */
  @media (max-width: 768px) {
    .slide-inner :deep(h1) {
      font-size: 2rem;
    }
    
    .slide-inner :deep(h2) {
      font-size: 1.5rem;
    }
    
    .slide-content {
      padding: 1rem;
    }
    
    .slides-header {
      padding: 0.8rem 1rem;
    }
    
    .slides-header h3 {
      font-size: 1rem;
    }
  }
  </style>