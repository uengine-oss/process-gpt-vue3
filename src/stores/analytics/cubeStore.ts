/**
 * Cube Store
 * 큐브 메타데이터 및 피벗 테이블 상태 관리
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { cubeApi, type PivotQuery, type PivotField, type PivotMeasure, type FilterCondition, type QueryResult } from '@/services/analyticsApi'

interface Dimension {
  name: string
  table: string
  foreign_key?: string
  levels: Level[]
  type?: string
}

interface Level {
  name: string
  column: string
  order_column?: string
}

interface Measure {
  name: string
  column: string
  agg: string
  type?: string
}

interface CubeMetadata {
  name: string
  fact_table: string
  dimensions: Dimension[]
  measures: Measure[]
}

interface PivotConfig {
  rows: PivotField[]
  columns: PivotField[]
  measures: PivotMeasure[]
  filters: FilterCondition[]
}

export const useCubeStore = defineStore('cube', () => {
  // ============== State ==============
  const cubes = ref<string[]>([])
  const currentCube = ref<string | null>(null)
  const cubeMetadata = ref<CubeMetadata | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Pivot configuration
  const pivotConfig = ref<PivotConfig>({
    rows: [],
    columns: [],
    measures: [],
    filters: []
  })

  // Drill-down state: tracks expanded items
  // Format: { 'type:dimension:level:value': true }
  const expandedItems = ref<Record<string, boolean>>({})

  // Query results
  const queryResult = ref<QueryResult | null>(null)
  const generatedSQL = ref('')

  // ============== Computed ==============
  const hasCubes = computed(() => cubes.value.length > 0)

  const dimensions = computed(() => {
    if (!cubeMetadata.value) return []
    return cubeMetadata.value.dimensions.map(dim => ({
      ...dim,
      type: 'dimension'
    }))
  })

  const measures = computed(() => {
    if (!cubeMetadata.value) return []
    return cubeMetadata.value.measures.map(m => ({
      ...m,
      type: 'measure'
    }))
  })

  // ============== Helper Functions ==============

  /**
   * 다음 레벨 조회
   */
  function getNextLevel(dimensionName: string, currentLevel: string): Level | null {
    const dim = cubeMetadata.value?.dimensions.find(d => d.name === dimensionName)
    if (!dim || !dim.levels) return null

    const currentIndex = dim.levels.findIndex(l => l.name === currentLevel)
    if (currentIndex === -1 || currentIndex >= dim.levels.length - 1) {
      return null
    }

    return dim.levels[currentIndex + 1]
  }

  /**
   * 다음 레벨 존재 여부 확인
   */
  function hasNextLevel(dimensionName: string, currentLevel: string): boolean {
    return getNextLevel(dimensionName, currentLevel) !== null
  }

  /**
   * 차원 계층 정보 조회
   */
  function getDimensionHierarchy(dimensionName: string): Level[] {
    const dim = cubeMetadata.value?.dimensions.find(d => d.name === dimensionName)
    return dim?.levels || []
  }

  // ============== Actions ==============

  /**
   * 스키마 파일 업로드
   */
  async function uploadSchema(file: File) {
    loading.value = true
    error.value = null
    try {
      const metadata = await cubeApi.uploadSchema(file)
      await loadCubes()
      return metadata
    } catch (e: any) {
      error.value = e.response?.data?.detail || e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 스키마 텍스트 업로드
   */
  async function uploadSchemaText(xmlContent: string) {
    loading.value = true
    error.value = null
    try {
      const metadata = await cubeApi.uploadSchemaText(xmlContent)
      await loadCubes()
      return metadata
    } catch (e: any) {
      error.value = e.response?.data?.detail || e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 큐브 목록 로드
   */
  async function loadCubes() {
    loading.value = true
    error.value = null
    try {
      const response = await cubeApi.getCubes()
      cubes.value = response.cubes || []

      // 첫 번째 큐브 자동 선택
      if (cubes.value.length > 0 && !currentCube.value) {
        await selectCube(cubes.value[0])
      }
    } catch (e: any) {
      error.value = e.response?.data?.detail || e.message
    } finally {
      loading.value = false
    }
  }

  /**
   * 큐브 선택
   */
  async function selectCube(cubeName: string) {
    loading.value = true
    error.value = null
    try {
      const metadata = await cubeApi.getCubeMetadata(cubeName)
      currentCube.value = cubeName
      cubeMetadata.value = metadata
      resetPivotConfig()
    } catch (e: any) {
      error.value = e.response?.data?.detail || e.message
    } finally {
      loading.value = false
    }
  }

  /**
   * 피벗 설정 초기화
   */
  function resetPivotConfig() {
    pivotConfig.value = {
      rows: [],
      columns: [],
      measures: [],
      filters: []
    }
    expandedItems.value = {}
    queryResult.value = null
    generatedSQL.value = ''
  }

  /**
   * 행에 필드 추가
   */
  function addToRows(field: PivotField) {
    if (!pivotConfig.value.rows.find(f => f.dimension === field.dimension && f.level === field.level)) {
      pivotConfig.value.rows.push({ ...field })
    }
  }

  /**
   * 열에 필드 추가
   */
  function addToColumns(field: PivotField) {
    if (!pivotConfig.value.columns.find(f => f.dimension === field.dimension && f.level === field.level)) {
      pivotConfig.value.columns.push({ ...field })
    }
  }

  /**
   * 측정값 추가
   */
  function addMeasure(measure: PivotMeasure) {
    if (!pivotConfig.value.measures.find(m => m.name === measure.name)) {
      pivotConfig.value.measures.push({ name: measure.name })
    }
  }

  /**
   * 행에서 제거
   */
  function removeFromRows(index: number) {
    pivotConfig.value.rows.splice(index, 1)
  }

  /**
   * 열에서 제거
   */
  function removeFromColumns(index: number) {
    pivotConfig.value.columns.splice(index, 1)
  }

  /**
   * 측정값 제거
   */
  function removeMeasure(index: number) {
    pivotConfig.value.measures.splice(index, 1)
  }

  /**
   * 필터 추가
   */
  function addFilter(filter: FilterCondition) {
    pivotConfig.value.filters.push(filter)
  }

  /**
   * 필터 제거
   */
  function removeFilter(index: number) {
    pivotConfig.value.filters.splice(index, 1)
  }

  /**
   * 열 드릴다운
   */
  async function drillDownColumn(dimensionName: string, currentLevel: string, value: string) {
    const key = `col:${dimensionName}:${currentLevel}:${value}`

    if (expandedItems.value[key]) {
      delete expandedItems.value[key]
    } else {
      expandedItems.value[key] = true
    }

    await executePivotQueryWithDrillDown()
  }

  /**
   * 행 드릴다운
   */
  async function drillDownRow(dimensionName: string, currentLevel: string, value: string) {
    const key = `row:${dimensionName}:${currentLevel}:${value}`

    if (expandedItems.value[key]) {
      delete expandedItems.value[key]
    } else {
      expandedItems.value[key] = true
    }

    await executePivotQueryWithDrillDown()
  }

  /**
   * 확장 상태 확인
   */
  function isExpanded(type: string, dimensionName: string, level: string, value: string): boolean {
    const key = `${type}:${dimensionName}:${level}:${value}`
    return !!expandedItems.value[key]
  }

  /**
   * 드릴다운이 적용된 쿼리 설정 구성
   */
  function buildDrillDownConfig(): PivotConfig {
    const config: PivotConfig = {
      rows: [...pivotConfig.value.rows],
      columns: [...pivotConfig.value.columns],
      measures: [...pivotConfig.value.measures],
      filters: [...pivotConfig.value.filters]
    }

    for (const key of Object.keys(expandedItems.value)) {
      const [type, dimName, level, value] = key.split(':')
      const nextLevel = getNextLevel(dimName, level)

      if (nextLevel) {
        if (type === 'col') {
          const exists = config.columns.find(
            c => c.dimension === dimName && c.level === nextLevel.name
          )
          if (!exists) {
            const currentIdx = config.columns.findIndex(
              c => c.dimension === dimName && c.level === level
            )
            if (currentIdx !== -1) {
              config.columns.splice(currentIdx + 1, 0, {
                dimension: dimName,
                level: nextLevel.name
              })
            }
          }
        } else if (type === 'row') {
          const exists = config.rows.find(
            r => r.dimension === dimName && r.level === nextLevel.name
          )
          if (!exists) {
            const currentIdx = config.rows.findIndex(
              r => r.dimension === dimName && r.level === level
            )
            if (currentIdx !== -1) {
              config.rows.splice(currentIdx + 1, 0, {
                dimension: dimName,
                level: nextLevel.name
              })
            }
          }
        }

        config.filters.push({
          dimension: dimName,
          level: level,
          operator: '=',
          values: [value]
        })
      }
    }

    return config
  }

  /**
   * 피벗 쿼리 실행
   */
  async function executePivotQuery() {
    expandedItems.value = {}
    await executePivotQueryWithDrillDown()
  }

  /**
   * 드릴다운이 적용된 피벗 쿼리 실행
   */
  async function executePivotQueryWithDrillDown() {
    if (!currentCube.value) {
      error.value = 'No cube selected'
      return
    }

    loading.value = true
    error.value = null

    try {
      const config = buildDrillDownConfig()
      const query: PivotQuery = {
        cube_name: currentCube.value,
        ...config
      }

      const result = await cubeApi.executePivotQuery(query)
      queryResult.value = result
      generatedSQL.value = result.sql

      if (result.error) {
        error.value = result.error
      }
    } catch (e: any) {
      error.value = e.response?.data?.detail || e.message
    } finally {
      loading.value = false
    }
  }

  /**
   * SQL 미리보기
   */
  async function previewSQL(): Promise<string> {
    if (!currentCube.value) return ''

    try {
      const config = buildDrillDownConfig()
      const query: PivotQuery = {
        cube_name: currentCube.value,
        ...config
      }

      const result = await cubeApi.previewPivotSQL(query)
      generatedSQL.value = result.sql
      return result.sql
    } catch (e: any) {
      error.value = e.response?.data?.detail || e.message
      return ''
    }
  }

  /**
   * 자연어 쿼리 실행
   */
  async function executeNaturalQuery(question: string) {
    if (!currentCube.value) {
      error.value = 'No cube selected'
      return
    }

    loading.value = true
    error.value = null

    try {
      const result = await cubeApi.executeNL2SQL(question, currentCube.value)
      queryResult.value = result
      generatedSQL.value = result.sql

      if (result.error) {
        error.value = result.error
      }

      return result
    } catch (e: any) {
      error.value = e.response?.data?.detail || e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    cubes,
    currentCube,
    cubeMetadata,
    loading,
    error,
    pivotConfig,
    expandedItems,
    queryResult,
    generatedSQL,

    // Computed
    hasCubes,
    dimensions,
    measures,

    // Actions
    uploadSchema,
    uploadSchemaText,
    loadCubes,
    selectCube,
    resetPivotConfig,
    addToRows,
    addToColumns,
    addMeasure,
    removeFromRows,
    removeFromColumns,
    removeMeasure,
    addFilter,
    removeFilter,
    executePivotQuery,
    previewSQL,
    executeNaturalQuery,

    // Drill-down
    drillDownColumn,
    drillDownRow,
    isExpanded,
    hasNextLevel,
    getNextLevel,
    getDimensionHierarchy,
    buildDrillDownConfig
  }
})
