import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

// Most of these "Given" implementations are directly using the Kiali API
// in order to reach a well known state in the environment before performing
// the relevant UI testing. It should be noted that the Kiali API is private
// and backwards compatibility is never guaranteed.

Given('a namespace without override configuration for automatic sidecar injection', function () {
  this.targetNamespace = 'sleep';

  // Make sure that the target namespace does not have override configuration
  updateNamespaceDefinition(this.targetNamespace, null, null)
});

Given('a namespace which has override configuration for automatic sidecar injection', function () {
  this.targetNamespace = 'sleep';
  this.istioInjection = 'enabled';

  // Make sure that the target namespace has some override configuration
  updateNamespaceDefinition(this.targetNamespace, this.istioInjection, null)
});

Given('the override configuration for sidecar injection is {string}', function (enabledOrDisabled) {
  if (this.istioInjection !== enabledOrDisabled) {
    updateNamespaceDefinition(this.targetNamespace, enabledOrDisabled, null)
    this.istioInjection = enabledOrDisabled;
  }
});

Given('a workload without a sidecar', function () {
  this.targetNamespace = 'sleep';
  this.targetWorkload = 'sleep';

  // To achieve a workload without sidecar, we turn off injection in its namespace
  // and also remove any override annotation for sidecar injection.
  this.namespaceAutoInjectionEnabled = false;
  this.workloadHasSidecar = false;
  this.workloadHasAutoInjectionOverride = false;

  // Make sure that injection in the namespace is turned off
  updateNamespaceDefinition(this.targetNamespace, null, null)

  // Make sure that the workload does not have override configuration
  cy.request('PATCH', `/api/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?type=Deployment`, {
    spec: {
      template: {
        metadata: {
          labels: {
            'sidecar.istio.io/inject': null
          },
          annotations: {
            'sidecar.istio.io/inject': null
          }
        }
      }
    }
  });

  // Restart the workload to ensure changes are applied.
  cy.exec(`kubectl scale -n ${this.targetNamespace} --replicas=1 deployment/${this.targetWorkload}`);
  cy.exec(`kubectl rollout restart deployment ${this.targetWorkload} -n ${this.targetNamespace}`);
  cy.exec(`kubectl rollout status deployment ${this.targetWorkload} -n ${this.targetNamespace}`);
});

Given('a workload with a sidecar', function () {
  this.targetNamespace = 'sleep';
  this.targetWorkload = 'sleep';

  // To achieve a workload with sidecar, we turn on injection in its namespace
  // and also remove any override annotation for sidecar injection.
  this.namespaceAutoInjectionEnabled = true;
  this.workloadHasSidecar = true;
  this.workloadHasAutoInjectionOverride = false;

  // Make sure that injection in the namespace is turned on
  updateNamespaceDefinition(this.targetNamespace, 'enabled', null)

  // Make sure that the workload does not have override configuration
  //
  // TODO: The namespace injection label doesn't work with OSSM.
  // Need some kind of tag to exclude certain tests based on the
  // platform or environment. The sidecar label really shouldn't be
  // present here for istio.
  cy.request('PATCH', `/api/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?type=Deployment`, {
    spec: {
      template: {
        metadata: {
          labels: {
            'sidecar.istio.io/inject': 'true'
          },
          annotations: {
            'sidecar.istio.io/inject': null
          }
        }
      }
    }
  });

  // Restart the workload to ensure changes are applied.
  cy.exec(`kubectl scale -n ${this.targetNamespace} --replicas=1 deployment/${this.targetWorkload}`);
  cy.exec(`kubectl rollout restart deployment ${this.targetWorkload} -n ${this.targetNamespace}`);
  cy.exec(`kubectl rollout status deployment ${this.targetWorkload} -n ${this.targetNamespace}`);
});

