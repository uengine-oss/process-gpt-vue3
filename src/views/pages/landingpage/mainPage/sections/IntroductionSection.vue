<template>
    <section class="introduction-section">
      <div class="container">
        <!-- 인트로 타이틀 -->
        <div class="intro-header">
          <h2 class="intro-title">
            {{ $t('IntroductionSection.title1') }}<br>
          </h2>
        </div>

        <!-- MS Work Trend Index 2025 표 -->
        <div class="ai3steps-table-container">
          <table class="tbl-default">
            <tr class="border-bottom-n">
              <th class="tbl-title-md-gray" style="width: 15%;">{{ $t('AI3StepsSection.category') }}</th>
              <th class="tbl-title-md-gray" style="width: 22%;">{{ $t('AI3StepsSection.step1') }}</th>
              <th class="tbl-title-md-gray" style="width: 23%;">{{ $t('AI3StepsSection.step2') }}</th>
              <th class="tbl-title-md-gray" style="width: 30%;">{{ $t('AI3StepsSection.step3') }}</th>
            </tr>
            <tr>
              <td class="border-left-n" style="font-weight: 600;">{{ $t('AI3StepsSection.role') }}</td>
              <td v-html="$t('AI3StepsSection.role1')"></td>
              <td v-html="$t('AI3StepsSection.role2')"></td>
              <td v-html="$t('AI3StepsSection.role3')"></td>
            </tr>
            <tr>
              <td class="border-left-n" style="font-weight: 600;">{{ $t('AI3StepsSection.scenario') }}</td>
              <td>{{ $t('AI3StepsSection.scenario1') }}</td>
              <td>{{ $t('AI3StepsSection.scenario2') }}</td>
              <td>{{ $t('AI3StepsSection.scenario3') }}</td>
            </tr>
            <tr>
              <td class="border-left-n" style="font-weight: 600;">{{ $t('AI3StepsSection.change') }}</td>
              <td v-html="$t('AI3StepsSection.change1')"></td>
              <td v-html="$t('AI3StepsSection.change2')"></td>
              <td v-html="$t('AI3StepsSection.change3')"></td>
            </tr>
            <tr>
              <td class="border-left-n" style="font-weight: 600;">{{ $t('AI3StepsSection.behavior') }}</td>
              <td v-html="$t('AI3StepsSection.behavior1')"></td>
              <td v-html="$t('AI3StepsSection.behavior2')"></td>
              <td v-html="$t('AI3StepsSection.behavior3')"></td>
            </tr>
            <tr>
              <td class="border-left-n" style="font-weight: 600;">{{ $t('AI3StepsSection.technology') }}</td>
              <td v-html="$t('AI3StepsSection.technology1')"></td>
              <td v-html="$t('AI3StepsSection.technology2')"></td>
              <td v-html="$t('AI3StepsSection.technology3')"></td>
            </tr>
            <tr>
              <td class="border-left-n" style="font-weight: 600;">{{ $t('AI3StepsSection.platform') }}</td>
              <td>MS Copilot 365<br>Google Duet AI</td>
              <td>Google AgentSpace<br>IBM Orchestrate</td>
              <td><b>Process GPT</b>, Palantir AIP<br>SAP AI, Custom AI Orchestration</td>
            </tr>
          </table>
        </div>

        <!-- 테이블 하단 설명 -->
        <div class="text-center mb-8">
            <p style="font-size: 1.2rem; font-weight: 600; line-height: 1.6; margin-bottom: 10px;">{{ $t('AI3StepsSection.description1') }}</p>
            <p style="font-size: 1.2rem; font-weight: 600; line-height: 1.6;">{{ $t('AI3StepsSection.description2') }}</p>
        </div>

        <!-- 전환 텍스트 -->
        <!-- <div class="transition-text-container">
          <p class="transition-text">{{ $t('IntroductionSection.transitionText') }}</p>
        </div> -->

        <!-- 핵심 정의 박스 -->
        <!-- <div class="definition-box">
          <h3 class="definition-title">{{ $t('IntroductionSection.definitionTitle') }}</h3>
          <div class="definition-content">
            <p class="definition-line">{{ $t('IntroductionSection.definition1') }}</p>
            <p class="definition-line">{{ $t('IntroductionSection.definition2') }}</p>
            <p class="definition-line">{{ $t('IntroductionSection.definition3') }}</p>
            <p class="definition-line emphasis">{{ $t('IntroductionSection.definition5') }}</p>
          </div>
        </div> -->
      </div>
    </section>
  </template>
  
  <script>
  export default {
    name: 'IntroductionSection'
  }
  </script>
  
  <style scoped>
  .introduction-section {
    padding: 80px 0;
    background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);
  }
  
  .container {
    max-width: 100%;
    margin: 0 auto;
    padding: 0 40px;
  }
  
  /* 인트로 헤더 */
  .intro-header {
    text-align: center;
    margin-bottom: 60px;
  }
  
  .intro-title {
    font-size: 34px;
    font-weight: 700;
    color: #1a1a1a;
    line-height: 1.6;
    margin: 0;
  }
  
  .intro-title .highlight {
    color: #1976D2;
    display: inline-block;
    position: relative;
  }
  
  /* AI 3 Steps 테이블 */
  .ai3steps-table-container {
    margin: 50px auto;
    max-width: 1100px;
    padding: 0 20px;
  }
  
  .tbl-default {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 40px;
    font-size: 16px;
    line-height: 1.5;
  }
  
  .tbl-default tr {
    border-bottom: 1px solid #aaa;
  }
  
  .tbl-default tr:not(:first-child) {
    background-color: #ffffff;
  }
  
  .tbl-default td {
    border-left: 1px solid #aaa;
    padding: 12px 10px;
    vertical-align: top;
  }
  
  .tbl-title-md-gray {
    color: #fff;
    background-color: #6b757d;
    font-weight: 600;
    border: 2px solid #f8f9fa;
    border-radius: 7px;
    padding: 10px 5px;
    text-align: center;
  }
  
  .border-bottom-n {
    border-bottom: none !important;
  }
  
  .border-left-n {
    border-left: none !important;
  }
  
  /* 테이블 하단 설명 */
  .table-description {
    max-width: 1000px;
    margin: 30px auto 50px;
    padding: 0 20px;
    text-align: center;
  }
  
  .table-description .description-line {
    font-size: 18px;
    font-weight: 600;
    color: #333;
    line-height: 1.7;
    margin: 12px 0;
  }
  
  /* 전환 텍스트 */
  .transition-text-container {
    text-align: center;
    margin: 50px 0;
  }
  
  .transition-text {
    font-size: 22px;
    font-weight: 600;
    color: #333;
    margin: 0;
    padding: 20px;
  }
  
  /* 핵심 정의 박스 */
  .definition-box {
    margin-top: 60px;
    padding: 50px 40px;
    background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(25, 118, 210, 0.3);
    position: relative;
    overflow: hidden;
  }
  
  .definition-box::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    opacity: 0.6;
  }
  
  .definition-title {
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    margin: 0 0 30px 0;
    letter-spacing: 1px;
    text-transform: uppercase;
    position: relative;
  }
  
  .definition-content {
    position: relative;
    text-align: center;
  }
  
  .definition-line {
    font-size: 24px;
    font-weight: 600;
    color: #ffffff;
    line-height: 1.8;
    margin: 12px 0;
  }
  
  .definition-line.emphasis {
    font-size: 26px;
    font-weight: 700;
    margin-top: 20px;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  
  /* 반응형 디자인 */
  @media (max-width: 768px) {
    .introduction-section {
      padding: 60px 0;
    }
    
    .container {
      padding: 0 20px;
    }
    
    .intro-title {
      font-size: 26px;
    }
    
    .ai3steps-table-container {
      padding: 0 10px;
    }
    
    .tbl-default {
      font-size: 14px;
    }
    
    .tbl-default td {
      padding: 8px 5px;
    }
    
    .tbl-title-md-gray {
      font-size: 14px;
      padding: 8px 3px;
    }
    
    .definition-box {
      padding: 35px 25px;
    }
    
    .definition-line {
      font-size: 20px;
    }
    
    .definition-line.emphasis {
      font-size: 22px;
    }
  }
  
  @media (max-width: 576px) {
    .introduction-section {
      padding: 40px 0;
    }
    
    .container {
      padding: 0 15px;
    }
    
    .intro-title {
      font-size: 22px;
    }
    
    .ai3steps-table-container {
      overflow-x: auto;
      margin: 30px -10px;
      padding: 0 10px;
    }
    
    .tbl-default {
      font-size: 12px;
      min-width: 600px;
    }
    
    .tbl-default td {
      padding: 6px 4px;
    }
    
    .tbl-title-md-gray {
      font-size: 12px;
      padding: 6px 2px;
    }
    
    .definition-box {
      padding: 30px 20px;
    }
    
    .definition-title {
      font-size: 16px;
      margin-bottom: 20px;
    }
    
    .definition-line {
      font-size: 17px;
      line-height: 1.7;
    }
    
    .definition-line.emphasis {
      font-size: 18px;
      margin-top: 15px;
    }
  }
  </style>
  