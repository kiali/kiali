import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

Given('I am on the {string} workload detail page of the {string} namespace', (workload: string, namespace: string) => {
  cy.visit({ url: `/console/namespaces/${namespace}/workloads/${workload}?refresh=0` });
});

Given(
  'I am on the logs tab of the {string} workload detail page of the {string} namespace',
  (workload: string, namespace: string) => {
    cy.visit({ url: `/console/namespaces/${namespace}/workloads/${workload}?tab=logs&refresh=0` });

    const changeIntervalDuration = (): void => {
      cy.get('#metrics_filter_interval_duration-toggle').click();
      cy.get('#3600').click();
    };

    // In OSSMC, the duration interval is configured using the time duration modal component
    if (Cypress.env('OSSMC')) {
      cy.get('#time_duration').click();
      changeIntervalDuration();
      cy.get('#time-duration-modal').find('button').contains('Confirm').click();
    } else {
      changeIntervalDuration();
    }
  }
);

When('I go to the Logs tab of the workload detail page', () => {
  cy.get('[data-test=workload-details-logs-tab]').click();
});

When('I set the duration to 1h', () => {
  cy.get('#metrics_filter_interval_duration-toggle').click();
  cy.get('#3600').click();
});

When('I type {string} on the Show text field', (showText: string) => {
  cy.get('#log_show').type(`${showText}{enter}`);
});

When('I type {string} on the Hide text field', (showText: string) => {
  cy.get('#log_hide').type(`${showText}{enter}`);
});

When('I choose to show 100 lines of logs', () => {
  cy.get('#wpl_maxLines-toggle').click();
  cy.get('#100').click();
});

When('I select only the {string} container', (containerName: string) => {
  cy.get('[data-test=workload-logs-pod-containers]').within(() => {
    cy.get('[type=checkbox]').uncheck();

    cy.get(`input#container-${containerName}`).check();
  });
});

When('I select the {string} container', (containerName: string) => {
  cy.get('[data-test=workload-logs-pod-containers]').within(() => {
    cy.get(`input#${containerName}`).check();
  });
});

When('I enable visualization of spans', () => {
  cy.get('#trace-limit-dropdown-toggle').should('not.exist');
  cy.get('[data-test=workload-logs-pod-containers]').within(() => {
    cy.get('[type=checkbox]').uncheck();
  });

  cy.get('input#spans-show').check();
});

Then('I should see the {string} container listed', (containerName: string) => {
  cy.get('[data-test=workload-logs-pod-containers]')
    .get('label')
    .contains(containerName)
    .should('have.text', containerName);
});

Then('the {string} container should be checked', (containerName: string) => {
  cy.get('[data-test=workload-logs-pod-containers]').find(`input#${containerName}`).should('be.checked');
});

Then('I should see some {string} pod selected in the pod selector', (podNamePrefix: string) => {
  cy.get('#wpl_pods-toggle').should('include.text', podNamePrefix);
});

Then('the log pane should only show log lines containing {string}', (filterText: string) => {
  cy.get('#logsText')
    .find('p')
    .each(line => {
      expect(line).to.contain(filterText);
    });
});

Then('the log pane should only show log lines not containing {string}', (filterText: string) => {
  cy.get('#logsText')
    .find('p')
    .each(line => {
      expect(line).to.not.contain(filterText);
    });
});

Then('the log pane should only show json log lines', () => {
  cy.get('#logsText').within(() => {
    cy.get('button').find('svg.pf-v5-svg').should('exist');
  });
});

Then('the log pane should show log lines containing {string}', (filterText: string) => {
  cy.get('#logsText')
    .find('p')
    .then(lines => {
      const linesArray = lines.toArray();
      const found = linesArray.some(line => line.innerText.includes(filterText));
      assert.isTrue(found);
    });
});

Then(
  'the log pane should show at most {int} lines of logs of each selected container',
  (numberOfLinesPerContainer: number) => {
    cy.get('[data-test=workload-logs-pod-containers]')
      .find('[type=checkbox]:checked')
      .its('length')
      .then(numContainersEnabled => {
        cy.get('#logsText')
          .find('p')
          .its('length')
          .should('be.lte', numContainersEnabled * numberOfLinesPerContainer);
      });
  }
);

Then('the log pane should only show logs for the {string} container', (containerName: string) => {
  cy.get('[data-test=workload-logs-pod-containers]')
    .find('label')
    .contains(containerName)
    .then($podLabel => {
      let logColor = $podLabel[0].style.color;

      cy.get('#logsText')
        .find('p')
        .each(line => {
          expect(line[0].style.color).to.equal(logColor);
        });
    });
});

Then('the log pane should show spans', () => {
  cy.get('#trace-limit-dropdown-toggle').should('exist');
  cy.get('#spans-show')
    .invoke('css', 'accentColor')
    .then(spansColor => {
      cy.get('#logsText').find('p').should('have.css', 'color', spansColor);
    });
});

Then('I click a json log line', () => {
  cy.get('#logsText').within(() => {
    cy.get('button').find('svg.pf-v5-svg').should('exist');
    cy.get('button').first().click();
  });
});

Then('I click on the parsed json tab', () => {
  cy.get('[data-test="json-modal"]')
    .should('be.visible')
    .within(() => {
      cy.get('[data-test="json-table-tab"]').click();
    });
});

Then('I should see certain values on the parsed object', () => {
  cy.get('[data-test="parsed-json-table"]').within(() => {
    cy.get('tr')
      .first()
      .within(() => {
        cy.get('td').eq(0).should('contain.text', 'a');
        cy.get('td').eq(1).should('contain.text', 'b');
      });
  });
});
