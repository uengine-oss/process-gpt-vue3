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

    // 프로세스 정의 체계도
    cy.get('.cp-menu').eq(6).click();
    cy.wait(3000);
    cy.get('.cp-unlock').click();
    cy.wait(1000);
    cy.get('.cp-unlock-check').click();
    cy.wait(1000);
    cy.get('.cp-add-process').click();
    cy.wait(1000);
    cy.get('.cp-process').click();
    cy.wait(1000);
    cy.get('.cp-process-id').type("MEGA-1");
    cy.get('.cp-process-name').type("고객");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);

    cy.get('.add-major-process').click();
    cy.get('.cp-process').click();
    cy.get('.cp-process-id').type("MAJOR-1");
    cy.get('.cp-process-name').type("고객정보 기획");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);
    
    // cy.get('.add-sub-process').click();
    // cy.get('.cp-process').click();
    // cy.get('.cp-process-id').type("SUB-1");
    // cy.get('.cp-process-name').type("고객정보 관리기준 수립");
    // cy.wait(1000);
    // cy.get('.cp-process-save').click();
    // cy.wait(1000);

    cy.get('.cp-lock').click();
    cy.wait(1000);
    cy.get('.cp-lock-check').click();


  })
})