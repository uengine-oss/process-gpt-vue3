<template>
  <div class="fullscreen-overlay">
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card class="pa-5">
          <v-card-title class="text-h4 font-weight-bold mb-4">
            <v-icon size="large" class="mr-3" color="primary">mdi-clipboard-text</v-icon>
            주거 시설 민원 게시판
          </v-card-title>
          <v-card-subtitle class="text-subtitle-1 mb-6">
            주민 여러분의 불편사항을 접수하고 신속하게 처리합니다
          </v-card-subtitle>

          <!-- 통계 카드 -->  
          <v-row class="mb-6">
            <v-col cols="12" md="3">
              <v-card color="primary" dark>
                <v-card-text class="text-center">
                  <div class="text-h4 font-weight-bold">{{ complaints.length }}</div>
                  <div class="text-subtitle-1">총 민원 건수</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card color="warning" dark>
                <v-card-text class="text-center">
                  <div class="text-h4 font-weight-bold">{{ getStatusCount('접수') }}</div>
                  <div class="text-subtitle-1">접수 대기</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card color="info" dark>
                <v-card-text class="text-center">
                  <div class="text-h4 font-weight-bold">{{ getStatusCount('처리중') }}</div>
                  <div class="text-subtitle-1">처리중</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card color="success" dark>
                <v-card-text class="text-center">
                  <div class="text-h4 font-weight-bold">{{ getStatusCount('완료') }}</div>
                  <div class="text-subtitle-1">처리 완료</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- 민원 목록 테이블 -->
          <v-card elevation="2">
            <v-card-title class="bg-grey-lighten-4">
              <v-icon class="mr-2">mdi-format-list-bulleted</v-icon>
              민원 목록
              <v-spacer></v-spacer>
              <v-chip class="mr-2" color="primary" label>
                <v-icon start>mdi-filter</v-icon>
                전체 보기
              </v-chip>
            </v-card-title>
            <v-divider></v-divider>

            <v-list lines="three">
              <template v-for="(complaint, index) in complaints" :key="complaint.id">
                <v-list-item @click="openDialog(complaint)" class="complaint-item">
                  <template v-slot:prepend>
                    <v-avatar :color="getCategoryColor(complaint.category)" size="56">
                      <v-icon size="32" color="white">{{ getCategoryIcon(complaint.category) }}</v-icon>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="text-h6 mb-2">
                    {{ complaint.title }}
                  </v-list-item-title>

                  <v-list-item-subtitle class="mb-2">
                    <v-chip size="small" :color="getStatusColor(complaint.status)" class="mr-2" label>
                      {{ complaint.status }}
                    </v-chip>
                    <v-chip size="small" :color="getUrgencyColor(complaint.urgency)" class="mr-2" label>
                      {{ complaint.urgency }}
                    </v-chip>
                  </v-list-item-subtitle>

                  <v-list-item-subtitle>
                    <v-icon size="small" class="mr-1">mdi-map-marker</v-icon>
                    {{ complaint.location }} | 
                    <v-icon size="small" class="ml-2 mr-1">mdi-calendar</v-icon>
                    {{ complaint.date }} | 
                    <v-icon size="small" class="ml-2 mr-1">mdi-account</v-icon>
                    {{ complaint.reporter }}
                  </v-list-item-subtitle>

                  <template v-slot:append>
                    <v-btn 
                      icon 
                      variant="text" 
                      color="primary"
                      @click.stop="openDialog(complaint)"
                    >
                      <v-icon>mdi-chevron-right</v-icon>
                    </v-btn>
                  </template>
                </v-list-item>
                <v-divider v-if="index < complaints.length - 1" :key="'divider-' + complaint.id"></v-divider>
              </template>
            </v-list>
          </v-card>
        </v-card>
      </v-col>
    </v-row>

    <!-- 민원 상세 다이얼로그 -->
    <v-dialog v-model="dialog" max-width="800px">
      <v-card v-if="selectedComplaint">
        <v-card-title class="text-h5 bg-primary text-white">
          <v-icon class="mr-2" color="white">{{ getCategoryIcon(selectedComplaint.category) }}</v-icon>
          민원 상세 정보
          <v-spacer></v-spacer>
          <v-btn icon @click="dialog = false" color="white" variant="text">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text class="mt-4">
          <!-- 기본 정보 -->
          <v-row>
            <v-col cols="12">
              <div class="text-h5 font-weight-bold mb-4">{{ selectedComplaint.title }}</div>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-list density="compact">
                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-calendar</v-icon>
                  </template>
                  <v-list-item-title>접수일</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedComplaint.date }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-map-marker</v-icon>
                  </template>
                  <v-list-item-title>발생 위치</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedComplaint.location }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-account</v-icon>
                  </template>
                  <v-list-item-title>신고자</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedComplaint.reporter }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>

            <v-col cols="12" md="6">
              <v-list density="compact">
                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-tag</v-icon>
                  </template>
                  <v-list-item-title>카테고리</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="small" :color="getCategoryColor(selectedComplaint.category)">
                      {{ selectedComplaint.category }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-alert-circle</v-icon>
                  </template>
                  <v-list-item-title>긴급도</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="small" :color="getUrgencyColor(selectedComplaint.urgency)">
                      {{ selectedComplaint.urgency }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-progress-check</v-icon>
                  </template>
                  <v-list-item-title>처리 상태</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="small" :color="getStatusColor(selectedComplaint.status)">
                      {{ selectedComplaint.status }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>

          <!-- 민원 내용 -->
          <div class="mb-4">
            <div class="text-h6 font-weight-bold mb-2">
              <v-icon class="mr-2">mdi-text-box</v-icon>민원 내용
            </div>
            <v-card variant="outlined" class="pa-4 bg-grey-lighten-5">
              <div class="text-body-1">{{ selectedComplaint.description }}</div>
            </v-card>
          </div>

        </v-card-text>

        <v-card-actions class="justify-end pa-4 bg-grey-lighten-4">
          <v-btn color="grey" @click="dialog = false" variant="text">
            닫기
          </v-btn>
          <v-btn color="primary" @click="dialog = false" variant="flat">
            확인
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Complaint {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  urgency: string;
  date: string;
  location: string;
  reporter: string;
  assignedTo: string;
  reason: string;
  action: string;
  priority: number;
}

const dialog = ref(false);
const selectedComplaint = ref<Complaint | null>(null);

// 하드코딩된 민원 데이터
const complaints = ref<Complaint[]>([
  {
    id: 1,
    title: '수도 공급 중단',
    description: '집에 물이 안 나와요. 수도꼭지를 틀어도 물이 한 방울도 안 나옵니다. 아침부터 계속 이런 상태예요.',
    category: '상수도',
    status: '처리중',
    urgency: '높음',
    date: '2025-11-06 08:30',
    location: '101동 502호',
    reporter: '김민수',
    assignedTo: '상수도 유지보수 관리자',
    reason: '수도 공급 중단은 일상생활에 필수적인 문제로 즉시 해결 필요',
    action: '건물 전체 수도 공급 상태 확인, 배관 점검',
    priority: 1
  },
  {
    id: 2,
    title: '보일러 작동 불량',
    description: '보일러가 작동을 안 해서 집이 너무 추워요. 온수도 안 나옵니다. 날씨가 추운데 빨리 고쳐주세요.',
    category: '난방',
    status: '접수',
    urgency: '높음',
    date: '2025-11-05 19:45',
    location: '203동 1205호',
    reporter: '이영희',
    assignedTo: '난방 시스템 관리자',
    reason: '겨울철 난방 중단은 건강에 위험할 수 있어 긴급 처리 필요',
    action: '보일러 점검, 가스 공급 확인, 필요시 임시 난방 제공',
    priority: 1
  },
  {
    id: 3,
    title: '가스 누출 의심',
    description: '집에서 가스 냄새가 나는 것 같아요. 확실하지는 않지만 걱정돼서 신고합니다.',
    category: '가스',
    status: '완료',
    urgency: '매우 높음',
    date: '2025-11-04 14:20',
    location: '105동 803호',
    reporter: '박철수',
    assignedTo: '가스 안전 관리자',
    reason: '가스 누출은 폭발 위험이 있어 즉각 대응 필수',
    action: '즉시 환기, 가스 밸브 차단, 전기 스위치 조작 금지, 대피',
    priority: 1
  },
  {
    id: 4,
    title: '천장 누수 발생',
    description: '천장에서 물이 떨어져요. 위층에서 누수가 있는 것 같아요. 벽지도 젖어서 곰팡이가 생길 것 같습니다.',
    category: '누수/방수',
    status: '처리중',
    urgency: '높음',
    date: '2025-11-03 11:15',
    location: '302동 704호',
    reporter: '정수진',
    assignedTo: '방수/누수 전문가',
    reason: '층간 누수는 재산 피해가 크고 2차 피해 가능성이 있어 긴급 처리 필요',
    action: '위층 세대 확인, 누수 지점 파악, 응급 방수 조치',
    priority: 1
  },
  {
    id: 5,
    title: '해충 출몰 (바퀴벌레)',
    description: '집에 바퀴벌레가 너무 많이 나와요. 특히 주방에서 많이 보입니다. 방역을 해주세요.',
    category: '방역/해충',
    status: '처리중',
    urgency: '보통',
    date: '2025-11-02 16:30',
    location: '401동 305호',
    reporter: '최지훈',
    assignedTo: '방역/해충 관리자',
    reason: '위생 문제로 빠른 처리가 필요하나 생명에 지장은 없음',
    action: '방역 일정 수립, 주변 세대 동시 방역 고려, 청결 유지 안내',
    priority: 3
  }
]);

// 상태별 카운트
const getStatusCount = (status: string) => {
  return complaints.value.filter(c => c.status === status).length;
};

// 카테고리별 색상
const getCategoryColor = (category: string) => {
  const colors: { [key: string]: string } = {
    '상수도': 'blue',
    '난방': 'orange',
    '전기': 'yellow',
    '보안': 'purple',
    '가스': 'red',
    '방역/해충': 'green',
    '누수/방수': 'cyan',
    '엘리베이터': 'indigo',
    '시설관리': 'brown',
    '냉방': 'light-blue'
  };
  return colors[category] || 'grey';
};

// 카테고리별 아이콘
const getCategoryIcon = (category: string) => {
  const icons: { [key: string]: string } = {
    '상수도': 'mdi-water',
    '난방': 'mdi-radiator',
    '전기': 'mdi-lightning-bolt',
    '보안': 'mdi-shield-lock',
    '가스': 'mdi-gas-cylinder',
    '방역/해충': 'mdi-bug',
    '누수/방수': 'mdi-water-alert',
    '엘리베이터': 'mdi-elevator',
    '시설관리': 'mdi-tools',
    '냉방': 'mdi-air-conditioner'
  };
  return icons[category] || 'mdi-help-circle';
};

// 상태별 색상
const getStatusColor = (status: string) => {
  const colors: { [key: string]: string } = {
    '접수': 'warning',
    '처리중': 'info',
    '완료': 'success',
    '보류': 'grey'
  };
  return colors[status] || 'grey';
};

// 긴급도별 색상
const getUrgencyColor = (urgency: string) => {
  const colors: { [key: string]: string } = {
    '매우 높음': 'red',
    '높음': 'orange',
    '보통': 'blue',
    '낮음': 'grey'
  };
  return colors[urgency] || 'grey';
};

// 우선순위별 색상
const getPriorityColor = (priority: number) => {
  if (priority === 1) return 'red';
  if (priority === 2) return 'orange';
  if (priority === 3) return 'yellow';
  return 'green';
};

// 다이얼로그 열기
const openDialog = (complaint: Complaint) => {
  selectedComplaint.value = complaint;
  dialog.value = true;
};
</script>

<style scoped>
.fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background-color: white;
  z-index: 9999;
  overflow-y: auto;
}

.complaint-item {
  cursor: pointer;
  transition: background-color 0.3s;
}

.complaint-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.v-card {
  border-radius: 12px !important;
}

.v-list-item-title {
  white-space: normal;
  line-height: 1.4;
}
</style>

