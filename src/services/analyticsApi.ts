/**
 * Analytics API Service
 * FastAPI 백엔드 (olap/backend)와 통신하는 API 클라이언트
 */
import axios from 'axios'

const api = axios.create({
  baseURL: '/api/analytics',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.error('Analytics API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// ============== Dashboard & OLAP API ==============
export const olapApi = {
  /**
   * 대시보드 요약 데이터 조회
   */
  async getDashboardSummary() {
    const response = await api.get('/dashboard/summary')
    return response.data
  },

  /**
   * 퍼포먼스 데이터 조회 (Agent vs Human)
   */
  async getPerformance(params: { year?: number; quarter?: number } = {}) {
    const response = await api.get('/dashboard/performance', { params })
    return response.data
  },

  /**
   * 프로세스 인스턴스 목록 조회
   */
  async getInstances(params: { limit?: number; offset?: number } = {}) {
    const response = await api.get('/instances', { params })
    return response.data
  },

  /**
   * 프로세스 차원 데이터 조회
   */
  async getProcesses() {
    const response = await api.get('/dimensions/processes')
    return response.data
  },

  /**
   * 사용자 차원 데이터 조회
   */
  async getUsers() {
    const response = await api.get('/dimensions/users')
    return response.data
  },

  /**
   * 활동 차원 데이터 조회
   */
  async getActivities() {
    const response = await api.get('/dimensions/activities')
    return response.data
  },

  /**
   * 날짜 범위 조회
   */
  async getDateRange() {
    const response = await api.get('/dimensions/dates')
    return response.data
  }
}

// ============== Cube & Pivot API ==============
export const cubeApi = {
  /**
   * 스키마 파일 업로드
   */
  async uploadSchema(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/schema/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  /**
   * 스키마 텍스트 업로드
   */
  async uploadSchemaText(xmlContent: string) {
    const response = await api.post('/schema/upload-text', { xml_content: xmlContent })
    return response.data
  },

  /**
   * 큐브 목록 조회
   */
  async getCubes() {
    const response = await api.get('/cubes')
    return response.data
  },

  /**
   * 큐브 메타데이터 조회
   */
  async getCubeMetadata(cubeName: string) {
    const response = await api.get(`/cube/${cubeName}/metadata`)
    return response.data
  },

  /**
   * 큐브 스키마 설명 조회
   */
  async getCubeSchemaDescription(cubeName: string) {
    const response = await api.get(`/cube/${cubeName}/schema-description`)
    return response.data
  },

  /**
   * 피벗 쿼리 실행
   */
  async executePivotQuery(query: PivotQuery) {
    const response = await api.post('/pivot/query', query)
    return response.data
  },

  /**
   * 피벗 SQL 미리보기
   */
  async previewPivotSQL(query: PivotQuery) {
    const response = await api.post('/pivot/preview-sql', query)
    return response.data
  },

  /**
   * 자연어 질의 실행 (Text2SQL)
   */
  async executeNL2SQL(question: string, cubeName: string | null = null) {
    const response = await api.post('/nl2sql', {
      question,
      cube_name: cubeName
    })
    return response.data
  },

  /**
   * 자연어 SQL 미리보기
   */
  async previewNL2SQL(question: string, cubeName: string | null = null) {
    const response = await api.post('/nl2sql/preview', {
      question,
      cube_name: cubeName
    })
    return response.data
  },

  /**
   * 헬스 체크
   */
  async healthCheck() {
    const response = await api.get('/health')
    return response.data
  }
}

// ============== Type Definitions ==============
export interface PivotField {
  dimension: string
  level: string
}

export interface PivotMeasure {
  name: string
}

export interface FilterCondition {
  dimension: string
  level: string
  operator: string
  values: any[]
}

export interface PivotQuery {
  cube_name: string
  rows: PivotField[]
  columns: PivotField[]
  measures: PivotMeasure[]
  filters: FilterCondition[]
  limit?: number
}

export interface QueryResult {
  sql: string
  columns: string[]
  rows: Record<string, any>[]
  row_count: number
  execution_time_ms: number
  error?: string
}

export interface DashboardSummary {
  instances: {
    total: number
    completed: number
    running: number
    agent_tasks: number
    human_tasks: number
  }
  tasks: {
    total_tasks: number
    avg_duration_sec: number
  }
  usage: {
    total_tokens: number
    total_cost: number
  }
}

export interface PerformanceData {
  year: number
  month: number
  performer_type: 'AGENT' | 'HUMAN'
  task_count: number
  avg_f1: number
  avg_accuracy: number
  avg_duration_sec: number
  error_count: number
}

export default api
