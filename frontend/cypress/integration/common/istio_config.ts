import { After, Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { colExists, getColWithRowText } from './table';
import { ensureKialiFinishedLoading } from './transition';

const CLUSTER1_CONTEXT = Cypress.env('CLUSTER1_CONTEXT');
const CLUSTER2_CONTEXT = Cypress.env('CLUSTER2_CONTEXT');

const labelsStringToJson = (labelsString: string): string => {
  let labelsJson = '';

  if (labelsString.length !== 0) {
    labelsJson = labelsString
      .split(',')
      .map((lbl: string) => {
        let keyValue = lbl.split('=');
        let key = keyValue[0];
        let value = keyValue[1];

        return `"${key}": "${value}"`;
      })
      .join(',');
  }

  return `{${labelsJson}}`;
};

// I included this, because the URL parameter is in plural, but the the Type itself in Kiali is singular
// This works for all of the types currently present in Kiali (Feb 8 2023), but may break in the future, because
// it does not support all of the english words
const singularize = (word: string): string => {
  const endings = {
    ves: 'fe',
    ies: 'y',
    i: 'us',
    zes: 'ze',
    ses: 's',
    es: 'e',
    s: ''
  };

  return word.replace(new RegExp(`(${Object.keys(endings).join('|')})$`), r => endings[r]);
};

const minimalAuthorizationPolicy = (name: string, namespace: string): string => {
  return `{
    "apiVersion": "security.istio.io/v1beta1",
    "kind": "AuthorizationPolicy",
    "metadata": {
        "name": "${name}",
        "namespace": "${namespace}"
    }
}`;
};

const minimalDestinationRule = (name: string, namespace: string, host: string): string => {
  return `{
    "apiVersion": "networking.istio.io/v1alpha3",
    "kind": "DestinationRule",
    "metadata": {
        "name": "${name}",
        "namespace": "${namespace}"
    },
    "spec": {
      "host": "${host}"
    }
}`;
};

const minimalVirtualService = (name: string, namespace: string, routeName: string, routeHost: string): string => {
  return `{
    "apiVersion": "networking.istio.io/v1alpha3",
    "kind": "VirtualService",
    "metadata": {
      "name": "${name}",
      "namespace": "${namespace}"
    },
    "spec": {
      "http": [
        {
          "name": "${routeName}",
          "route": [
            {
              "destination": {
                "host": "${routeHost}"
              }
            }
         ]
        }
      ]
    }
}`;
};

const minimalPeerAuthentication = (name: string, namespace: string): string => {
  return `{
    "apiVersion": "security.istio.io/v1beta1",
    "kind": "PeerAuthentication",
    "metadata": {
        "name": "${name}",
        "namespace": "${namespace}"
    }
}`;
};

const minimalGateway = (name: string, namespace: string, hosts: string, port: number, labelsString: string): string => {
  return `{
      "apiVersion": "networking.istio.io/v1alpha3",
      "kind": "Gateway",
      "metadata": {
        "name": "${name}",
        "namespace": "${namespace}"
      },
      "spec": {
        "selector": ${labelsStringToJson(labelsString)},
        "servers": [
          {
            "port": {
              "number": ${port},
              "protocol": "HTTP",
              "name": "HTTP"
            },
            "hosts": [${hosts
              .split(',')
              .map(h => `"${h}"`)
              .join(',')}]
          }
        ]
      }
}`;
};

const minimalSidecar = (name: string, namespace: string, hosts: string): string => {
  return `{
      "apiVersion": "networking.istio.io/v1alpha3",
      "kind": "Sidecar",
      "metadata": {
        "name": "${name}",
        "namespace": "${namespace}"
      },
      "spec": {
        "egress": [
          { "hosts": [${hosts
            .split(',')
            .map(h => `"${h}"`)
            .join(',')}] }
        ]
      }
}`;
};

Given('a {string} AuthorizationPolicy in the {string} namespace', function (name: string, namespace: string) {
  cy.exec(`kubectl delete AuthorizationPolicy ${name} -n ${namespace}`, { failOnNonZeroExit: false });
  cy.exec(`echo '${minimalAuthorizationPolicy(name, namespace)}' | kubectl apply -f -`);

  this.targetNamespace = namespace;
  this.targetAuthorizationPolicy = name;
});

Given('a {string} AuthorizationPolicy in the {string} namespace in the {string} cluster', function (
  name: string,
  namespace: string,
  cluster: string
) {
  let cluster_context;
  if (cluster === 'west') {
    cluster_context = CLUSTER2_CONTEXT;
  } else {
    cluster_context = CLUSTER1_CONTEXT;
  }

  cy.exec(`kubectl delete AuthorizationPolicy ${name} -n ${namespace} --context ${cluster_context}`, {
    failOnNonZeroExit: false
  });
  cy.exec(`echo '${minimalAuthorizationPolicy(name, namespace)}' | kubectl apply --context ${cluster_context} -f  -`);

  this.targetNamespace = namespace;
  this.targetAuthorizationPolicy = name;
});

Given('the AuthorizationPolicy has a from-source rule for {string} namespace', function (namespace: string) {
  cy.exec(
    `kubectl patch AuthorizationPolicy ${this.targetAuthorizationPolicy} -n ${this.targetNamespace} --type=merge -p '{"spec":{"rules":[{"from":[{"source": {"namespaces":["${namespace}"]}}]}]}}'`
  );
});

Given('the AuthorizationPolicy has a from-source rule for {string} principal', function (principal: string) {
  cy.exec(
    `kubectl patch AuthorizationPolicy ${this.targetAuthorizationPolicy} -n ${this.targetNamespace} --type=merge -p '{"spec":{"rules":[{"from":[{"source": {"principals":["${principal}"]}}]}]}}'`
  );
});

Given('the AuthorizationPolicy has a to-operation rule with {string} method', function (method: string) {
  cy.exec(
    `kubectl patch AuthorizationPolicy ${this.targetAuthorizationPolicy} -n ${this.targetNamespace} --type=merge -p '{"spec":{"rules":[{"to":[{"operation": {"methods":["${method}"]}}]}]}}'`
  );
});

Given('the AuthorizationPolicy has a to-operation rule with {string} host', function (host: string) {
  cy.exec(
    `kubectl patch AuthorizationPolicy ${this.targetAuthorizationPolicy} -n ${this.targetNamespace} --type=merge -p '{"spec":{"rules":[{"to":[{"operation": {"hosts":["${host}"]}}]}]}}'`
  );
});

Given('a {string} DestinationRule in the {string} namespace for {string} host', function (
  name: string,
  namespace: string,
  host: string
) {
  cy.exec(`kubectl delete DestinationRule ${name} -n ${namespace}`, { failOnNonZeroExit: false });
  cy.exec(`echo '${minimalDestinationRule(name, namespace, host)}' | kubectl apply -f -`);

  this.targetNamespace = namespace;
  this.targetDestinationRule = name;
});

Given('the DestinationRule has a {string} subset for {string} labels', function (subset: string, labels: string) {
  cy.exec(
    `kubectl patch DestinationRule ${this.targetDestinationRule} -n ${
      this.targetNamespace
    } --type=merge -p '{"spec":{"subsets":[ {"name":"${subset}", "labels": ${labelsStringToJson(labels)} }]}}'`
  );
});

Given(
  'there is a {string} VirtualService in the {string} namespace with a {string} http-route to host {string} and subset {string}',
  function (vsName: string, namespace: string, routeName: string, routeHost: string, subset: string) {
    cy.exec(`kubectl delete VirtualService ${vsName} -n ${namespace}`, { failOnNonZeroExit: false });
    cy.exec(`echo '${minimalVirtualService(vsName, namespace, routeName, routeHost)}' | kubectl apply -f -`);

    cy.exec(
      `kubectl patch VirtualService ${vsName} -n ${namespace} --type=json -p '[{"op": "add", "path": "/spec/http/0/route/0/destination/subset", "value": "${subset}"}]'`
    );

    this.targetNamespace = namespace;
    this.targetVirtualService = vsName;
  }
);

Given(
  'there is a {string} VirtualService in the {string} namespace with a {string} http-route to host {string}',
  function (vsName: string, namespace: string, routeName: string, routeHost: string) {
    cy.exec(`kubectl delete VirtualService ${vsName} -n ${namespace}`, { failOnNonZeroExit: false });
    cy.exec(`echo '${minimalVirtualService(vsName, namespace, routeName, routeHost)}' | kubectl apply -f -`);

    this.targetNamespace = namespace;
    this.targetVirtualService = vsName;
  }
);

Given('there is not a {string} VirtualService in the {string} namespace', (vsName: string, namespace: string) => {
  cy.exec(`kubectl delete VirtualService ${vsName} -n ${namespace}`, { failOnNonZeroExit: false });
});

Given('the DestinationRule enables mTLS', function () {
  cy.exec(
    `kubectl patch DestinationRule ${this.targetDestinationRule} -n ${this.targetNamespace} --type=merge -p '{"spec":{"trafficPolicy":{"tls": {"mode": "ISTIO_MUTUAL"}} }}'`
  );
});

Given('the DestinationRule disables mTLS', function () {
  cy.exec(
    `kubectl patch DestinationRule ${this.targetDestinationRule} -n ${this.targetNamespace} --type=merge -p '{"spec":{"trafficPolicy":{"tls": {"mode": "DISABLE"}} }}'`
  );
});

Given('there is a {string} PeerAuthentication in the {string} namespace', function (name: string, namespace: string) {
  cy.exec(`kubectl delete PeerAuthentication ${name} -n ${namespace}`, { failOnNonZeroExit: false });
  cy.exec(`echo '${minimalPeerAuthentication(name, namespace)}' | kubectl apply -f -`);

  this.targetNamespace = namespace;
  this.targetPeerAuthentication = name;
});

Given('the PeerAuthentication has {string} mtls mode', function (mtlsMode: string) {
  cy.exec(
    `kubectl patch PeerAuthentication ${this.targetPeerAuthentication} -n ${this.targetNamespace} --type=merge -p '{"spec":{"mtls":{"mode": "${mtlsMode}"}}}'`
  );
});

Given(
  'there is a {string} Gateway on {string} namespace for {string} hosts on HTTP port {int} with {string} labels selector',
  function (name: string, namespace: string, hosts: string, port: number, labels: string) {
    cy.exec(`kubectl delete Gateway ${name} -n ${namespace}`, { failOnNonZeroExit: false });
    cy.exec(`echo '${minimalGateway(name, namespace, hosts, port, labels)}' | kubectl apply -f -`);

    this.targetNamespace = namespace;
    this.targetGateway = name;
  }
);

Given(
  'there is a {string} Sidecar resource in the {string} namespace that captures egress traffic for hosts {string}',
  function (name: string, namespace: string, hosts: string) {
    cy.exec(`kubectl delete Sidecar ${name} -n ${namespace}`, { failOnNonZeroExit: false });
    cy.exec(`echo '${minimalSidecar(name, namespace, hosts)}' | kubectl apply -f -`);

    this.targetNamespace = namespace;
    this.targetSidecar = name;
  }
);

Given('the Sidecar is applied to workloads with {string} labels', function (labelsString: string) {
  cy.exec(
    `kubectl patch Sidecar ${this.targetSidecar} -n ${
      this.targetNamespace
    } --type=merge -p '{"spec":{"workloadSelector":{"labels": ${labelsStringToJson(labelsString)}}}}'`
  );
});

Given('the VirtualService applies to {string} hosts', function (hosts: string) {
  cy.exec(
    `kubectl patch VirtualService ${this.targetVirtualService} -n ${
      this.targetNamespace
    } --type=merge -p '{"spec":{"hosts": [${hosts
      .split(',')
      .map(h => `"${h}"`)
      .join(',')}]}}'`
  );
});

Given('the VirtualService references {string} gateways', function (gateway: string) {
  cy.exec(
    `kubectl patch VirtualService ${this.targetVirtualService} -n ${this.targetNamespace} --type=json -p '[{"op": "add", "path": "/spec/gateways", "value": ["${gateway}"]}]'`
  );
});

Given('the route of the VirtualService has weight {int}', function (weight: number) {
  cy.exec(
    `kubectl patch VirtualService ${this.targetVirtualService} -n ${this.targetNamespace} --type=json -p '[{"op": "add", "path": "/spec/http/0/route/0/weight", "value": ${weight}}]'`
  );
});

Given(
  'the http-route of the VirtualService also has a destination to host {string} and subset {string} with weight {int}',
  function (host: string, subset: string, weight: number) {
    cy.exec(
      `kubectl patch VirtualService ${this.targetVirtualService} -n ${this.targetNamespace} --type=json -p '[{"op": "add", "path": "/spec/http/0/route/-", "value": {"weight": ${weight}, "destination":{"host": "${host}", "subset": "${subset}"}} }]'`
    );
  }
);

When('the user refreshes the page', () => {
  cy.get('[data-test="refresh-button"]').click();

  ensureKialiFinishedLoading();
});

When('user filters for config {string}', (configName: string) => {
  cy.get('button#filter_select_value-toggle').click();
  cy.contains('div#filter_select_value button', configName).click();
});

Then('user sees all the Istio Config objects in the bookinfo namespace', () => {
  // There should be two Istio Config objects in the bookinfo namespace
  // represented by two rows in the table.
  cy.get('tbody').within(() => {
    // Bookinfo VS
    cy.get('tr').contains('bookinfo');

    // Bookinfo Gateway
    cy.get('tr').contains('bookinfo-gateway');
  });
});

Then('user sees all the Istio Config objects in the bookinfo namespace for the {string} cluster', (cluster: string) => {
  // Bookinfo Gateway
  cy.getBySel(`VirtualItem_Cluster${cluster}_Nsbookinfo_gateway_bookinfo-gateway`);

  // Bookinfo VS
  cy.getBySel(`VirtualItem_Cluster${cluster}_Nsbookinfo_virtualservice_bookinfo`);
});

Then('user sees Cluster information for Istio objects', () => {
  // Gateways
  cy.getBySel(`VirtualItem_Clustereast_Nsbookinfo_gateway_bookinfo-gateway`).contains(
    'td[data-label="Cluster"]',
    'east'
  );

  cy.getBySel(`VirtualItem_Clusterwest_Nsbookinfo_gateway_bookinfo-gateway`).contains(
    'td[data-label="Cluster"]',
    'west'
  );

  // VirtualServices
  cy.getBySel(`VirtualItem_Clustereast_Nsbookinfo_virtualservice_bookinfo`).contains(
    'td[data-label="Cluster"]',
    'east'
  );

  cy.getBySel(`VirtualItem_Clusterwest_Nsbookinfo_virtualservice_bookinfo`).contains(
    'td[data-label="Cluster"]',
    'west'
  );
});

Then('user sees Name information for Istio objects', () => {
  const object = 'bookinfo-gateway';

  // There should be a table with a heading for each piece of information.
  getColWithRowText(object, 'Name').within(() => {
    cy.get(`a[href*="/namespaces/bookinfo/istio/gateways/${object}"]`).should('be.visible');
  });
});

Then('user sees Namespace information for Istio objects', () => {
  const object = 'bookinfo-gateway';

  getColWithRowText(object, 'Namespace').contains('bookinfo');
});

Then('user sees Type information for Istio objects', () => {
  const object = 'bookinfo-gateway';

  getColWithRowText(object, 'Type').contains('Gateway');
});

Then('user sees Configuration information for Istio objects', () => {
  const object = 'bookinfo-gateway';

  // There should be a table with a heading for each piece of information.
  getColWithRowText(object, 'Configuration').within(() => {
    cy.get(`a[href*="/namespaces/bookinfo/istio/gateways/${object}"]`).should('be.visible');
  });
});

Then('the user filters by {string} for {string}', (filter: string, filterValue: string) => {
  cy.get('button#filter_select_type-toggle').click();
  cy.contains('div#filter_select_type button', filter).click();

  if (filter === 'Istio Name') {
    cy.get('input#filter_input_value').type(`${filterValue}{enter}`);
  } else if (filter === 'Type') {
    cy.get('input[placeholder="Filter by Type"]').type(`${filterValue}{enter}`);
    cy.get(`li[label="${filterValue}"]`).should('be.visible').find('button').click();
  } else if (filter === 'Istio Config Type') {
    cy.get('input[placeholder="Filter by Istio Config Type"]').type(`${filterValue}{enter}`);
    cy.get(`li[label="${filterValue}"]`).should('be.visible').find('button').click();
  } else if (filter === 'Config') {
    cy.get('button#filter_select_value-toggle').click();
    cy.contains('div#filter_select_value button', filterValue).click();
  } else if (filter === 'App Name') {
    cy.get('input#filter_input_value').type(`${filterValue}{enter}`);
  } else if (filter === 'Istio Sidecar') {
    cy.get('button#filter_select_value-toggle').click();
    cy.contains('div#filter_select_value button', filterValue).click();
  } else if (filter === 'Health') {
    cy.get('button#filter_select_value-toggle').click();
    cy.contains('div#filter_select_value button', filterValue).click();
  } else if (filter === 'Label') {
    cy.get('input#filter_input_label').type(`${filterValue}{enter}`);
  }
});

Then('user only sees {string}', (sees: string) => {
  cy.get('tbody').contains('tr', sees);

  cy.get('tbody').within(() => {
    cy.get('tr').should('have.length', 1);
  });
});

Then('only {string} are visible in the {string} namespace', (sees: string, ns: string) => {
  let lowercaseSees: string = sees.charAt(0).toLowerCase() + sees.slice(1);
  let count: number;

  cy.request('GET', `/api/namespaces/${ns}/istio?objects=${lowercaseSees}&validate=true`).then(response => {
    count = response.body[lowercaseSees].length;
  });

  cy.get('tbody').contains('tr', singularize(sees));
  cy.get('tbody').within(() => {
    cy.get('tr').should('have.length', count);
  });
});

Then('user sees {string}', (sees: string) => {
  cy.get('tbody').contains('tr', sees);
});

Then('the user can create a {string} Istio object', (object: string) => {
  cy.get('button[data-test="istio-actions-toggle"]').click();

  cy.getBySel('istio-actions-dropdown').within(() => {
    cy.contains(object).click();
  });

  const page = `/istio/new/${object}`;
  cy.url().should('include', page);
});

Then('the user can create a {string} K8s Istio object', (object: string) => {
  cy.request('GET', '/api/config').then(response => {
    expect(response.status).to.equal(200);
    const gatewayAPIEnabled = response.body.gatewayAPIEnabled;

    if (gatewayAPIEnabled) {
      cy.get('button[data-test="istio-actions-toggle"]').click();

      cy.getBySel('istio-actions-dropdown').within(() => {
        cy.contains(object).click();
      });

      const page = `/istio/new/${object}`;
      cy.url().should('include', page);
    } else {
      cy.get('button[data-test="istio-actions-toggle"]').click();

      cy.getBySel('istio-actions-dropdown').within(() => {
        cy.get(object).should('not.exist');
      });
    }
  });
});

Then('the AuthorizationPolicy should have a {string}', function (healthStatus: string) {
  cy.get(
    `[data-test=VirtualItem_Ns${this.targetNamespace}_authorizationpolicy_${this.targetAuthorizationPolicy}] span.pf-v5-c-icon`
  ).hasCssVar('color', `--pf-v5-global--${healthStatus}-color--100`);
});

function waitUntilConfigIsVisible(attempt: number, crdInstanceName: string, crdName: string, namespace: string):void {
  if (attempt === 0) {
    return;
  }
  cy.request('GET', `${Cypress.config('baseUrl')}/api/istio/config?refresh=0`);
  cy.get('[data-test="refresh-button"]').click();
  ensureKialiFinishedLoading();
  let found = false;
  cy.get('tr')
    .each($row => {
      console.log($row);
      const dataTestAttr = $row[0].attributes.getNamedItem('data-test');
      if (dataTestAttr !== null) {
        if (dataTestAttr.value === `VirtualItem_Ns${namespace}_${crdName.toLowerCase()}_${crdInstanceName}`) {
          found = true;
        }
      }
    })
    .then(() => {
      if (!found) {
        cy.wait(40000);
        waitUntilConfigIsVisible(attempt - 1, crdInstanceName, crdName, namespace);
      }
    });
}

Then(
  'the {string} {string} of the {string} namespace should have a {string}',
  (crdInstanceName: string, crdName: string, namespace: string, healthStatus: string) => {
    waitUntilConfigIsVisible(3, crdInstanceName, crdName, namespace);
    cy.get(`[data-test=VirtualItem_Ns${namespace}_${crdName.toLowerCase()}_${crdInstanceName}] span.pf-v5-c-icon`)
      .should('be.visible')
      .hasCssVar('color', `--pf-v5-global--${healthStatus}-color--100`);
  }
);

After({ tags: '@istio-config and @crd-validation' }, () => {
  cy.exec('kubectl delete PeerAuthentications,DestinationRules,AuthorizationPolicies,Sidecars --all --all-namespaces', {
    failOnNonZeroExit: false
  });

  cy.exec('kubectl delete Gateways,VirtualServices foo foo-route bar -n bookinfo', { failOnNonZeroExit: false });
  cy.exec('kubectl delete Gateways,VirtualServices foo foo-route bar -n sleep', { failOnNonZeroExit: false });
  cy.exec('kubectl delete Gateways,VirtualServices foo foo-route bar -n istio-system', { failOnNonZeroExit: false });
});

Then('user sees all the Istio Config toggles', () => {
  cy.get('[data-test="toggle-configuration"]').should('be.checked');
  colExists('Configuration', true);
});
