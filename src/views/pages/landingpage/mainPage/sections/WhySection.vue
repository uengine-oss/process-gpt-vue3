<template>
  <section id="why" class="why">
    <div class="container mx-auto px-4">
      <h2 class="text-3xl font-bold text-center mb-12">Why Process GPT?</h2>
      <div class="text-center mb-12">
        <p>{{ $t('WhySection.subtitle1') }}</p>
        <p>{{ $t('WhySection.subtitle2') }}</p>
      </div>
        
      <div style="max-width: 1000px; margin: 0 auto;">
        <table class="tbl-default">
          <tr class="border-bottom-n">
            <th class="tbl-title-md-gray" style="width: 15%;">항목</th>
            <th class="tbl-title-md-gray" style="width: 20%;">ChatGPT</th>
            <th class="tbl-title-md-gray" style="width: 20%;">Microsoft Copilot</th>
            <th class="tbl-title-md-gray" style="width: 35%;">Process GPT</th>
          </tr>
          <tr>
            <td class="border-left-n" style="font-weight: 600;">역할</td>
            <td>대화형 조언자</td>
            <td>생산성 도구의 보조자</td>
            <td>업무 프로세스를 실행하는 AI 팀</td>
          </tr>
          <tr>
            <td class="border-left-n" style="font-weight: 600;">동작 방식</td>
            <td>질문 → 답변</td>
            <td>입력 → 요약/작성</td>
            <td>목표 입력 → 워크차트 생성 → Agent가 자동 실행</td>
          </tr>
          <tr>
            <td class="border-left-n" style="font-weight: 600;">연동범위</td>
            <td>없음 (브라우저 기반)</td>
            <td>M365 생태계 연동</td>
            <td>PPT, Word, ERP,, API 등 외부 시스템과 연동</td>
          </tr>
          <tr>
            <td class="border-left-n" style="font-weight: 600;">학습/개선</td>
            <td>단발성 응답, 지속 학습 없음</td>
            <td>파일/작업 단위</td>
            <td>온톨로지 기반 피드백 루프 → 실행 경험 누적 개선</td>
          </tr>
          <tr>
            <td class="border-left-n" style="font-weight: 600;">적용 대상</td>
            <td>일반 지식 탐색</td>
            <td>사무업무 생산성 향상</td>
            <td>다양한 산업과 부서의 실제 업무에  적용 가능</td>
        </tr>
      </table>
      </div>
  </div>
  </section>
</template>

<script>
export default {
  name: 'WhySection'
}
</script>

<style scoped>
.why {
  padding: 80px 0;
  background-color: var(--light-color);
  /* background-color: var(--bg-color); */
  /* padding-bottom: 20px; */
}

.section-header {
  text-align: center;
  margin-bottom: 50px;
}

.section-header h2 {
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--text-color-dark);
  margin-bottom: 15px;
}

.section-header p {
  font-size: 1.1rem;
  color: var(--text-color);
  max-width: 700px;
  margin: 0 auto;
}

/* ==============================
   table style
   ============================== */
.tbl-default {
    width: 100%;
    /* text-align: center; */
    border-collapse: collapse;
    margin-bottom: 40px;
    font-size: 16px;
    line-height: 1.5;
}
.tbl-default tr {
    border-bottom: 1px solid #aaa;
}
.tbl-default td {
    border-left: 1px solid #aaa;
    padding: 5px;
    padding-left: 10px;
}
.tbl-title-md-gray {
    color: #fff;
    background-color: #6b757d ;
    font-weight: 600;
    border: 2px solid var(--light-color);
    border-radius: 7px;
    padding: 10px 5px;
}
.border-bottom-n {
    border-bottom: none !important;
}
.border-left-n {
    border-left: none !important;
}

@media (max-width: 768px) {
.tbl-default td {
    padding-left: 5px;
  }
}
</style>
