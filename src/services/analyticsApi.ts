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
  },

  /**
   * 부서 목록 조회
   */
  async getDepartments() {
    const response = await api.get('/dimensions/departments')
    return response.data
  },

  // ============== BPM Standard Analytics API ==============

  /**
   * 부서별 Task 수량 통계
   */
  async getTasksByDepartment(params: { year?: number; quarter?: number; month?: number } = {}) {
    const response = await api.get('/dashboard/tasks-by-department', { params })
    return response.data
  },

  /**
   * 프로세스별 성능 지표 (Cycle Time, Throughput)
   */
  async getProcessPerformance(params: { year?: number; quarter?: number } = {}) {
    const response = await api.get('/analytics/process-performance', { params })
    return response.data
  },

  /**
   * 병목 분석 (Activity-level Wait/Processing Time)
   */
  async getBottleneckAnalysis(params: { process_key?: number; proc_def_id?: string; year?: number; quarter?: number } = {}) {
    const response = await api.get('/analytics/bottleneck', { params })
    return response.data
  },

  /**
   * 재작업(Rework) 분석
   */
  async getReworkAnalysis(params: { year?: number; quarter?: number } = {}) {
    const response = await api.get('/analytics/rework', { params })
    return response.data
  },

  /**
   * 업무량 분포 (Workload Distribution)
   */
  async getWorkloadDistribution(params: { year?: number; month?: number } = {}) {
    const response = await api.get('/analytics/workload', { params })
    return response.data
  },

  /**
   * 월별 트렌드
   */
  async getMonthlyTrend(params: { year?: number; process_key?: number } = {}) {
    const response = await api.get('/analytics/monthly-trend', { params })
    return response.data
  },

  /**
   * Agent vs Human 비교
   */
  async getAgentVsHumanComparison(params: { year?: number; quarter?: number } = {}) {
    const response = await api.get('/analytics/agent-vs-human', { params })
    return response.data
  },

  /**
   * FTE Heatmap (Process x Department)
   */
  async getFteHeatmap(params: { year?: number; quarter?: number } = {}) {
    const response = await api.get('/analytics/fte-heatmap', { params })
    return response.data
  }
}

// ============== ETL Management API ==============
export const etlApi = {
  /**
   * ETL 수동 실행
   */
  async runEtl() {
    const response = await api.post('/etl/run')
    return response.data
  },

  /**
   * ETL 상태 조회
   */
  async getStatus() {
    const response = await api.get('/etl/status')
    return response.data
  },

  /**
   * ETL 스케줄러 시작 (1분 주기)
   */
  async startScheduler() {
    const response = await api.post('/etl/scheduler/start')
    return response.data
  },

  /**
   * ETL 스케줄러 중지
   */
  async stopScheduler() {
    const response = await api.post('/etl/scheduler/stop')
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
    total_instances: number
    completed: number
    running: number
    avg_duration_sec: number
    total_tasks: number
    human_tasks: number
    agent_tasks: number
  }
  tasks: {
    total_tasks: number
    avg_duration_sec: number
    avg_wait_sec: number
    total_errors: number
    avg_f1_score: number
  }
  usage: {
    total_tokens: number
    total_cost: number
    models_used: number
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

// ============== BPM Analytics Types ==============

export interface DepartmentTaskStats {
  department_name: string
  dept_id: string | null
  total_tasks: number
  agent_tasks: number
  human_tasks: number
  completed_tasks: number
  pending_tasks: number
  avg_duration_sec: number
  total_errors: number
  total_rework: number
}

export interface ProcessPerformanceStats {
  proc_def_id: string
  process_name: string
  total_instances: number
  completed_instances: number
  running_instances: number
  avg_cycle_time_sec: number
  min_cycle_time_sec: number
  max_cycle_time_sec: number
  median_cycle_time_sec: number
  p95_cycle_time_sec: number
  avg_tasks_per_instance: number
  total_errors: number
  total_rework: number
}

export interface BottleneckData {
  activity_id: string
  activity_name: string
  activity_type: string
  process_name: string
  execution_count: number
  avg_processing_time_sec: number
  avg_wait_time_sec: number
  total_processing_time_sec: number
  total_wait_time_sec: number
  error_rate_pct: number
}

export interface ReworkData {
  activity_id: string
  activity_name: string
  department_name: string
  total_tasks: number
  rework_tasks: number
  total_rework_count: number
  rework_rate_pct: number
  first_time_right_pct: number
}

export interface WorkloadData {
  department_name: string
  dept_id: string | null
  user_count: number
  total_tasks: number
  completed_tasks: number
  backlog_tasks: number
  total_work_hours: number
  work_hours_per_user: number
}

export interface MonthlyTrendData {
  year: number
  month: number
  total_tasks: number
  agent_tasks: number
  human_tasks: number
  completed_tasks: number
  avg_duration_sec: number
  total_errors: number
  total_rework: number
}

export interface AgentVsHumanData {
  performer_type: 'AGENT' | 'HUMAN'
  total_tasks: number
  completed_tasks: number
  avg_duration_sec: number
  avg_f1_score: number
  avg_accuracy: number
  error_rate_pct: number
  rework_rate_pct: number
  first_time_right_pct: number
}

export interface FteHeatmapData {
  processes: string[]
  departments: string[]
  matrix: Record<string, Record<string, { fte: number; task_count: number }>>
}

// ============== Department Sync ==============

/**
 * 조직도에서 부서 데이터 동기화
 */
export async function syncDepartmentsFromOrgChart(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supabase = (window as any).$supabase
    const tenantId = (window as any).$tenantName || 'default'

    // 1. 조직도 데이터 가져오기
    const { data: configData, error: configError } = await supabase
      .from('configuration')
      .select('value')
      .eq('key', 'organization')
      .eq('tenant_id', tenantId)
      .single()

    if (configError && configError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch organization: ${configError.message}`)
    }

    if (!configData?.value) {
      return { success: true, count: 0 }
    }

    const orgData = typeof configData.value === 'string'
      ? JSON.parse(configData.value)
      : configData.value

    const orgChart = orgData.chart || orgData

    // 2. 조직도에서 부서/팀 추출
    const departments: Array<{ id: string; name: string; parent_id: string | null; level: number; path: string }> = []

    function extractDepartments(node: any, parentId: string | null = null, level: number = 0, pathPrefix: string = '') {
      if (!node) return

      const name = node.data?.name || node.id || 'Unknown'
      const currentPath = pathPrefix ? `${pathPrefix}/${name}` : `/${name}`

      departments.push({
        id: node.id,
        name: name,
        parent_id: parentId,
        level: level,
        path: currentPath
      })

      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: any) => {
          extractDepartments(child, node.id, level + 1, currentPath)
        })
      }
    }

    extractDepartments(orgChart)

    if (departments.length === 0) {
      return { success: true, count: 0 }
    }

    // 3. departments 테이블에 upsert
    const deptRecords = departments.map(d => ({
      id: d.id,
      name: d.name,
      parent_id: d.parent_id,
      level: d.level,
      path: d.path,
      tenant_id: tenantId
    }))

    const { error: upsertError } = await supabase
      .from('departments')
      .upsert(deptRecords, { onConflict: 'id' })

    if (upsertError) {
      throw new Error(`Failed to upsert departments: ${upsertError.message}`)
    }

    return { success: true, count: departments.length }
  } catch (error: any) {
    console.error('[syncDepartmentsFromOrgChart] Error:', error)
    return { success: false, count: 0, error: error.message }
  }
}

export default api
