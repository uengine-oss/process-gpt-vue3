<template>
  <section id="works" class="works">
    <div class="container">
      <div class="section-header">
        <h2>How Process GPT Works?</h2>
        <p>{{ $t('HowSection.subtitle') }}</p>
      </div>
      
      <div class="">

        <!-- 1 에이전트 지식의 자동관리 -->
        <div class="bg-white pa-12 rounded-lg shadow-md mb-16" style="border: 1px solid #efefef;">
          <h3>{{ $t('HowSection.subtitle1') }}</h3>

          <div class="tab-flex">

            <div class="tab-image">
              <img src="@/assets/images/mainPages/how-01-1.png" alt="" />
              <div class="tab-text">
                <ul class="mt-4">
                  <li>
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                          <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      {{ $t('HowSection.description1') }}
                  </li>
                </ul>
              </div>
            </div>
            
            <div class="tab-image">
              <img src="@/assets/images/mainPages/how-01-2.png" alt="" />
              <div class="tab-text">
                <ul class="mt-4">
                  <li>
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                          <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      {{ $t('HowSection.description2') }}
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </div>

        <!-- 2 팀 프로세스 정의 -->
        <div class="bg-white pa-12 rounded-lg shadow-md mb-16" style="border: 1px solid #efefef;">
          <h3>{{ $t('HowSection.subtitle2') }}</h3>

          <div class="tab-flex">
            <div class="tab-image">
              <img src="@/assets/images/mainPages/how-02.gif" alt="" />
            </div>
            <div class="tab-text mt-n20">
              <ul>
                <li>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    {{ $t('HowSection.list1') }}
                </li>
                <li>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    {{ $t('HowSection.list2') }}
                </li>
                <li>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    {{ $t('HowSection.list3') }}
                </li>
                <li>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    {{ $t('HowSection.list4') }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 3 에이전트 초안 생성 -->
        <div class="bg-white pa-12 rounded-lg shadow-md mb-16" style="border: 1px solid #efefef;">
          <h3>{{ $t('HowSection.subtitle3') }}</h3>

          <div class="tab-flex">
            <div class="tab-image mt-n20">
              <img src="@/assets/images/mainPages/how-03.png" alt="" />
            </div>
            <div class="tab-text">
              <p class="flex flex-start mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {{ $t('HowSection.listTitle1') }}
              </p>
              <ul class="mb-6">
                <li class="pl-8">⦁ {{ $t('HowSection.listDesc1') }}</li>
                <li class="pl-8">⦁ {{ $t('HowSection.listDesc2') }}</li>
                <li class="pl-8">⦁ {{ $t('HowSection.listDesc3') }}</li>
              </ul>

              <p class="flex flex-start mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {{ $t('HowSection.listTitle2') }}
              </p>
              <ul class="mb-6">
                <li class="pl-8">⦁ {{ $t('HowSection.listDesc4') }}</li>
                <li class="pl-8">⦁ {{ $t('HowSection.listDesc5') }}</li>
              </ul>

              <p class="flex flex-start mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {{ $t('HowSection.listTitle3') }}
              </p>
              <ul>
                <li class="pl-8">⦁ {{ $t('HowSection.listDesc6') }}</li>
                <li class="pl-8">⦁ {{ $t('HowSection.listDesc7') }}</li>
                <li class="pl-8">⦁ {{ $t('HowSection.listDesc8') }}</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 4 멀티모달 -->
        <div class="bg-white pa-12 rounded-lg shadow-md mb-16" style="border: 1px solid #efefef;">
          <h3>{{ $t('HowSection.subtitle4') }}</h3>

          <div class="flex justify-center">
            <div class="modal-image">
              <img src="@/assets/images/mainPages/how-04.png" alt="" />
            </div>
            <!-- <div class="tab-text">
              <ul>
                <li>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    {{ $t('HowSection.list5') }}
                </li>
                <li>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    {{ $t('HowSection.list6') }}
                </li>
              </ul>
            </div> -->
          </div>
        </div>

        <!-- 5 A2A 호출 & 서비스 노출 -->
        <div class="bg-white pa-12 rounded-lg shadow-md mb-6" style="border: 1px solid #efefef;">
          <h3>{{ $t('HowSection.subtitle5') }}</h3>

          <div class="tab-flex">
            <div class="tab-image">
              <img src="@/assets/images/mainPages/how-05.png" alt="" />
            </div>
            <div class="tab-text mt-n20">
              <ul>
                <li>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    {{ $t('HowSection.list5') }}
                </li>
                <li>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <path stroke="#1976D2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    {{ $t('HowSection.list6') }}
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>
</template>

<script>

export default {
  name: 'HowSection'
}
</script>

<style scoped>
.works {
  padding: 80px 0;
  background-color: var(--bg-color);
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


h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-color-dark);
  padding-bottom: 40px;
  /* margin-bottom: 15px; */
  text-align: center;
}

.tab-flex {
  display: flex;
  align-items: center;
  gap: 40px;
  flex-wrap: wrap;
}

.tab-text {
  flex: 1;
  min-width: 300px;
}

.tab-text p {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--text-color);
  margin-bottom: 20px;
}

.tab-text ul {
  /* padding-left: 20px; */
}

.tab-text ul li {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10px;
  color: var(--text-color);
}

.tab-image {
  flex: 1;
  min-width: 300px;
}

.tab-image img, .modal-image img {
  width: 100%;
  height: auto;
  /* border-radius: 8px; */
  /* box-shadow: 0 5px 15px var(--shadow-color); */
  transition: transform 0.3s ease;
}

.modal-image {
  max-width: 800px;
  min-width: 300px;
  /* margin: 0 auto; */
}


@media (max-width: 768px) {
  .works {
    padding: 60px 0;
  }
  
  .section-header h2 {
    font-size: 1.8rem;
  }

  .mt-n20 {
    margin-top: -20px;
  }
}
</style>