Given('the workload does not have override configuration for automatic sidecar injection', function () {
  if (this.workloadHasAutoInjectionOverride) {
    if (this.workloadHasSidecar) {
      // To achieve the desired state of having a sidecar without override config,
      // enable injection at namespace level
      this.namespaceAutoInjectionEnabled = true;
      updateNamespaceDefinition(this.targetNamespace, 'enabled', null)
    } else {
      // To achieve the desired state of no sidecar without override config,
      // disable injection at namespace level.
      this.namespaceAutoInjectionEnabled = false;
      updateNamespaceDefinition(this.targetNamespace, 'disabled', null)
    }

    // Now, we can remove the override config at deployment level
    this.workloadHasAutoInjectionOverride = false;
    cy.request('PATCH', `/api/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?type=Deployment`, {
      spec: {
        template: {
          metadata: {
            labels: {
              'sidecar.istio.io/inject': null
            },
            annotations: {
              'sidecar.istio.io/inject': null
            }
          }
        }
      }
    });

    // Restart the workload to ensure changes are applied.
    cy.exec(`kubectl scale -n ${this.targetNamespace} --replicas=1 deployment/${this.targetWorkload}`);
    cy.exec(`kubectl rollout restart deployment ${this.targetWorkload} -n ${this.targetNamespace}`);
    cy.exec(`kubectl rollout status deployment ${this.targetWorkload} -n ${this.targetNamespace}`);
  }
});

Given('the workload has override configuration for automatic sidecar injection', function () {
  if (!this.workloadHasAutoInjectionOverride) {
    // Add override configuration, matching sidecar state
    this.workloadHasAutoInjectionOverride = true;
    cy.request('PATCH', `/api/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?type=Deployment`, {
      spec: {
        template: {
          metadata: {
            labels: {
              'sidecar.istio.io/inject': this.workloadHasSidecar ? 'true' : 'false'
            },
            annotations: {
              'sidecar.istio.io/inject': null
            }
          }
        }
      }
    });
  }
});

Given('a workload with override configuration for automatic sidecar injection', function () {
  this.targetNamespace = 'sleep';
  this.targetWorkload = 'sleep';

  // At the moment, it does not matter if the sidecar is being injected or not. The goal is to have
  // the override annotation on it.
  cy.request('PATCH', `/api/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?type=Deployment`, {
    spec: {
      template: {
        metadata: {
          labels: {
            'sidecar.istio.io/inject': 'true'
          },
          annotations: {
            'sidecar.istio.io/inject': null
          }
        }
      }
    }
  });
});

When('I visit the overview page', function () {
  cy.visit('/console/overview?refresh=0');
  cy.contains('Inbound traffic', { matchCase: false }); // Make sure data finished loading, so avoid broken tests because of a re-render
});

When('I override the default automatic sidecar injection policy in the namespace to enabled', function () {
  cy.request('GET', '/api/status').then(response => {
    expect(response.status).to.equal(200);
    const isMaistra = response.body.istioEnvironment.isMaistra;

    cy.get('[data-test=overview-type-LIST]').should('be.visible').click();
    cy.get('[data-test=overview-type-LIST]').should('be.visible').click();
    cy.get(`[data-test=VirtualItem_${this.targetNamespace}] button`).should('be.visible').click();
    // Maistra does not support namespace-level injection
    if (isMaistra) {
      cy.get(`[data-test=enable-${this.targetNamespace}-namespace-sidecar-injection]`).should('not.exist');
    } else {
      cy.get(`[data-test=enable-${this.targetNamespace}-namespace-sidecar-injection]`).should('be.visible').click();
      cy.get('[data-test=confirm-traffic-policies]').should('be.visible').click();
      ensureKialiFinishedLoading();
    }
  });
});

When(
  'I change the override configuration for automatic sidecar injection policy in the namespace to {string} it',
  function (enabledOrDisabled) {
    cy.request('GET', '/api/status').then(response => {
      expect(response.status).to.equal(200);
      const isMaistra = response.body.istioEnvironment.isMaistra;

      cy.get('[data-test=overview-type-LIST]').should('be.visible').click();
      cy.get(`[data-test=VirtualItem_${this.targetNamespace}] button`).should('be.visible').click();
      // Maistra does not support namespace-level injection
      if (isMaistra) {
        cy.get(`[data-test=${enabledOrDisabled}-${this.targetNamespace}-namespace-sidecar-injection]`).should(
          'not.exist'
        );
      } else {
        cy.get(`[data-test=${enabledOrDisabled}-${this.targetNamespace}-namespace-sidecar-injection]`)
          .should('be.visible')
          .click();
        cy.get('[data-test=confirm-traffic-policies]').should('be.visible').click();
        ensureKialiFinishedLoading();
      }
    });
  }
);

