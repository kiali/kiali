import { Given, And, Then } from "@badeball/cypress-cucumber-preprocessor";

const USERNAME = Cypress.env('USERNAME') || 'jenkins'; // CYPRESS_USERNAME to the user
const PASSWD = Cypress.env('PASSWD'); // CYPRESS_PASSWD to the user
const KUBEADMIN_IDP = Cypress.env('AUTH_PROVIDER') // CYPRESS_AUTH_PROVIDER to the user
const auth_strategy = Cypress.env('AUTH_STRATEGY');

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

And('user clicks my_htpasswd_provider', () => {
    if (auth_strategy === 'openshift') {
        cy.log('Log in using auth provider: ' + KUBEADMIN_IDP);
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
        cy.log('Log in as user: ' + USERNAME)
        cy.get('#inputUsername').clear().type('' || USERNAME);
        cy.get('#inputPassword').type('' || PASSWD);
        cy.get('button[type="submit"]').click()
    }
})

Then('user see console in URL', () => {
    if (auth_strategy === 'openshift') {
        cy.url().should('include', 'console')
    }
})

