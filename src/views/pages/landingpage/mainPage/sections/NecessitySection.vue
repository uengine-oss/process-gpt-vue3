<template>
    <section class="necessity-section">
      <div class="container">
        <!-- 섹션 타이틀 -->
        <div class="section-header">
          <h2 class="section-title">
            {{ $t('NecessitySection.title') }}<br>
          </h2>
        </div>

        <!-- 인트로 및 AI 기능 설명 -->
        <div class="content-block">
          <div class="ai-features-grid">
            <div class="feature-card">
              <v-icon class="feature-icon" size="48" color="#1976D2">mdi-file-document-edit-outline</v-icon>
              <p class="feature-title">{{ $t('NecessitySection.feature1') }}</p>
            </div>
            <div class="feature-card">
              <v-icon class="feature-icon" size="48" color="#1976D2">mdi-translate</v-icon>
              <p class="feature-title">{{ $t('NecessitySection.feature2') }}</p>
            </div>
            <div class="feature-card">
              <v-icon class="feature-icon" size="48" color="#1976D2">mdi-text-box-outline</v-icon>
              <p class="feature-title">{{ $t('NecessitySection.feature3') }}</p>
            </div>
            <div class="feature-card">
              <v-icon class="feature-icon" size="48" color="#1976D2">mdi-magnify</v-icon>
              <p class="feature-title">{{ $t('NecessitySection.feature4') }}</p>
            </div>
          </div>
        </div>

        <!-- 문제 정의 (강조) -->
        <div class="text-center mb-8">
          <p style="font-size: 1.2rem; font-weight: 600; line-height: 1.6; margin-bottom: 10px;">
            {{ $t('NecessitySection.problemTitle') }}
          </p>
        </div>

        <!-- Agentic Process AI 솔루션 -->
        <div class="solution-section">
          <div class="solution-header">
            <h3 class="solution-title">{{ $t('NecessitySection.solutionTitle') }}</h3>
            <p class="solution-description">{{ $t('NecessitySection.solutionDescription') }}</p>
          </div>

          <div class="benefits-grid">
            <div class="benefit-item">
              <v-icon color="#1976D2" size="32">mdi-check-circle</v-icon>
              <p>{{ $t('NecessitySection.benefit1') }}</p>
            </div>
            <div class="benefit-item">
              <v-icon color="#1976D2" size="32">mdi-check-circle</v-icon>
              <p>{{ $t('NecessitySection.benefit2') }}</p>
            </div>
            <div class="benefit-item">
              <v-icon color="#1976D2" size="32">mdi-check-circle</v-icon>
              <p>{{ $t('NecessitySection.benefit3') }}</p>
            </div>
            <div class="benefit-item">
              <v-icon color="#1976D2" size="32">mdi-check-circle</v-icon>
              <p>{{ $t('NecessitySection.benefit4') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </template>
  
  <script>
  export default {
    name: 'NecessitySection'
  }
  </script>
  
  <style scoped>
  .necessity-section {
    padding: 80px 0;
    background-color: #ffffff;
  }
  
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 20px;
  }
  
  /* 섹션 헤더 */
  .section-header {
    text-align: center;
    margin-bottom: 50px;
  }
  
  .section-title {
    font-size: 32px;
    font-weight: 700;
    color: #1a1a1a;
    line-height: 1.5;
    margin: 0;
  }
  
  /* 콘텐츠 블록 */
  .content-block {
    margin-bottom: 40px;
  }
  
  .intro-text {
    font-size: 18px;
    color: #333;
    line-height: 1.8;
    margin-bottom: 30px;
    text-align: center;
  }
  
  /* AI 기능 카드 그리드 */
  .ai-features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    margin: 40px 0;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
  }
  
  .feature-card {
    background: #ffffff;
    border: 2px solid #e8f0fe;
    border-radius: 16px;
    padding: 32px 24px;
    text-align: center;
    transition: all 0.3s ease;
    cursor: default;
  }
  
  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(25, 118, 210, 0.15);
    border-color: #1976D2;
  }
  
  .feature-icon {
    margin-bottom: 16px;
  }
  
  .feature-title {
    font-size: 17px;
    font-weight: 600;
    color: #333;
    margin: 0;
    line-height: 1.4;
  }
  
  .limitation-text {
    font-size: 17px;
    color: #555;
    line-height: 1.8;
    text-align: center;
    margin-top: 40px;
  }
  
  /* Agentic Process AI 솔루션 */
  .solution-section {
    margin-top: 60px;
    padding: 50px 40px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e8f0fe 100%);
    border-radius: 16px;
    border: 2px solid #1976D2;
  }

  .solution-header {
    text-align: center;
    margin-bottom: 40px;
  }

  .solution-intro {
    font-size: 18px;
    font-weight: 600;
    color: #1976D2;
    margin-bottom: 12px;
  }

  .solution-title {
    font-size: 26px;
    font-weight: 700;
    color: #1976D2;
    line-height: 1.5;
    margin-bottom: 20px;
  }

  .solution-description {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
    line-height: 1.6;
  }

  .benefits-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    max-width: 700px;
    margin: 0 auto;
  }

  .benefit-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
  }

  .benefit-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15);
  }

  .benefit-item p {
    font-size: 16px;
    font-weight: 600;
    color: #333;
    margin: 0;
    line-height: 1.4;
  }
  
  /* 비교 이미지 */
  .comparison-image {
    margin: 50px 0;
    text-align: center;
  }
  
  .image-label {
    font-size: 16px;
    font-weight: 600;
    color: #1976D2;
    margin-bottom: 20px;
    text-align: center;
  }
  
  .necessity-img {
    width: 100%;
    max-width: 800px;
    height: auto;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }
  
  
  /* 프로세스 설명 */
  .process-description {
    font-size: 17px;
    color: #333;
    line-height: 1.8;
    text-align: center;
    margin-bottom: 30px;
  }
  
  /* 챌린지 목록 */
  .challenges {
    margin: 30px 0;
    padding: 0 40px;
  }
  
  .challenge-item {
    font-size: 17px;
    color: #555;
    line-height: 2;
    margin: 12px 0;
  }
  
  .human-burden {
    font-size: 18px;
    color: #333;
    font-weight: 600;
    line-height: 1.8;
    text-align: center;
    margin-top: 30px;
  }
  
  /* 전환 문장 */
  .transition-statement {
    margin-top: 60px;
    text-align: center;
    padding: 40px;
    background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
    border-radius: 12px;
  }
  
  .transition-text {
    font-size: 24px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }
  
  /* 반응형 디자인 */
  @media (max-width: 768px) {
    .necessity-section {
      padding: 60px 0;
    }
    
    .section-title {
      font-size: 26px;
    }
    
    .intro-text,
    .limitation-text,
    .process-description {
      font-size: 16px;
    }
    
    .ai-features-grid {
      gap: 16px;
    }
    
    .feature-card {
      padding: 24px 16px;
    }
    
    .feature-icon {
      font-size: 40px !important;
    }
    
    .feature-title {
      font-size: 15px;
    }
    
    .challenge-item {
      font-size: 15px;
    }
    
    .transition-text {
      font-size: 20px;
    }
    
    .challenges {
      padding: 0 20px;
    }
    
    .comparison-image {
      margin: 40px 0;
    }

    .solution-section {
      padding: 35px 25px;
    }

    .solution-title {
      font-size: 22px;
    }

    .solution-description {
      font-size: 18px;
    }

    .benefits-grid {
      gap: 12px;
    }

    .benefit-item p {
      font-size: 14px;
    }
  }
  
  @media (max-width: 576px) {
    .necessity-section {
      padding: 40px 0;
    }
    
    .section-title {
      font-size: 22px;
    }
    
    .ai-features-grid {
      grid-template-columns: 1fr;
      gap: 12px;
      max-width: 400px;
    }
    
    .feature-card {
      padding: 20px 16px;
    }
    
    .feature-icon {
      font-size: 36px !important;
    }
    
    .feature-title {
      font-size: 14px;
    }
    
    .transition-statement {
      padding: 20px;
    }
    
    .challenges {
      padding: 0 10px;
    }

    .solution-section {
      padding: 30px 20px;
      margin-top: 40px;
    }

    .solution-intro {
      font-size: 16px;
    }

    .solution-title {
      font-size: 20px;
    }

    .solution-description {
      font-size: 17px;
    }

    .benefits-grid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .benefit-item {
      padding: 12px;
    }

    .benefit-item p {
      font-size: 14px;
    }
  }
  </style>
  