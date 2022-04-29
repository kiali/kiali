import { Given, Then, When } from "cypress-cucumber-preprocessor/steps";

Given('a namespace without override configuration for automatic sidecar injection', function () {
    this.targetNamespace = "default";

    // Make sure that the target namespace does not have override configuration
    cy.request('PATCH', 'api/namespaces/' + this.targetNamespace, {
        metadata: {
            labels: {
                "istio-injection": null,
                "istio.io/rev": null
            }
        }
    });
});

Given('a namespace which has override configuration for automatic sidecar injection', function () {
    this.targetNamespace = "default";
    this.istioInjection = "enabled";

    // Make sure that the target namespace has some override configuration
    cy.request('PATCH', 'api/namespaces/' + this.targetNamespace, {
        metadata: {
            labels: {
                "istio-injection": this.istioInjection,
                "istio.io/rev": null
            }
        }
    });
});

Given('the override configuration for sidecar injection is {string}', function (enabledOrDisabled) {
    if (this.istioInjection !== enabledOrDisabled) {
        cy.request('PATCH', 'api/namespaces/' + this.targetNamespace, {
            metadata: {
                labels: {
                    "istio-injection": enabledOrDisabled,
                    "istio.io/rev": null
                }
            }
        });
        this.istioInjection = enabledOrDisabled;
    }
});

When('I override the default automatic sidecar injection policy in the namespace to enabled', function () {
    cy.visit('overview');
    cy.get('[data-test=overview-type-LIST]').click();
    cy.get(`[data-test=VirtualItem_${this.targetNamespace}] button`).click();
    cy.get(`[data-test=enable-${this.targetNamespace}-namespace-sidecar-injection]`).click();
    cy.get('[data-test=confirm-traffic-policies]').click();
});

When('I change the override configuration for automatic sidecar injection policy in the namespace to {string} it', function (enabledOrDisabled) {
    cy.visit('overview');
    cy.get('[data-test=overview-type-LIST]').click();
    cy.get(`[data-test=VirtualItem_${this.targetNamespace}] button`).click();
    cy.get(`[data-test=${enabledOrDisabled}-${this.targetNamespace}-namespace-sidecar-injection]`).click();
    cy.get('[data-test=confirm-traffic-policies]').click();
});

When('I remove override configuration for sidecar injection in the namespace', function () {
    cy.visit('overview');
    cy.get('[data-test=overview-type-LIST]').click();
    cy.get(`[data-test=VirtualItem_${this.targetNamespace}] button`).click();
    cy.get(`[data-test=remove-${this.targetNamespace}-namespace-sidecar-injection]`).click();
    cy.get('[data-test=confirm-traffic-policies]').click();
});

Then('I should see the override annotation for sidecar injection in the namespace as {string}', function (enabled) {
    cy.get(`[data-test=VirtualItem_${this.targetNamespace}]`).contains(`istio-injection: ${enabled}`).should('exist');
});

Then('I should see no override annotation for sidecar injection in the namespace', function () {
    cy.get(`[data-test=VirtualItem_${this.targetNamespace}]`).contains(`istio-injection`).should('not.exist');
});