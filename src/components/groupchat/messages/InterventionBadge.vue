<template>
    <!-- 접힌 상태 -->
    <div
      v-if="!expanded"
      class="intervention-badge intervention-yes"
      @click.stop="$emit('toggle')"
    >
      <v-icon color="success" size="14" class="mr-1">mdi-check-circle</v-icon>
      <span class="font-weight-medium">에이전트 개입됨</span>
      <v-progress-circular
        v-if="isWaiting"
        indeterminate
        color="success"
        size="12"
        width="2"
        class="ml-1"
      />
      <v-icon size="14" class="ml-1">mdi-chevron-down</v-icon>
    </div>
  
    <!-- 펼쳐진 상태 -->
    <div
      v-else
      class="intervention-info pa-2 intervention-yes"
    >
      <!-- 펄스 애니메이션 -->
      <div v-if="isWaiting" class="pulse-overlay" />
  
      <!-- LLM 응답 표시 -->
      <div v-if="responseMessage">
        <div class="d-flex align-center mb-2" style="position: relative; z-index: 1">
          <v-avatar size="24" style="margin-right: 8px">
            <img src="@/assets/images/chat/chat-icon.png" height="24" width="24" />
          </v-avatar>
          <span class="assistant-label">AI 어시스턴트</span>
          <v-spacer />
          <v-icon
            size="14"
            color="grey"
            style="cursor: pointer"
            @click.stop="$emit('toggle')"
          >
            mdi-chevron-up
          </v-icon>
        </div>
        <div class="agent-message-content">
          <div
            v-html="renderedMarkdown(displayedContent)"
            class="markdown-content pl-2 py-1"
          />
        </div>
      </div>
  
      <!-- 대기 중 -->
      <div v-else-if="isWaiting" class="d-flex align-center" style="position: relative; z-index: 1">
        <v-progress-circular
          indeterminate
          color="success"
          size="16"
          width="2"
          class="mr-2"
        />
        <span class="waiting-label">AI 응답 대기 중...</span>
        <v-spacer />
        <v-icon
          size="14"
          color="grey"
          style="cursor: pointer"
          @click.stop="$emit('toggle')"
        >
          mdi-chevron-up
        </v-icon>
      </div>
    </div>
  </template>
  
  <script setup>
import { useMessages } from '../composables/useMessages';
import { ref, computed } from 'vue';
  
const props = defineProps({
    message: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    },
    expanded: {
      type: Boolean,
      default: false
    },
    isWaiting: {
      type: Boolean,
      default: false
    },
    responseMessage: {
      type: Object,
      default: null
    }
  });
  
  defineEmits(['toggle']);
  
  const { renderedMarkdown } = useMessages(ref([]), ref({}));

const displayedContent = computed(() => {
  if (!props.responseMessage) return '';

  // 우선순위: content -> jsonContent.content/jsonData.content -> message/json/text
  const json = typeof props.responseMessage.jsonContent === 'object' ? props.responseMessage.jsonContent : (() => {
    try {
      return typeof props.responseMessage.jsonContent === 'string'
        ? JSON.parse(props.responseMessage.jsonContent)
        : typeof props.responseMessage.jsonData === 'string'
          ? JSON.parse(props.responseMessage.jsonData)
          : props.responseMessage.jsonData;
    } catch (e) {
      return props.responseMessage.jsonData;
    }
  })();

  return (
    props.responseMessage.content ||
    json?.content ||
    json?.message ||
    json?.text ||
    ''
  );
});
  </script>
  
  <style lang="scss" scoped>
  .intervention-badge {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    transition: all 0.2s ease;
  
    &:hover {
      opacity: 0.8;
      transform: translateY(-1px);
    }
  
    &.intervention-yes {
      background-color: rgba(76, 175, 80, 0.15);
      border: 1px solid rgba(76, 175, 80, 0.4);
      color: #2e7d32;
    }
  }
  
  .intervention-info {
    border-radius: 6px;
    font-size: 0.75rem;
    position: relative;
    overflow: hidden;
  
    &.intervention-yes {
      background-color: rgba(76, 175, 80, 0.1);
      border: 1px solid rgba(76, 175, 80, 0.3);
    }
  }
  
  .pulse-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.1), transparent);
    animation: pulse 2s ease-in-out infinite;
    pointer-events: none;
  }
  
  @keyframes pulse {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  .assistant-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.7);
  }
  
  .waiting-label {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
  }
  
  .agent-message-content {
    font-size: 0.875rem;
    line-height: 1.5;
  }
  </style>