When('I remove override configuration for sidecar injection in the namespace', function () {
  cy.request('GET', '/api/status').then(response => {
    expect(response.status).to.equal(200);
    const isMaistra = response.body.istioEnvironment.isMaistra;

    cy.get('[data-test=overview-type-LIST]').should('be.visible').click();
    cy.get(`[data-test=VirtualItem_${this.targetNamespace}] button`).should('be.visible').click();
    if (isMaistra) {
      cy.get(`[data-test=remove-${this.targetNamespace}-namespace-sidecar-injection]`).should('not.exist');
    } else {
      cy.get(`[data-test=remove-${this.targetNamespace}-namespace-sidecar-injection]`).should('be.visible').click();
      cy.get('[data-test=confirm-traffic-policies]').should('be.visible').click();
      ensureKialiFinishedLoading();
    }
  });
});

function switchWorkloadSidecarInjection(enableOrDisable) {
  cy.visit(`/console/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?refresh=0`);
  cy.get('[data-test="workload-actions-dropdown"] button').should('be.visible').click();
  cy.get(`button[data-test=${enableOrDisable}_auto_injection]`).should('be.visible').click();
  ensureKialiFinishedLoading();
}

When(
  'I override the default policy for automatic sidecar injection in the workload to {string} it',
  switchWorkloadSidecarInjection
);

When(
  'I change the override configuration for automatic sidecar injection in the workload to {string} it',
  switchWorkloadSidecarInjection
);

When('I remove override configuration for sidecar injection in the workload', function () {
  switchWorkloadSidecarInjection.apply(this, ['remove']);
});

Then('I should see the override annotation for sidecar injection in the namespace as {string}', function (enabled) {
  cy.request('GET', '/api/status').then(response => {
    expect(response.status).to.equal(200);
    const isMaistra = response.body.istioEnvironment.isMaistra;
    
    // do not test for maistra since it can or cannot exist due to the SMCP mode (ClusterWide or MultiTenant) That infromation is not propagated to kiali so we don't know here if that annotation should exist or not
    if (!isMaistra) {
      cy.get(`[data-test=VirtualItem_${this.targetNamespace}]`)
      .contains(`istio-injection=${enabled}`)
      .should('exist');
    }
  });
});

Then('I should see no override annotation for sidecar injection in the namespace', function () {
  cy.request('GET', '/api/status').then(response => {
    expect(response.status).to.equal(200);
    const isMaistra = response.body.istioEnvironment.isMaistra;

    if (!isMaistra) {
      cy.get(`[data-test=VirtualItem_${this.targetNamespace}]`).contains(`istio-injection`).should('not.exist');
    }
  });
});

Then('the workload should get a sidecar', function () {
  cy.get('[data-test=missing-sidecar-badge-for-sleep-workload-in-sleep-namespace]').should('not.exist');
});

Then('the sidecar of the workload should vanish', function () {
  cy.get('[data-test=missing-sidecar-badge-for-sleep-workload-in-sleep-namespace]').should('exist');
});

Then('I should see no override annotation for sidecar injection in the workload', function () {
  cy.get('#WorkloadDescriptionCard').then($card => {
    if ($card.find('label_more').length) {
      cy.wrap($card).get('label_more').should('be.visible').click();
    }

    cy.wrap($card).get('[data-test="sidecar.istio.io/inject-label-container"').should('not.exist');
  });
});


function updateNamespaceDefinition(targetNamespace: string, injectLabel: any, revLabel: any) {
  cy.request('GET', '/api/status').then(response => {
    expect(response.status).to.equal(200);
    const isMaistra = response.body.istioEnvironment.isMaistra;
    // do not change namespace settings if env is maistra
    if (!isMaistra) {
      cy.request('PATCH', '/api/namespaces/' + targetNamespace, {
        metadata: {
          labels: {
            'istio-injection': injectLabel,
            'istio.io/rev': revLabel
          }
        }
      });
    }
  });
}