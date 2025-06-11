<template>
  <section class="section bg-gray-50" id="tech">
    <div class="container mx-auto pt-4 pb-12">
      <div class="section-header">
        <h2>활용 기술</h2>
      </div>
      <!-- <h2 class="text-3xl font-bold text-center mb-16">활용 기술</h2> -->
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div class="bg-white p-8 rounded-lg shadow-md">
          <h3 class="text-xl font-bold mb-4">LLM Framework</h3>
          <p class="text-gray-700">
            LangChain, LangObject (github.com/uengine-oss/langobject)
          </p>
        </div>

        <div class="bg-white p-8 rounded-lg shadow-md">
          <h3 class="text-xl font-bold mb-4">Model</h3>
          <p class="text-gray-700">
            Chat-GPT4 (프로세스 실행용), Chat-GPT3.5 (정의 생성 및 에이전트 실행용)
          </p>
        </div>

        <div class="bg-white p-8 rounded-lg shadow-md">
          <h3 class="text-xl font-bold mb-4">Multi-agent</h3>
          <p class="text-gray-700">
            Crew AI + LangGraph
          </p>
        </div>

        <div class="bg-white p-8 rounded-lg shadow-md">
          <h3 class="text-xl font-bold mb-4">Database</h3>
          <p class="text-gray-700">
            Supabase (Postgres) + Neo4J Graph DB
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
export default {
  name: 'CTASection'
}
</script>

<style scoped>
.section {
  background-color: var(--light-color);
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

@media (max-width: 768px) {

}
</style>
