<template>
  <section id="ai3Steps" class="ai3Steps">
    <div class="container mx-auto px-4">
      <h2 class="text-3xl font-bold text-center mb-12">{{ $t('AI3StepsSection.title') }}</h2>
        
      <div style="max-width: 1000px; margin: 0 auto;">
        <table class="tbl-default">
          <tr class="border-bottom-n">
            <th class="tbl-title-md-gray" style="width: 15%;">{{ $t('AI3StepsSection.category') }}</th>
            <th class="tbl-title-md-gray" style="width: 22%;">{{ $t('AI3StepsSection.step1') }}
            </th>
            <th class="tbl-title-md-gray" style="width: 23%;">{{ $t('AI3StepsSection.step2') }}
            </th>
            <th class="tbl-title-md-gray" style="width: 30%;">{{ $t('AI3StepsSection.step3') }}
            </th>
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
            <td>Palantir AIP<br>SAP AI, Custom AI Orchestration</td>
          </tr>
        </table>
      </div>

      <div class="text-center mb-8">
        <p style="font-size: 1.2rem; font-weight: 600; line-height: 1.6; margin-bottom: 10px;">{{ $t('AI3StepsSection.description1') }}</p>
        <p style="font-size: 1.2rem; font-weight: 600; line-height: 1.6;">{{ $t('AI3StepsSection.description2') }}</p>
      </div>
  </div>
  </section>
</template>

<script>
export default {
  name: 'AI3StepsSection'
}
</script>

<style scoped>
.ai3Steps {
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
.tbl-default tr:not(:first-child) {
    background-color: #ffffff;
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
