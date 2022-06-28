import {And, Before, Given, Then, When} from "cypress-cucumber-preprocessor/steps";

const url = "/console";

Before(() => {
    // Focing to not stop cypress on unexpected errors not related to the tests.
    // There are some random failures due timeouts/loadtime/framework that throws some error in the browser.
    // After reviewing the tests failures, those are unrelated to the app, so,
    // it needs this event to not fail the CI action due some "slow" action or similar.
    // This is something to review in future iterations when tests are solid, but I haven't found a better way to
    // solve this issue.
    cy.on("uncaught:exception", (err, runnable, promise) => {
        // when the exception originated from an unhandled promise
        // rejection, the promise is provided as a third argument
        // you can turn off failing the test in this case
        if (promise) {
            return false
        }
        // we still want to ensure there are no other unexpected
        // errors, so we let them fail the test
    });
});

Given('user opens the namespace {string} and {string} service details page', (namespace, service) => {
    // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
    cy.visit(url + '/namespaces/' + namespace + '/services/' + service + '?refresh=0');
});

When('user clicks in the {string} actions', (action) => {
    let actionId = '';
    switch (action) {
        case 'Request Routing':
            actionId = 'request_routing';
            break;
        case 'Delete Traffic Routing':
            actionId = 'delete_traffic_routing';
            break;
    }
    cy.get('button[data-test="wizard-actions"]')
        .click()
        .get('#loading_kiali_spinner')
        .should('not.exist');

    cy.get('button[data-test="' + actionId + '"]')
        .click()
        .get('#loading_kiali_spinner')
        .should('not.exist');
});

And('user sees the {string} wizard', (title) => {
    cy.get('div[aria-label="' + title + '"]');
});

And('user clicks in the {string} tab', (tab) => {
    cy.get('button[data-test="' + tab +'"]')
        .click();
});

And('user clicks in the {string} request matching dropdown', (select) => {
    cy.get('button[data-test="requestmatching-header-toggle"]')
        .click();

    cy.get('button[data-test="requestmatching-header-' + select + '"]')
        .click();
});

And('user types {string} in the matching header input', (header) => {
    cy.get('input[id="header-name-id"]')
        .type(header);
});

And('user clicks in the {string} match value dropdown', (value) => {
    cy.get('button[data-test="requestmatching-match-toggle"]')
        .click();

    cy.get('button[data-test="requestmatching-match-' + value + '"]')
        .click();
});

And('user types {string} in the match value input', (value) => {
    cy.get('input[id="match-value-id"]')
        .type(value);
});

And('user adds a match', () => {
    cy.get('button[data-test="add-match"]')
        .click();
});

And('user types {string} traffic weight in the {string} workload', (weight, workload) => {
    cy.get('input[data-test="input-slider-' + workload + '"]')
        .type(weight);
});

And('user adds a route', () => {
    cy.get('button[data-test="add-route"]')
        .click();
});

And('user clicks in {string} matching selected', (match) => {
   cy.get('span[data-test="' + match + '"]')
       .children()
       .first()         // div wrapper
       .children()
       .first()         // button
       .click();
});

And('user previews the configuration', () => {
    cy.get('button[data-test="preview"]')
        .click();
});

And('user creates the configuration', () => {
    cy.get('button[data-test="create"]')
        .click();

    cy.get('button[data-test="confirm-create"]')
        .click()
        .get('#loading_kiali_spinner')
        .should('not.exist');
});

And('user updates the configuration', () => {
    cy.get('button[data-test="update"]')
        .click();

    cy.get('button[data-test="confirm-update"]')
        .click()
        .get('#loading_kiali_spinner')
        .should('not.exist');
});

And('user confirms delete the configuration', () => {
    cy.get('button[data-test="confirm-delete"]')
        .click()
        .get('#loading_kiali_spinner')
        .should('not.exist');
});

And('user sees the {string} {string} {string} reference', (namespace, name, type) => {
    cy.get('a[data-test="' + type + '-' + namespace + '-' + name + '"]');
});

And('user clicks in the {string} {string} {string} reference', (namespace, name, type) => {
    cy.get('a[data-test="' + type + '-' + namespace + '-' + name + '"]')
        .click();

    let expectedURl = '';
    switch (type) {
        case 'destinationrule':
            expectedURl = '/namespaces/' + namespace + '/istio/destinationrules/' + name;
            break;
        case 'service':
            expectedURl = '/namespaces/' + namespace + '/services/' + name;
            break;
        case 'virtualservice':
            expectedURl = '/namespaces/' + namespace + '/istio/virtualservices/' + name;
            break;
    }

    cy.location('pathname')
        .should('include', expectedURl);
});

And('user sees the {string} regex in the editor', (regexContent) => {
    const re = new RegExp(regexContent);
    cy.get('.ace_content')
        .invoke('text')
        .should('match', re);
});

And('user clicks on {string} Advanced Options', (action) => {
    cy.get('div[id="' + action.toLowerCase() + '_advanced_options"]').prev()
        .click();
});

And('user clicks on Add Gateway', () => {
    cy.get('input[id="advanced-gwSwitch"]').next()
        .click();
});

And('user selects Create Gateway', () => {
    cy.get('input[id="createGateway"]')
        .click();
});

And('user sees warning icon in ACE editor', () => {
    cy.get('.ace_warning')
});