import { Given, Then, When } from "cypress-cucumber-preprocessor/steps";

function goToWorkloadDetailPage(namespace: string, workload: string) {
    // Go to workloads list
    cy.get("#Workloads").click();

    // Select "bookinfo" namespace
    cy.get("#namespace-selector").click();
    cy.get("#bulk-select-id").uncheck();
    cy.get(`#namespace-list-item\\[${namespace}\\] input`).check();
    cy.get("#namespace-selector").click();

    // Open workload detail page
    cy.get(`[data-test=VirtualItem_Nsbookinfo_${workload}] a`).click();
}

Given("I am on the {string} workload detail page of the {string} namespace", (workload, namespace) => {
    goToWorkloadDetailPage(namespace, workload);
});

Given("I am on the logs tab of the {string} workload detail page of the {string} namespace", (workload, namespace) => {
    goToWorkloadDetailPage(namespace, workload);
    cy.get("[data-test=workload-details-logs-tab]").click();
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
    let containerListForm = cy.get("[data-test=workload-logs-pod-containers]");
    containerListForm.get('[type=checkbox]:checked').uncheck();

    let podLabel = containerListForm.get("label").contains(containerName);
    podLabel.invoke('attr', 'for')
        .then(labelFor => {
            cy.get(`#${labelFor}`).check();
        });
});

When("I enable visualization of spans", function () {
    cy.get("#spans-show-").check();
});

Then("I should see the {string} container listed", (containerName) => {
    let containerListForm = cy.get("[data-test=workload-logs-pod-containers]");

    let podLabel = containerListForm.get("label").contains(containerName);
    podLabel.should('have.text', containerName);
});

Then("the {string} container should be checked", containerName => {
    let containerListForm = cy.get("[data-test=workload-logs-pod-containers]");
    let podLabel = containerListForm.get("label").contains(containerName);

    podLabel.invoke('attr', 'for')
        .then(labelFor => {
            cy.get(`#${labelFor}`).should('be.checked');
        });
});

Then("I should see some {string} pod selected in the pod selector", podNamePrefix => {
    cy.get('#wpl_pods-toggle').should('include.text', podNamePrefix);
});

Then("the log pane should only show log lines containing {string}", filterText => {
    let logPane = cy.get('#logsText');
    logPane.get('p').each(line => {
        expect(line).to.contain(filterText);
    });
});

Then("the log pane should only show log lines not containing {string}", filterText => {
    let logPane = cy.get('#logsText');
    logPane.get('p').each(line => {
        expect(line).to.not.contain(filterText);
    });
});

Then("the log pane should show only {int} lines of logs of each selected container", numberOfLinesPerContainer => {
    let containerListForm = cy.get("[data-test=workload-logs-pod-containers]");
    let containersEnabled = containerListForm.get('[type=checkbox]:checked');

    containersEnabled.its('length').then(numContainersEnabled => {
        let logPane = cy.get('#logsText');
        logPane.get('p').its('length').should('eq', numContainersEnabled * numberOfLinesPerContainer);
    });
});

Then("the log pane should only show logs for the {string} container", containerName => {
    let containerListForm = cy.get("[data-test=workload-logs-pod-containers]");

    let podLabel = containerListForm.get("label").contains(containerName);
    podLabel.then($podLabel => {
        let logColor = $podLabel[0].style.color;

        let logPane = cy.get('#logsText');
        logPane.get('p').each(line => {
            expect(line[0].style.color).to.equal(logColor);
        })
    })
});

Then("the log pane should show spans", function () {
    cy.get("label[for=spans-show-]").invoke('css', 'color').then(spansColor => {
        let logPane = cy.get('#logsText');
        logPane.get('p').should('have.css', 'color', spansColor);
    });
});
