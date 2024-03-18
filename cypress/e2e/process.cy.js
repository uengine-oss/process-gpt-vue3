const email = Cypress.env('EMAIL');
const password = Cypress.env('PASSWORD');

Cypress.on('uncaught:exception', (err, runnable) => {
  return false;
});

describe('process-gpt', () => {
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

    // 프로세스 실행
    cy.get('.cp-menu').eq(4).click();
    cy.wait(3000);
    cy.get('.cp-chat').type('휴가신청 프로세스를 실행해줘.');

    // // 채팅
    // cy.get('.cp-menu').eq(3).click();
    // cy.wait(3000);

    // // 할 일 목록
    // cy.get('.cp-menu').eq(1).click();
    // cy.wait(3000);

    // // 달력
    // cy.get('.cp-menu').eq(2).click();
    // cy.wait(3000);
  })
})