<template>
    <!-- 녹음 다이얼로그 -->
    <Record
      @close="$emit('recordingModeChange')"
      @start="$emit('startRecording')"
      @stop="$emit('stopRecording')"
      :audioResponse="audioResponse"
      :chatRoomId="chatRoomId"
      :recordingMode="recordingMode"
    />
  
    <!-- 프로세스 생성 확인 다이얼로그 -->
    <v-dialog v-model="processDialogVisible" persistent max-width="600px">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span>프로세스 생성 확인</span>
          <v-btn icon variant="text" @click="closeProcessDialog" size="small">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
  
        <v-card-text>
          <div v-if="isAnalyzingChat" class="text-center py-4">
            <v-progress-circular indeterminate color="primary" class="mb-2" />
            <div>채팅 이력을 분석 중입니다...</div>
          </div>
  
          <div v-else-if="processAnalysisResult">
            <!-- 프로세스 생성 가능한 경우 -->
            <div v-if="processAnalysisResult.can_create_process" class="mb-4">
              <v-alert type="success" variant="tonal" class="mb-3">
                채팅 이력에서 프로세스로 만들만한 내용을 발견했습니다!
              </v-alert>
              <div class="mb-3">
                <strong>제안된 프로세스 이름:</strong>
                <div class="mt-1">{{ processAnalysisResult.suggested_process_name }}</div>
              </div>
              <div class="mb-3">
                <strong>프로세스 설명:</strong>
                <div class="mt-1">{{ processAnalysisResult.suggested_process_description }}</div>
              </div>
              <div class="mb-3">
                <strong>판단 이유:</strong>
                <div class="mt-1">{{ processAnalysisResult.reason }}</div>
              </div>
              <div class="text-caption text-grey">
                신뢰도: {{ (processAnalysisResult.confidence * 100).toFixed(0) }}%
              </div>
            </div>
  
            <!-- 프로세스 생성 불가능한 경우 -->
            <div v-else>
              <v-alert type="info" variant="tonal" class="mb-3">
                채팅 이력에서 프로세스로 만들만한 내용을 찾지 못했습니다.
              </v-alert>
              <div class="mb-3">
                <strong>이유:</strong>
                <div class="mt-1">{{ processAnalysisResult.reason }}</div>
              </div>
            </div>
          </div>
        </v-card-text>
  
        <v-card-actions v-if="processAnalysisResult?.can_create_process">
          <v-spacer />
          <v-btn variant="text" @click="closeProcessDialog">취소</v-btn>
          <v-btn 
            color="primary" 
            variant="flat" 
            @click="$emit('createProcess')" 
            :loading="isCreatingProcess"
          >
            프로세스 생성
          </v-btn>
        </v-card-actions>
  
        <v-card-actions v-else-if="processAnalysisResult && !processAnalysisResult.can_create_process">
          <v-spacer />
          <v-btn variant="flat" @click="closeProcessDialog">확인</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </template>
  
  <script setup>
  import { computed } from 'vue';
  import Record from '@/components/ui/Record.vue';
  
  const props = defineProps({
    // Record 관련
    recordingMode: {
      type: Boolean,
      default: false
    },
    audioResponse: {
      type: String,
      default: ''
    },
    chatRoomId: {
      type: String,
      default: ''
    },
    // 프로세스 생성 관련
    processCreationDialog: {
      type: Boolean,
      default: false
    },
    isAnalyzingChat: {
      type: Boolean,
      default: false
    },
    isCreatingProcess: {
      type: Boolean,
      default: false
    },
    processAnalysisResult: {
      type: Object,
      default: null
    }
  });
  
  const emit = defineEmits([
    'recordingModeChange',
    'startRecording',
    'stopRecording',
    'update:processCreationDialog',
    'createProcess'
  ]);
  
  const processDialogVisible = computed({
    get: () => props.processCreationDialog,
    set: (val) => emit('update:processCreationDialog', val)
  });
  
  function closeProcessDialog() {
    emit('update:processCreationDialog', false);
  }
  </script>