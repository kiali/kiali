import { Given, When, And, Then } from "cypress-cucumber-preprocessor/steps";


And('user clicks on Help Button', () => {
    cy.get('.pf-c-dropdown > #pf-toggle-id-0').click()
})

And('user clicks on About Button', () => {
    cy.get('li[role="menuitem"]').contains("About").click();
    
})

Then(`user see Kiali brand`, () => {
    cy.contains('Kiali').should('be.visible')
    cy.contains('Kiali Container').should('be.visible')
    cy.contains('Istio').should('be.visible')
    cy.contains('Prometheus').should('be.visible')
    cy.contains('Kubernetes').should('be.visible')
    cy.contains('Grafana URL').should('be.visible')
    cy.contains('Jaeger URL').should('be.visible')
    cy.get('[href="https://www.kiali.io"]').should('have.attr', 'href')
    cy.get('[href="https://github.com/kiali"]').should('have.attr', 'href')
    
})
