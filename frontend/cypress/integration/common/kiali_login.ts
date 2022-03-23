import { Given, When, And, Then } from "cypress-cucumber-preprocessor/steps";

const USERNAME = Cypress.env('USERNAME') || 'jenkins';
const PASSWD = Cypress.env('PASSWD')
const KUBEADMIN_IDP = 'my_htpasswd_provider';
const auth_strategy = Cypress.env('auth_strategy')

Given('user opens base url', () => {
    cy.visit('/');
    cy.log(auth_strategy)
    cy.window().then((win: any) => {
        if (auth_strategy != 'openshift') {
            cy.log('Skipping login, Kiali is running with auth disabled');
        }
        // Make sure we clear the cookie in case a previous test failed to logout.
        cy.clearCookie('openshift-session-token');
    });
});

And('user clicks Log In With OpenShift', () => {
    if (auth_strategy === 'openshift') {
        const idp = KUBEADMIN_IDP;
        cy.log(`Logging in as ${USERNAME}`);
        cy.get('button[type="submit"]').should('be.visible');
        cy.get('button[type="submit"]').click();
    }
});

And('user clicks my_htpasswd_provider', () => {
    if (auth_strategy === 'openshift') {
        cy.get('body').then(($body) => {
            if ($body.text().includes(KUBEADMIN_IDP)) {
                cy.contains(KUBEADMIN_IDP)
                    .should('be.visible')
                    .click();
            }
        });
    }
})

And('user fill in username and password', () => {
    if (auth_strategy === 'openshift') {
        cy.get('#inputUsername').type('' || USERNAME);
        cy.get('#inputPassword').type('' || PASSWD);
        cy.get('button[type="submit"]').click()
    }
})

Then('user see console in URL', () => {
    cy.url().should('include', 'console')
})

