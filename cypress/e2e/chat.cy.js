const email = Cypress.env('EMAIL');
const password = Cypress.env('PASSWORD');

Cypress.on('uncaught:exception', (err, runnable) => {
  return false;
});

describe('채팅', () => {
  beforeEach(() => {
    cy.visit('http://127.0.0.1:5173/', {
      onBeforeLoad: (window) => {
        window.localStorage.setItem('execution', true);
      }
    });
  });
  
  it('passes', () => {

    cy.get('.cp-start').click();

    // Login
    cy.get('#input-27').clear().type(email);
    cy.wait(1000);
    cy.get('#input-29').clear().type(password);
    cy.get('.cp-login').click();
    cy.wait(1000);

    // Process Menu Open
    cy.get('.cp-menu-open').click();
    cy.wait(500);

    // 채팅
    cy.get('.cp-menu').eq(3).click();
    cy.wait(5000);
    cy.get('.cp-chat').type('휴가 일정을 등록하려고해 4월 10일에 시작해서 4월 13일에 휴가 복귀로 해서 일정 등록해줘.');
    cy.wait(1500);
    cy.get('.cp-send').click();
  })
})