import { MarkerType } from '@vue-flow/core'

export const initialNodes = [
  // 시작 노드들
  {
    id: '1',
    type: 'input',
    position: { x: 50, y: 50 },
    label: '시작',
  },
  {
    id: '2',
    type: 'input',
    position: { x: 50, y: 150 },
    label: '시작',
  },
  
  // 고객센터 - 정약접수
  {
    id: '3',
    type: 'process',
    position: { x: 200, y: 80 },
    data: {
      header: '고객센터',
      content: '정약접수',
      footer: 'BSS',
    },
  },
  
  // 중간 노드
  {
    id: '4',
    type: 'default',
    position: { x: 400, y: 100 },
    label: '100s',
    style: {
      background: '#fff',
      border: '2px solid #4CAF50',
      borderRadius: '50%',
      width: '50px',
      height: '50px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
    },
  },
  
  // CS지원팀 - 부문확숙
  {
    id: '5',
    type: 'process',
    position: { x: 200, y: 220 },
    data: {
      header: 'CS지원팀',
      content: '부문확숙',
      footer: 'Off-line',
    },
  },
  
  // 시간 표시 노드
  {
    id: '6',
    type: 'default',
    position: { x: 520, y: 150 },
    label: '50s',
    style: {
      background: 'transparent',
      border: 'none',
      fontSize: '11px',
    },
  },
  
  {
    id: '7',
    type: 'default',
    position: { x: 600, y: 80 },
    label: '1h',
    style: {
      background: 'transparent',
      border: 'none',
      fontSize: '11px',
    },
  },
  
  // 변경기사 - 출동
  {
    id: '8',
    type: 'process',
    position: { x: 200, y: 380 },
    data: {
      header: '변경기사',
      content: '출동',
      footer: 'Off-line',
    },
  },
  
  // 변경기사 - 예약접수
  {
    id: '9',
    type: 'process',
    position: { x: 450, y: 380 },
    data: {
      header: '변경기사',
      content: '예약접수',
      footer: 'OSS-OM',
    },
  },
  
  // 시간 노드
  {
    id: '10',
    type: 'default',
    position: { x: 380, y: 320 },
    label: '10d',
    style: {
      background: '#fff',
      border: '2px solid #2196F3',
      borderRadius: '50%',
      width: '50px',
      height: '50px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
    },
  },
  
  // 현장기사 - 시설확인
  {
    id: '11',
    type: 'process',
    position: { x: 200, y: 520 },
    data: {
      header: '현장기사',
      content: '시설확인',
      footer: 'Off-line',
    },
  },
  
  // 시간 표시
  {
    id: '12',
    type: 'default',
    position: { x: 350, y: 480 },
    label: '50s',
    style: {
      background: 'transparent',
      border: 'none',
      fontSize: '11px',
    },
  },
  
  // 현장기사 - 특정전환
  {
    id: '13',
    type: 'process',
    position: { x: 50, y: 660 },
    data: {
      header: '현장기사',
      content: '특정전환',
      footer: 'OSS-OM',
    },
  },
  
  // 현장기사 - 시설변경
  {
    id: '14',
    type: 'process',
    position: { x: 250, y: 660 },
    data: {
      header: '현장기사',
      content: '시설변경',
      footer: 'OSS-OM',
    },
  },
  
  // 시간 표시
  {
    id: '15',
    type: 'default',
    position: { x: 150, y: 610 },
    label: '8d',
    style: {
      background: 'transparent',
      border: 'none',
      fontSize: '11px',
    },
  },
  
  // 종료 노드
  {
    id: '16',
    type: 'output',
    position: { x: 150, y: 780 },
    label: '종료',
    style: {
      background: '#fff',
      border: '3px solid #333',
      borderRadius: '50%',
      width: '60px',
      height: '60px',
    },
  },
  
  // 추가 종료 노드
  {
    id: '17',
    type: 'default',
    position: { x: 650, y: 250 },
    label: '10m',
    style: {
      background: '#fff',
      border: '2px solid #00BCD4',
      borderRadius: '50%',
      width: '50px',
      height: '50px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
    },
  },
]

export const initialEdges = [
  // 시작점에서 고객센터로
  { 
    id: 'e1-3', 
    source: '1', 
    target: '3',
    animated: false,
  },
  { 
    id: 'e2-5', 
    source: '2', 
    target: '5',
    animated: false,
  },
  
  // 고객센터에서 중간 노드로
  { 
    id: 'e3-4', 
    source: '3', 
    target: '4',
    animated: false,
  },
  
  // CS지원팀에서 변경기사로
  { 
    id: 'e5-8', 
    source: '5', 
    target: '8',
    animated: false,
  },
  
  // 변경기사 출동에서 시설확인으로
  { 
    id: 'e8-11', 
    source: '8', 
    target: '11',
    animated: false,
  },
  
  // 변경기사 예약접수로
  { 
    id: 'e5-9', 
    source: '5', 
    target: '9',
    animated: false,
    type: 'smoothstep',
  },
  
  // 시설확인에서 특정전환, 시설변경으로
  { 
    id: 'e11-13', 
    source: '11', 
    target: '13',
    animated: false,
  },
  { 
    id: 'e11-14', 
    source: '11', 
    target: '14',
    animated: false,
  },
  
  // 종료 노드로
  { 
    id: 'e13-16', 
    source: '13', 
    target: '16',
    animated: false,
  },
  { 
    id: 'e14-16', 
    source: '14', 
    target: '16',
    animated: false,
  },
  
  // 곡선 연결 (예약접수에서 종료로)
  { 
    id: 'e9-17', 
    source: '9', 
    target: '17',
    animated: false,
    type: 'smoothstep',
    style: { stroke: '#ff6b6b', strokeWidth: 2 },
    markerEnd: MarkerType.ArrowClosed,
  },
  
  // 17에서 16으로 긴 곡선
  { 
    id: 'e17-16', 
    source: '17', 
    target: '16',
    animated: false,
    type: 'smoothstep',
    style: { stroke: '#ff6b6b', strokeWidth: 2 },
    markerEnd: MarkerType.ArrowClosed,
  },
]

