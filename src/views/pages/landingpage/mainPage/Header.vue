<template>
  <header class="header-main">
    <div class="container">
      <div class="logo">
        <img src="@/assets/images/logos/logo-dark.svg" alt="Process GPT 로고" @click="goHome" style="cursor: pointer;" />
        <!-- <h1>Process GPT</h1> -->
      </div>
      <nav class="nav">
        <ul>
          <li><a class="nav-link" href="#intro" @click="$router.push('/')">소개</a></li>
          <li><a class="nav-link" href="#consulting" @click="$router.push('/')">프로세스 컨설팅</a></li>
          <li><a class="nav-link" href="#features" @click="$router.push('/')">주요 기능</a></li>
          <li><a class="nav-link" href="#special" @click="$router.push('/')">핵심 특징</a></li>
          <li><a class="nav-link" href="#tech" @click="$router.push('/')">활용 기술</a></li>
          <!-- <li><router-link class="nav-link" to="/marketplace" @click="scrollToTop">Marketplace</router-link></li> -->
        </ul>
      </nav>
      <div class="mobile-menu-btn" @click="toggleMobileMenu">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </div>
      <div class="mobile-menu" v-if="mobileMenuOpen">
        <ul>
          <li><a href="#intro" @click="closeMobileMenuAndNavigate('/')">소개</a></li>
          <li><a href="#consulting" @click="closeMobileMenuAndNavigate('/')">프로세스 컨설팅</a></li>
          <li><a href="#features" @click="closeMobileMenuAndNavigate('/')">주요 기능</a></li>
          <li><a href="#special" @click="closeMobileMenuAndNavigate('/')">특별 기능</a></li>
          <li><a @click="closeMobileMenuAndNavigate('/marketplace')">Marketplace</a></li>
        </ul>
      </div>
    </div>
  </header>
</template>

<script>
export default {
  name: 'Header',
  data() {
    return {
      mobileMenuOpen: false,
      scrolled: false
    }
  },
  mounted() {
    window.addEventListener('scroll', this.handleScroll);
  },
  beforeDestroy() {
    window.removeEventListener('scroll', this.handleScroll);
  },
  methods: {
    goHome() {
      this.$router.push('/');
      this.$nextTick(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    },
    scrollToTop() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    },
    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
    },
    closeMobileMenu() {
      this.mobileMenuOpen = false;
    },
    closeMobileMenuAndNavigate(path) {
      this.mobileMenuOpen = false;
      this.$router.push(path);
      this.$nextTick(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    },
    handleScroll() {
      this.scrolled = window.scrollY > 50;
    },
    scrollToSection(sectionId) {
      this.$nextTick(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          const sectionTitle = element.querySelector('.section-title');
          if (sectionTitle) {
            const headerHeight = document.querySelector('.header').offsetHeight;
            const elementPosition = sectionTitle.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        }
      });
    }
  }
}
</script>

<style scoped>
.header-main {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background-color: white;
  z-index: 1000;
  transition: all 0.3s ease;
  padding: 15px 0;
}

.header-main.scrolled {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 10px 0;
}

.container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1480px;
  margin: 0 auto;
  padding: 0 20px;
}

.logo {
  display: flex;
  align-items: center;
}

.logo img {
  width: auto;
  height: 40px;
  margin-right: 10px;
}

.logo h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
  margin: 0;
}

.nav ul {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav ul li {
  margin-left: 30px;
}

.nav-link {
  color: var(--text-color);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
  cursor: pointer;
}

.nav-link:hover {
  color: var(--primary-color);
}

.mobile-menu-btn {
  display: none;
  cursor: pointer;
  font-size: 1.5rem;
  color: var(--text-color);
}

.mobile-menu {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background-color: var(--bg-color);
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  z-index: 999;
}

.mobile-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mobile-menu ul li {
  margin-bottom: 15px;
}

.mobile-menu ul li a {
  color: var(--text-color);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
  cursor: pointer;
  display: block;
  padding: 8px 0;
}

.mobile-menu ul li a:hover {
  color: var(--primary-color);
}

@media (max-width: 768px) {
  .mobile-menu-btn {
    display: block;
  }
  .nav {
    display: none;
  }
  .mobile-menu {
    display: block;
  }
}
</style>
