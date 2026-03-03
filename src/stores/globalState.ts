import { reactive, readonly } from 'vue';

// 전역 상태 정의
const state = reactive({
  isZoomed: false,
  isRightZoomed: false,
  isChatHidden: false,  // 채팅창만 숨기기 (캔버스 확장 없음)
  isMobileDrawerOpen: false
});

// 상태를 변경하는 메서드
const methods = {
  toggleZoom() {
    state.isZoomed = !state.isZoomed;
  },
  toggleRightZoom() {
    state.isRightZoomed = !state.isRightZoomed;
  },
  toggleChatHidden() {
    state.isChatHidden = !state.isChatHidden;
  },
  setMobileDrawerOpen(value: boolean) {
    state.isMobileDrawerOpen = value;
  },
};

// 외부에서 접근 가능한 상태와 메서드를 제공
export default {
  state: readonly(state), // 상태는 읽기 전용으로 제공
  methods,
};