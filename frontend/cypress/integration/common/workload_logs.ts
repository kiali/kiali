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

When("I go to the Logs tab of the workload detail page", () => {
    cy.get("[data-test=workload-details-logs-tab]").click();
});

Then("I should see the {string} container listed", (containerName) => {
    let containerListForm = cy.get("[data-test=workload-logs-pod-containers]");

    let podLabel = containerListForm.get("label").contains(containerName);
    podLabel.should('have.text', containerName);
});
