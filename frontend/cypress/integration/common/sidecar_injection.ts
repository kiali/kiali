import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';
import { MeshCluster } from 'types/Mesh';

// Most of these "Given" implementations are directly using the Kiali API
// in order to reach a well known state in the environment before performing
// the relevant UI testing. It should be noted that the Kiali API is private
// and backwards compatibility is never guaranteed.

Given('a namespace without override configuration for automatic sidecar injection', function () {
  this.targetNamespace = 'sleep';

  // Make sure that the target namespace does not have override configuration
  cy.request({
    method: 'PATCH',
    url: `/api/namespaces/${this.targetNamespace}`,
    body: {
      metadata: {
        labels: {
          'istio-injection': null,
          'istio.io/rev': null
        }
      }
    }
  });
});

Given('a namespace which has override configuration for automatic sidecar injection', function () {
  this.targetNamespace = 'sleep';
  this.istioInjection = 'enabled';

  // Make sure that the target namespace has some override configuration
  cy.request({
    method: 'PATCH',
    url: `/api/namespaces/${this.targetNamespace}`,
    body: {
      metadata: {
        labels: {
          'istio-injection': this.istioInjection,
          'istio.io/rev': null
        }
      }
    }
  });
});

Given('the override configuration for sidecar injection is {string}', function (enabledOrDisabled) {
  if (this.istioInjection !== enabledOrDisabled) {
    cy.request({
      method: 'PATCH',
      url: `/api/namespaces/${this.targetNamespace}`,
      body: {
        metadata: {
          labels: {
            'istio-injection': enabledOrDisabled,
            'istio.io/rev': null
          }
        }
      }
    });

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
  cy.request({
    method: 'PATCH',
    url: `/api/namespaces/${this.targetNamespace}`,
    body: {
      metadata: {
        labels: {
          'istio-injection': null,
          'istio.io/rev': null
        }
      }
    }
  });

  // Make sure that the workload does not have override configuration
  cy.request({
    request: 'PATCH',
    url: `/api/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?type=Deployment`,
    body: {
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
    }
  });

  // Restart the workload to ensure the changes are applied.
  restartWorkload(this.targetNamespace, this.targetWorkload);
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
  cy.request({
    method: 'PATCH',
    url: `/api/namespaces/${this.targetNamespace}`,
    body: {
      metadata: {
        labels: {
          'istio-injection': 'enabled',
          'istio.io/rev': null
        }
      }
    }
  });

  // Make sure that the workload does not have override configuration
  //
  // Need some kind of tag to exclude certain tests based on the
  // platform or environment. The sidecar label really shouldn't be
  // present here for istio.
  cy.request({
    method: 'PATCH',
    url: `/api/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?type=Deployment`,
    body: {
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
    }
  });

  // Restart the workload to ensure the changes are applied.
  restartWorkload(this.targetNamespace, this.targetWorkload);
});

Given('the workload does not have override configuration for automatic sidecar injection', function () {
  if (this.workloadHasAutoInjectionOverride) {
    if (this.workloadHasSidecar) {
      // To achieve the desired state of having a sidecar without override config,
      // enable injection at namespace level
      this.namespaceAutoInjectionEnabled = true;

      cy.request({
        method: 'PATCH',
        url: `/api/namespaces/${this.targetNamespace}`,
        body: {
          metadata: {
            labels: {
              'istio-injection': 'enabled',
              'istio.io/rev': null
            }
          }
        }
      });
    } else {
      // To achieve the desired state of no sidecar without override config,
      // disable injection at namespace level.
      this.namespaceAutoInjectionEnabled = false;

      cy.request({
        method: 'PATCH',
        url: `/api/namespaces/${this.targetNamespace}`,
        body: {
          metadata: {
            labels: {
              'istio-injection': 'disabled',
              'istio.io/rev': null
            }
          }
        }
      });
    }

    // Now, we can remove the override config at deployment level
    this.workloadHasAutoInjectionOverride = false;

    cy.request({
      method: 'PATCH',
      url: `/api/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?type=Deployment`,
      body: {
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
      }
    });

    // Restart the workload to ensure the changes are applied.
    restartWorkload(this.targetNamespace, this.targetWorkload);
  }
});

Given('the workload has override configuration for automatic sidecar injection', function () {
  if (!this.workloadHasAutoInjectionOverride) {
    // Add override configuration, matching sidecar state
    this.workloadHasAutoInjectionOverride = true;

    cy.request({
      method: 'PATCH',
      url: `/api/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?type=Deployment`,
      body: {
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
      }
    });
  }
});

Given('a workload with override configuration for automatic sidecar injection', function () {
  this.targetNamespace = 'sleep';
  this.targetWorkload = 'sleep';

  // At the moment, it does not matter if the sidecar is being injected or not. The goal is to have
  // the override annotation on it.
  cy.request({
    method: 'PATCH',
    url: `/api/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?type=Deployment`,
    body: {
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
    }
  });
});

When('I visit the overview page', () => {
  cy.visit({ url: '/console/overview?refresh=0' });
  cy.contains('Inbound traffic', { matchCase: false }); // Make sure data finished loading, so avoid broken tests because of a re-render
});

// Only works for single cluster.
When('I override the default automatic sidecar injection policy in the namespace to enabled', function () {
  cy.request({ method: 'GET', url: '/api/status' }).then(response => {
    expect(response.status).to.equal(200);

    cy.request({ url: '/api/config' }).then(response => {
      cy.wrap(response.isOkStatusCode).should('be.true');

      const clusters: { [key: string]: MeshCluster } = response.body.clusters;
      const clusterNames = Object.keys(clusters);
      cy.wrap(clusterNames).should('have.length', 1);
      const cluster = clusterNames[0];

      cy.getBySel('overview-type-LIST').should('be.visible').click();

      cy.get(`[data-test=VirtualItem_Cluster${cluster}_${this.targetNamespace}] button[aria-label=Actions]`)
        .should('be.visible')
        .click();

      cy.getBySel(`enable-${this.targetNamespace}-namespace-sidecar-injection`).should('be.visible').click();
      cy.getBySel('confirm-create').should('be.visible').click();
    });

    ensureKialiFinishedLoading();
  });
});

When(
  'I change the override configuration for automatic sidecar injection policy in the namespace to {string} it',
  function (enabledOrDisabled: string) {
    cy.request({ method: 'GET', url: '/api/status' }).then(response => {
      expect(response.status).to.equal(200);

      cy.request({ url: '/api/config' }).then(response => {
        cy.wrap(response.isOkStatusCode).should('be.true');

        const clusters: { [key: string]: MeshCluster } = response.body.clusters;
        const clusterNames = Object.keys(clusters);
        cy.wrap(clusterNames).should('have.length', 1);
        const cluster = clusterNames[0];

        cy.getBySel('overview-type-LIST').should('be.visible').click();

        cy.get(`[data-test=VirtualItem_Cluster${cluster}_${this.targetNamespace}] button[aria-label=Actions]`)
          .should('be.visible')
          .click();

        cy.getBySel(`${enabledOrDisabled}-${this.targetNamespace}-namespace-sidecar-injection`)
          .should('be.visible')
          .click();

        cy.getBySel('confirm-create').should('be.visible').click();
        ensureKialiFinishedLoading();
      });
    });
  }
);

When('I remove override configuration for sidecar injection in the namespace', function () {
  cy.request({ method: 'GET', url: '/api/status' }).then(response => {
    expect(response.status).to.equal(200);

    cy.request({ url: '/api/config' }).then(response => {
      cy.wrap(response.isOkStatusCode).should('be.true');

      const clusters: { [key: string]: MeshCluster } = response.body.clusters;
      const clusterNames = Object.keys(clusters);
      cy.wrap(clusterNames).should('have.length', 1);
      const cluster = clusterNames[0];

      cy.getBySel('overview-type-LIST').should('be.visible').click();

      cy.get(`[data-test=VirtualItem_Cluster${cluster}_${this.targetNamespace}] button[aria-label=Actions]`)
        .should('be.visible')
        .click();

      cy.getBySel(`remove-${this.targetNamespace}-namespace-sidecar-injection`).should('be.visible').click();
      cy.getBySel('confirm-create').should('be.visible').click();

      ensureKialiFinishedLoading();
    });
  });
});

function switchWorkloadSidecarInjection(enableOrDisable: string): void {
  cy.visit({ url: `/console/namespaces/${this.targetNamespace}/workloads/${this.targetWorkload}?refresh=0` });

  cy.get('button[data-test="workload-actions-toggle"]').should('be.visible').click();
  cy.get(`li[data-test=${enableOrDisable}_auto_injection]`).find('button').should('be.visible').click();

  // Restart the workload to ensure the changes are applied.
  restartWorkload(this.targetNamespace, this.targetWorkload);

  ensureKialiFinishedLoading();
}

const restartWorkload = (targetNamespace: string, targetWorkload: string): void => {
  cy.exec(`kubectl scale -n ${targetNamespace} --replicas=1 deployment/${targetWorkload}`);
  cy.exec(`kubectl rollout restart deployment ${targetWorkload} -n ${targetNamespace}`);
  cy.exec(`kubectl rollout status deployment ${targetWorkload} -n ${targetNamespace}`);
};

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

Then('I should see the override annotation for sidecar injection in the namespace as {string}', function (
  enabled: string
) {
  cy.request({ method: 'GET', url: '/api/status' }).then(response => {
    expect(response.status).to.equal(200);

    const expectation = 'exist';

    cy.request({ url: '/api/config' }).then(response => {
      cy.wrap(response.isOkStatusCode).should('be.true');

      const clusters: { [key: string]: MeshCluster } = response.body.clusters;
      const clusterNames = Object.keys(clusters);
      cy.wrap(clusterNames).should('have.length', 1);
      const cluster = clusterNames[0];

      cy.getBySel(`VirtualItem_Cluster${cluster}_${this.targetNamespace}`)
        .contains(`istio-injection=${enabled}`)
        .should(expectation);
    });
  });
});

Then('I should see no override annotation for sidecar injection in the namespace', function () {
  cy.request({ method: 'GET', url: '/api/status' }).then(response => {
    expect(response.status).to.equal(200);

    cy.request({ url: '/api/config' }).then(response => {
      cy.wrap(response.isOkStatusCode).should('be.true');

      const clusters: { [key: string]: MeshCluster } = response.body.clusters;
      const clusterNames = Object.keys(clusters);
      cy.wrap(clusterNames).should('have.length', 1);
      const cluster = clusterNames[0];

      cy.getBySel(`VirtualItem_Cluster${cluster}_${this.targetNamespace}`)
        .contains(`istio-injection`)
        .should('not.exist');
    });
  });
});

Then('the workload should get a sidecar', () => {
  cy.get('[data-test=missing-sidecar-badge-for-sleep-workload-in-sleep-namespace]').should('not.exist');
});

Then('the sidecar of the workload should vanish', () => {
  cy.get('[data-test=missing-sidecar-badge-for-sleep-workload-in-sleep-namespace]').should('exist');
});

Then('I should see no override annotation for sidecar injection in the workload', () => {
  cy.get('#WorkloadDescriptionCard').then($card => {
    if ($card.find('label_more').length) {
      cy.wrap($card).get('label_more').should('be.visible').click();
    }

    cy.wrap($card).get('[data-test="sidecar.istio.io/inject-label-container"').should('not.exist');
  });
});
