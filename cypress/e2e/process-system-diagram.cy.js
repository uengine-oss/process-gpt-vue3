const { eq } = require("lodash");

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
    // cy.wait(60000);


  })
})