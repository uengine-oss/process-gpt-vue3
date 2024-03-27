const email = Cypress.env('EMAIL');
const password = Cypress.env('PASSWORD');

Cypress.on('uncaught:exception', (err, runnable) => {
  return false;
});

describe('프로세스 정의', () => {
  beforeEach(() => {
    cy.visit('http://127.0.0.1:5173/', {
      onBeforeLoad: (window) => {
        window.localStorage.setItem('execution', true);
      }
    });
  });

  it('passes', () => {
    cy.visit('http://127.0.0.1:5173/');

    cy.get('.cp-start').click();

    // Login
    cy.get('#input-161').clear().type(email);
    cy.wait(1000);
    cy.get('#input-163').clear().type(password);
    cy.get('.cp-login').click();
    cy.wait(1000);

    // Process Menu Open
    cy.get('.cp-menu-open').click();
    cy.wait(500);

    // 프로세스 정의
    cy.get('.cp-menu').eq(8).click();
    cy.wait(3000);
    cy.get('.cp-dialog-open').click();
    cy.wait(5000);
    cy.get('.cp-chat textarea').eq(0).type('입사자 관리 프로세스를 만들거야. 인사팀에서 입사자의 인적사항 대한 내용을 등록 후, 입사자의 인적사항에 기재된 부서에 해당하는 팀장에게 입사자에 대한 인적사항을 전달해줘. 이후 해당 부서의 팀장은 입사자에게 업무 기본 숙지사항에 대한 파일을 전달해주는 프로세스를 생성해줘.', {force: true});
    cy.wait(1500);
    cy.get('.cp-send').click();
    cy.wait(60000);

    // 프로세스 정의 체계
    // cy.get('.cp-menu').eq(0).click();

  })
})