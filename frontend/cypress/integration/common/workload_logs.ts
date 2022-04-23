import { Given, Then, When } from "cypress-cucumber-preprocessor/steps";

Given("I am on the {string} workload detail page of the {string} namespace", (workload, namespace) => {
    cy.visit(`/console/namespaces/${namespace}/workloads/${workload}`);
});

Given("I am on the logs tab of the {string} workload detail page of the {string} namespace", (workload, namespace) => {
    cy.visit(`/console/namespaces/${namespace}/workloads/${workload}?tab=logs`);
});

When("I go to the Logs tab of the workload detail page", () => {
    cy.get("[data-test=workload-details-logs-tab]").click();
});

When("I type {string} on the Show text field", showText => {
    cy.get('#log_show').type(showText + '{enter}');
});

When("I type {string} on the Hide text field", showText => {
    cy.get('#log_hide').type(showText + '{enter}');
});

When("I choose to show 10 lines of logs", () => {
    cy.get('#wpl_tailLines-toggle').click();
    cy.get('#10-0').click();
});

When("I select only the {string} container", containerName => {
    cy.get("[data-test=workload-logs-pod-containers]").within(() => {
        cy.get('[type=checkbox]:checked').uncheck();
        cy.get("label").contains(containerName).invoke('attr', 'for')
            .then(labelFor => {
                cy.get(`#${labelFor}`).check();
            });
    });
});

When("I enable visualization of spans", () => {
    cy.get("#spans-show-").check();
});

Then("I should see the {string} container listed", (containerName) => {
    cy.get("[data-test=workload-logs-pod-containers]")
        .get("label")
        .contains(containerName)
        .should('have.text', containerName);
});

Then("the {string} container should be checked", containerName => {
    cy.get("[data-test=workload-logs-pod-containers]")
        .get("label")
        .contains(containerName)
        .invoke('attr', 'for')
        .then(labelFor => {
            cy.get(`#${labelFor}`).should('be.checked');
        });
});

Then("I should see some {string} pod selected in the pod selector", podNamePrefix => {
    cy.get('#wpl_pods-toggle').should('include.text', podNamePrefix);
});

Then("the log pane should only show log lines containing {string}", filterText => {
    cy.get('#logsText')
        .get('p')
        .each(line => {
            expect(line).to.contain(filterText);
        });
});

Then("the log pane should only show log lines not containing {string}", filterText => {
    cy.get('#logsText')
        .get('p')
        .each(line => {
            expect(line).to.not.contain(filterText);
        });
});

Then("the log pane should show only {int} lines of logs of each selected container", numberOfLinesPerContainer => {
    cy.get("[data-test=workload-logs-pod-containers]")
        .get('[type=checkbox]:checked')
        .its('length')
        .then(numContainersEnabled => {
            cy.get('#logsText')
                .get('p')
                .its('length')
                .should('eq', numContainersEnabled * numberOfLinesPerContainer);
        });
});

Then("the log pane should only show logs for the {string} container", containerName => {
    cy.get("[data-test=workload-logs-pod-containers]")
        .get("label")
        .contains(containerName)
        .then($podLabel => {
            let logColor = $podLabel[0].style.color;

            cy.get('#logsText')
                .get('p')
                .each(line => {
                    expect(line[0].style.color).to.equal(logColor);
                });
        });
});

Then("the log pane should show spans", () => {
    cy.get("label[for=spans-show-]").invoke('css', 'color').then(spansColor => {
        cy.get('#logsText').get('p').should('have.css', 'color', spansColor);
    });
});
