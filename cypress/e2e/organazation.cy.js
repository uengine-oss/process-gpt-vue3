const email = Cypress.env('EMAIL');
const password = Cypress.env('PASSWORD');

Cypress.on('uncaught:exception', (err, runnable) => {
  return false;
});

describe('조직도 정의', () => {
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

    // 조직도 정의
    cy.get('.cp-menu').eq(5).click();
    cy.wait(3000);
    cy.get('.cp-dialog-open').click();
    cy.wait(3000);
    cy.get('.cp-chat').type('개발팀과 인사팀에 대한 조직도를 각 팀의 팀장 포함 임의의 정보로 생성해줘.');
    cy.wait(1500);
    cy.get('.cp-send').click();
  })
})