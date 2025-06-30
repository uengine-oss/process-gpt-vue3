export const INSTANCE_LIST_CONFIGS = {
    // 전체 인스턴스
    all: {
      title: '전체 인스턴스',
      headers: [
        { text: '인스턴스명', value: 'name' },
        { text: '상태', value: 'status' },
        { text: '프로젝트', value: 'project_name' },
        { text: '시작일', value: 'start_date' },
        { text: '종료일', value: 'end_date' }
      ],
      searchConfig: {
        placeholder: '인스턴스 검색...',
        fields: ['name', 'description']
      },
      filterConfig: {
        label: '상태 필터',
        options: [
          { text: '전체', value: '' },
          { text: '진행중', value: 'IN_PROGRESS' },
          { text: '완료', value: 'DONE' },
          { text: '대기', value: 'PENDING' }
        ]
      }
    },
    
    // 완료된 인스턴스
    completed: {
      title: '완료된 인스턴스',
      headers: [
        { text: '인스턴스명', value: 'name' },
        { text: '프로젝트', value: 'project_name' },
        { text: '완료일', value: 'end_date' }
      ],
      searchConfig: {
        placeholder: '완료된 인스턴스 검색...',
        fields: ['name']
      },
      filterConfig: {
        label: '프로젝트 필터',
        options: [] // 동적으로 채워짐
      }
    },
    
    // 미완료 인스턴스
    incomplete: {
      title: '진행중인 인스턴스',
      headers: [
        { text: '인스턴스명', value: 'name' },
        { text: '상태', value: 'status' },
        { text: '프로젝트', value: 'project_name' },
        { text: '예정 종료일', value: 'end_date' }
      ],
      searchConfig: {
        placeholder: '진행중인 인스턴스 검색...',
        fields: ['name']
      },
      filterConfig: {
        label: '상태 필터',
        options: [
          { text: '진행중', value: 'IN_PROGRESS' },
          { text: '대기', value: 'PENDING' }
        ]
      }
    }
  }
  
  export const PROJECT_LIST_CONFIGS = {
    all: {
      title: '전체 프로젝트',
      headers: [
        { text: '프로젝트명', value: 'name' },
        { text: '상태', value: 'status' },
        { text: '시작일', value: 'start_date' },
        { text: '종료일', value: 'end_date' }
      ],
      searchConfig: {
        placeholder: '프로젝트 검색...',
        fields: ['name', 'description']
      },
      filterConfig: {
        label: '상태 필터',
        options: [
          { text: '전체', value: '' },
          { text: '계획', value: 'PLANNING' },
          { text: '진행중', value: 'IN_PROGRESS' },
          { text: '완료', value: 'COMPLETED' }
        ]
      }
    },
    
    completed: {
      title: '완료된 프로젝트',
      headers: [
        { text: '프로젝트명', value: 'name' },
        { text: '완료일', value: 'end_date' },
        { text: '생성일', value: 'created_date' }
      ],
      searchConfig: {
        placeholder: '완료된 프로젝트 검색...',
        fields: ['name']
      },
      filterConfig: {
        label: '완료일 필터',
        options: [
          { text: '최근 1주', value: 'week' },
          { text: '최근 1개월', value: 'month' },
          { text: '최근 3개월', value: 'quarter' }
        ]
      }
    },
    
    incomplete: {
      title: '진행중인 프로젝트',
      headers: [
        { text: '프로젝트명', value: 'name' },
        { text: '상태', value: 'status' },
        { text: '예정 종료일', value: 'end_date' }
      ],
      searchConfig: {
        placeholder: '진행중인 프로젝트 검색...',
        fields: ['name']
      },
      filterConfig: {
        label: '상태 필터',
        options: [
          { text: '계획', value: 'PLANNING' },
          { text: '진행중', value: 'IN_PROGRESS' }
        ]
      }
    }
  }
  
  export const TASK_LIST_CONFIGS = {
    all: {
      title: '전체 태스크',
      headers: [
        { text: '태스크명', value: 'name' },
        { text: '상태', value: 'status' },
        { text: '담당자', value: 'assignee' },
        { text: '시작일', value: 'start_date' },
        { text: '종료일', value: 'end_date' }
      ],
      searchConfig: {
        placeholder: '태스크 검색...',
        fields: ['name', 'description']
      },
      filterConfig: {
        label: '상태 필터',
        options: [
          { text: '전체', value: '' },
          { text: '할일', value: 'TODO' },
          { text: '진행중', value: 'IN_PROGRESS' },
          { text: '완료', value: 'DONE' }
        ]
      }
    }
  }