<template>
  <section class="movie-gallery" id="movie-gallery">
    <div class="container mx-auto pb-12">
      <div class="section-header">
        <h2 style="color: #fff;">{{ $t('SpecialSection.movieGalleryTitle') }}</h2>
      </div>
      <div class="bg-white rounded-md shadow-md mb-8" style="max-width: 630px; margin: 0 auto; padding: 8px 8px 20px 8px;">
        <div style="position: relative; padding-bottom: 56.25%; padding-top: 0px; height: 0; overflow: hidden;">
          <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
            src="https://www.youtube.com/embed/kd6_hKSQDYc" 
            frameborder="0" crolling="no" allowfullscreen="">
          </iframe>
        </div>
        <h3 class="movie-gallery-h3 text-center font-bold mt-4">{{ $t('SpecialSection.processGptMainTitle') }}</h3>
      </div>

      <div class="movie-gallery-box-3 mb-8">
        <div class="movie-gallery-item bg-white rounded-md shadow-md">
          <div style="position: relative; padding-bottom: 56.25%; padding-top: 0px; height: 0; overflow: hidden;">
            <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
              src="https://www.youtube.com/embed/B5s2z35-yMg" 
              frameborder="0" crolling="no" allowfullscreen="">
            </iframe>
          </div>
          <h3 class="movie-gallery-h3 txt-vertical-center text-center font-bold mt-4">{{ $t('SpecialSection.autoKnowledgeManagementTitle') }}</h3>
        </div>
        <div class="movie-gallery-item bg-white p-6 rounded-md shadow-md">
          <div style="position: relative; padding-bottom: 56.25%; padding-top: 0px; height: 0; overflow: hidden;">
            <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
              src="https://www.youtube.com/embed/pNqZdzavOb4" 
              frameborder="0" crolling="no" allowfullscreen="">
            </iframe>
          </div>
          <h3 class="movie-gallery-h3 text-center font-bold mt-4">{{ $t('SpecialSection.autoTeamProcessTitle') }}</h3>
        </div>
        <div class="movie-gallery-item bg-white p-6 rounded-md shadow-md">
          <div style="position: relative; padding-bottom: 56.25%; padding-top: 0px; height: 0; overflow: hidden;">
            <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
              src="https://www.youtube.com/embed/IOhX6h9ox1Q" 
              frameborder="0" crolling="no" allowfullscreen="">
            </iframe>
          </div>
          <h3 class="movie-gallery-h3 txt-vertical-center text-center font-bold mt-4">{{ $t('SpecialSection.agentDraftTitle') }}</h3>
        </div>
      </div>

      <div class="movie-gallery-box-2">
        <div class="movie-gallery-item bg-white p-6 rounded-md shadow-md">
          <div style="position: relative; padding-bottom: 56.25%; padding-top: 0px; height: 0; overflow: hidden;">
            <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
              src="https://www.youtube.com/embed/dBNDa18JQZc" 
              frameborder="0" crolling="no" allowfullscreen="">
            </iframe>
          </div>
          <h3 class="movie-gallery-h3 text-center font-bold mt-4">{{ $t('SpecialSection.a2aAgentRegistrationTitle') }}</h3>
        </div>
        <div class="movie-gallery-item bg-white p-6 rounded-md shadow-md">
          <div style="position: relative; padding-bottom: 56.25%; padding-top: 0px; height: 0; overflow: hidden;">
            <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
              src="https://www.youtube.com/embed/qYEpj1B3FmE" 
              frameborder="0" crolling="no" allowfullscreen="">
            </iframe>
          </div>
          <h3 class="movie-gallery-h3 text-center font-bold mt-4">{{ $t('SpecialSection.a2aCallServiceTitle') }}</h3>
        </div>
      </div>
    </div>
  </section>

  <section class="special bg-blue-50" id="special"> 
    <div class="container mx-auto pb-12">
      <div class="section-header">
        <h2>{{ $t('SpecialSection.coreDistinctionTitle') }}</h2>
      </div>
      <p class="text-lg text-gray-700 text-center max-w-4xl mx-auto mb-12">{{ $t('SpecialSection.coreDistinctionDescription') }}</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div class="bg-white p-8 rounded-lg shadow-md">
          <div class="w-12 h-12 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4"
              style="background-color: #1976D2;"
          >1</div>
          <h3 class="text-xl font-bold mb-4">{{ $t('SpecialSection.feature1Title') }}</h3>
          <p class="text-gray-700">{{ $t('SpecialSection.feature1Description') }}</p>
        </div>
        <div class="bg-white p-8 rounded-lg shadow-md">
          <div class="w-12 h-12 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4"
              style="background-color: #1976D2;"
          >2</div>
          <h3 class="text-xl font-bold mb-4">{{ $t('SpecialSection.feature2Title') }}</h3>
          <p class="text-gray-700">{{ $t('SpecialSection.feature2Description') }}</p>
        </div>
        <div class="bg-white p-8 rounded-lg shadow-md">
          <div class="w-12 h-12 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4"
              style="background-color: #1976D2;"
          >3</div>
          <h3 class="text-xl font-bold mb-4">{{ $t('SpecialSection.feature3Title') }}</h3>
          <p class="text-gray-700">{{ $t('SpecialSection.feature3Description') }}</p>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="bg-white p-8 rounded-lg shadow-md">
          <div class="w-12 h-12 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4"
              style="background-color: #1976D2;"
          >4</div>
          <h3 class="text-xl font-bold mb-4">{{ $t('SpecialSection.feature4Title') }}</h3>
          <p class="text-gray-700">{{ $t('SpecialSection.feature4Description') }}</p>
        </div>
        <div class="bg-white p-8 rounded-lg shadow-md">
          <div class="w-12 h-12 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4"
              style="background-color: #1976D2;"
          >5</div>
          <h3 class="text-xl font-bold mb-4">{{ $t('SpecialSection.feature5Title') }}</h3>
          <p class="text-gray-700">{{ $t('SpecialSection.feature5Description') }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import TabComponent from '../ui/TabComponent.vue'

export default {
  name: 'SpecialSection',
  components: {
    TabComponent
  },
  data() {
    return {
      specialTabs: [
        {
          title: this.$t('SpecialSection.tabTitle1'),
          description: this.$t('SpecialSection.tabDescription1'),
          listItems: [
            this.$t('SpecialSection.tabItem1_1'),
            this.$t('SpecialSection.tabItem1_2'),
            this.$t('SpecialSection.tabItem1_3')
          ],
          image: 'bpmn-diagram.png'
        },
        {
          title: this.$t('SpecialSection.tabTitle2'),
          description: this.$t('SpecialSection.tabDescription2'),
          listItems: [
            this.$t('SpecialSection.tabItem2_1'),
            this.$t('SpecialSection.tabItem2_2'),
            this.$t('SpecialSection.tabItem2_3')
          ],
          image: 'bpmn-diagram.png'
        },
        {
          title: this.$t('SpecialSection.tabTitle3'),
          description: this.$t('SpecialSection.tabDescription3'),
          listItems: [
            this.$t('SpecialSection.tabItem3_1'),
            this.$t('SpecialSection.tabItem3_2'),
            this.$t('SpecialSection.tabItem3_3')
          ],
          image: 'bpmn-diagram.png'
        }
      ]
    }
  }
}
</script>

<style scoped>
.movie-gallery {
  padding: 80px 0;
  background-color: #1976D2;
  /* background-color: var(--bg-color-light); */
}

.special {
  padding: 80px 0;
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

.movie-gallery-box-3 {
  display: flex; 
  justify-content: space-between;
}
.movie-gallery-box-2 {
  display: flex; 
  justify-content: center;
}
.movie-gallery-item {
  width: 32%;
  padding: 8px 8px 20px 8px;
}
.movie-gallery-box-2 > .movie-gallery-item:first-child {
  margin-right: 2%;
}
.movie-gallery-h3 {
    font-size: 1.25rem;
    line-height: 1.75rem;
}
.movie-gallery-h3.txt-vertical-center {
  line-height: 3.3rem;
}

@media (max-width: 1279px) {
  .movie-gallery-h3 {
    font-size: 1rem;
    line-height: 1.5rem;
  }
}

@media (max-width: 768px) {
  .special {
    padding: 60px 0;
  }
  .section-header h2 {
    font-size: 1.8rem;
  }
   
  .movie-gallery-box-3, .movie-gallery-box-2 {
    display: block;
  }
  .movie-gallery-item {
    width: 100%;
  }
  .movie-gallery-box-3 > .movie-gallery-item:first-child, .movie-gallery-box-3 > .movie-gallery-item:nth-child(2) {
    margin-bottom: 32px;
  }
  .movie-gallery-box-2 > .movie-gallery-item:first-child {
    margin: 0 0 32px 0;
  }
  .movie-gallery-h3.txt-vertical-center {
    line-height: 1.5rem;
  }
}
</style>
