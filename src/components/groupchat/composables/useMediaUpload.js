import { ref } from 'vue';
import axios from 'axios';
import BackendFactory from '@/components/api/BackendFactory';

const backend = BackendFactory.createBackend();

export function useMediaUpload() {
  const attachedImages = ref([]);
  const file = ref(null);
  
  // 음성 녹음 관련
  const isRecording = ref(false);
  const isMicRecording = ref(false);
  const isMicRecorderLoading = ref(false);
  const mediaRecorder = ref(null);
  const micRecorder = ref(null);
  const audioChunks = ref([]);
  const micAudioChunks = ref([]);

  // 이미지 변경 핸들러
  async function changeImage(event) {
    const imageFile = event.target.files[0];
    if (!imageFile) return;

    if (window.location.hostname !== 'localhost') {
      const fileName = `uploads/${Date.now()}_${imageFile.name}`;
      const data = await backend.uploadImage(fileName, imageFile);
      if (data && data.path) {
        const imageUrl = await backend.getImageUrl(data.path);
        attachedImages.value.push({
          id: Date.now(),
          url: imageUrl,
          file: imageFile
        });
      }
    } else {
      processImageLocally(imageFile);
    }
  }

  // 로컬 이미지 처리
  function processImageLocally(imageFile) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const imgElement = document.createElement('img');
      imgElement.src = event.target.result;
      imgElement.onload = () => {
        const canvas = document.createElement('canvas');
        const max_width = 2048;
        const scaleSize = imgElement.width > max_width ? max_width / imgElement.width : 1;
        canvas.width = imgElement.width * scaleSize;
        canvas.height = imgElement.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
        const srcEncoded = ctx.canvas.toDataURL('image/jpeg', 0.9);

        attachedImages.value.push({
          id: Date.now(),
          url: srcEncoded,
          file: imageFile
        });
      };
    };
    reader.readAsDataURL(imageFile);
  }

  // 붙여넣기 핸들러
  function handlePaste(event) {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;

    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        const blob = item.getAsFile();
        processImageLocally(blob);
        return true;
      }
    }
    return false;
  }

  // 이미지 삭제
  function deleteImage(index) {
    attachedImages.value.splice(index, 1);
  }

  // 이미지 초기화
  function clearImages() {
    attachedImages.value = [];
  }

  // 음성 녹음 시작
  async function startVoiceRecording() {
    isMicRecording.value = true;

    if (!navigator.mediaDevices) {
      alert('getUserMedia를 지원하지 않는 브라우저입니다.');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micRecorder.value = new MediaRecorder(stream);
    micAudioChunks.value = [];
    
    micRecorder.value.ondataavailable = (e) => {
      micAudioChunks.value.push(e.data);
    };
    
    micRecorder.value.start();
  }

  // 음성 녹음 중지
  async function stopVoiceRecording() {
    isMicRecording.value = false;

    if (micRecorder.value && micRecorder.value.state === 'recording') {
      return new Promise((resolve) => {
        micRecorder.value.onstop = async () => {
          const audioBlob = new Blob(micAudioChunks.value, { type: 'audio/wav' });
          const transcript = await uploadAudio(audioBlob);
          resolve(transcript);
        };
        micRecorder.value.stop();
      });
    }
    return '';
  }

  // 오디오 업로드
  async function uploadAudio(audioBlob) {
    isMicRecorderLoading.value = true;

    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
      const response = await axios.post('/completion/upload', formData);
      return response.data.transcript;
    } catch (error) {
      console.error('Error:', error);
      return '';
    } finally {
      isMicRecorderLoading.value = false;
    }
  }

  // 전체 녹음 시작 (Record 컴포넌트용)
  async function startRecording() {
    isRecording.value = true;

    if (!navigator.mediaDevices) {
      alert('getUserMedia를 지원하지 않는 브라우저입니다.');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.value = new MediaRecorder(stream);
    audioChunks.value = [];
    
    mediaRecorder.value.ondataavailable = (e) => {
      audioChunks.value.push(e.data);
    };
    
    mediaRecorder.value.start();
  }

  // 전체 녹음 중지
  async function stopRecording() {
    isRecording.value = false;

    if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
      return new Promise((resolve) => {
        mediaRecorder.value.onstop = async () => {
          const audioBlob = new Blob(audioChunks.value, { type: 'audio/wav' });
          const transcript = await uploadAudio(audioBlob);
          resolve(transcript);
        };
        mediaRecorder.value.stop();
      });
    }
    return '';
  }

  // 파일 업로드
  async function submitFile(chatRoomId, userName) {
    if (!file.value) return;

    const fileName = file.value[0].name;
    const fileObj = {
      chat_room_id: chatRoomId,
      user_name: userName
    };

    await backend.uploadFile(fileName, file.value[0], fileObj);
    file.value = null;
  }

  return {
    attachedImages,
    file,
    isRecording,
    isMicRecording,
    isMicRecorderLoading,
    changeImage,
    handlePaste,
    deleteImage,
    clearImages,
    startVoiceRecording,
    stopVoiceRecording,
    startRecording,
    stopRecording,
    submitFile
  };
}