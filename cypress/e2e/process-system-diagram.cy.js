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

    cy.get('.cp-start').click({force: true});

    // Login
    cy.get('#input-27').clear().type(email);
    cy.wait(1000);
    cy.get('#input-29').clear().type(password);
    cy.get('.cp-login').click();
    cy.wait(1000);

    // Process Menu Open
    cy.get('.cp-menu-open').click();
    cy.wait(500);

    // 프로세스 정의 체계도
    cy.get('.cp-menu').eq(6).click();
    cy.wait(10000);
   
    // check-out 
    cy.get('.cp-unlock').click();
    cy.wait(1000);
    cy.get('.cp-check-out').click();
    cy.wait(1000);
   
    // Mega process
    cy.get('.cp-add-mega').click();
    cy.wait(1000);
    cy.get('.cp-process-id').type("MEGA-1");
    cy.get('.cp-process-name').type("고객");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);

    // Major process
    cy.get('.add-major-process').click();
    cy.get('.cp-process').click();
    cy.get('.cp-process-id').type("MAJOR-1.1");
    cy.get('.cp-process-name').type("고객정보 기획");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);

    cy.get('.add-major-process').click();
    cy.get('.cp-process').click();
    cy.get('.cp-process-id input').clear().type("MAJOR-1.2");
    cy.get('.cp-process-name input').clear().type("고객정보 관리");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);

    cy.get('.add-major-process').click();
    cy.get('.cp-process').click();
    cy.get('.cp-process-id input').clear().type("MAJOR-1.3");
    cy.get('.cp-process-name input').clear().type("고객 상담관리");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);

    cy.get('.add-major-process').click();
    cy.get('.cp-process').click();
    cy.get('.cp-process-id input').clear().type("MAJOR-1.4");
    cy.get('.cp-process-name input').clear().type("통합안내 관리");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);
    
    // Sub process
    cy.get('.add-sub-process').eq(0).click();
    cy.get('.cp-process').click();
    cy.get('.cp-custom-sub').click();
    cy.get('.cp-process-id').type("SUB-1.1.1");
    cy.get('.cp-process-name').type("고객정보 관리기준 수립");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);

    cy.get('.add-sub-process').eq(1).click();
    cy.get('.cp-process').click();
    cy.get('.cp-custom-sub').click();
    cy.get('.cp-process-id').type("SUB-1.2.1");
    cy.get('.cp-process-name').type("고객정보 관리");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);

    cy.get('.add-sub-process').eq(1).click();
    cy.get('.cp-process').click();
    cy.get('.cp-custom-sub').click();
    cy.get('.cp-process-id input').clear().type("SUB-1.2.2");
    cy.get('.cp-process-name input').clear().type("외부 고객정보 관리");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);

    cy.get('.add-sub-process').eq(1).click();
    cy.get('.cp-process').click();
    cy.get('.cp-custom-sub').click();
    cy.get('.cp-process-id input').clear().type("SUB-1.2.3");
    cy.get('.cp-process-name input').clear().type("멤버쉽 관리");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);
    

    cy.get('.add-sub-process').eq(2).click();
    cy.get('.cp-process').click();
    cy.get('.cp-custom-sub').click();
    cy.get('.cp-process-id').type("SUB-1.3.1");
    cy.get('.cp-process-name').type("챗봇 상담");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);
    
    cy.get('.add-sub-process').eq(2).click();
    cy.get('.cp-process').click();
    cy.get('.cp-custom-sub').click();
    cy.get('.cp-process-id input').clear().type("SUB-1.3.2");
    cy.get('.cp-process-name input').clear().type("고객센터 관리");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);

    cy.get('.add-sub-process').eq(3).click();
    cy.get('.cp-process').click();
    cy.get('.cp-custom-sub').click();
    cy.get('.cp-process-id').type("SUB-1.4.1");
    cy.get('.cp-process-name').type("발송(반송) 관리");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);

    cy.get('.add-sub-process').eq(3).click();
    cy.get('.cp-process').click();
    cy.get('.cp-custom-sub').click();
    cy.get('.cp-process-id input').clear().type("SUB-1.4.2");
    cy.get('.cp-process-name input').clear().type("제증명서 관리");
    cy.wait(1000);
    cy.get('.cp-process-save').click();
    cy.wait(1000);

    cy.get('.add-major-process').click();
    cy.get('.cp-mega-datail').eq(0).click();

    // check-in
    cy.get('.cp-lock').click();
    cy.wait(1000);
    cy.get('.cp-check-in').click();


  })
})