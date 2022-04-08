import { Given, Then, When } from "cypress-cucumber-preprocessor/steps";

Given("I am on the {string} workload detail page", (workload) => {
    // Go to workloads list
    cy.get("#Workloads").click();

    // Select "bookinfo" namespace
    cy.get("#namespace-selector").click();
    cy.get("#bulk-select-id").uncheck();
    cy.get('#namespace-list-item\\[bookinfo\\] input').check();
    cy.get("#namespace-selector").click();

    // Open workload detail page
    cy.get(`[data-cy=VirtualItem_Nsbookinfo_${workload}] a`).click();
});

When("I go to the Logs tab of the workload detail page", () => {
    cy.get("[data-cy=workload-details-logs-tab]").click();
});

Then("I should see the {string} container listed", (containerName) => {
    let containerListForm = cy.get("[data-cy=workload-logs-pod-containers]");
    let podLabel = containerListForm.get("label").contains(containerName);
    podLabel.should('have.text', containerName)
});
