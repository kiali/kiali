describe('graphload', () => {

    http://localhost:3000/console/graph/namespaces/
        // ?traffic=grpc%2CgrpcRequest%2Chttp%2ChttpRequest%2Ctcp%2CtcpSent
        // &graphType=versionedApp
        // &namespaces=bookinfo%2Ccert-manager
        // &duration=60
        // &refresh=15000
        // &layout=kiali-dagre
        // &namespaceLayout=kiali-dagre

    var graphUrl;

    before(() => {
        cy.fixture('graphParams')
            .then(function (data) {
                graphUrl = encodeURI("/console/graph/namespaces?traffic="+data.traffic
                    +"&graphType="+data.graphType
                    +"&namespaces="+data.namespaces
                    +"&duration="+data.duration
                    +"&refresh="+data.refresh
                    +"&layout="+data.layout
                    +"&namespaceLayout="+data.namespaceLayout);
            })
            .as('data');
    })

    it('Visit Main Page', () => {
        cy.visit("/", {
            onBeforeLoad(win) {
                win.performance.mark("start");
            }
        })
        .its("performance").then((performance) => {

            cy.get(".pf-l-grid").should('be.visible')
                .then(() => {
                    performance.mark("end")
                    performance.measure("initPageLoad", "start", "end");
                    const measure = performance.getEntriesByName("initPageLoad")[0];
                    const duration = measure.duration;
                    assert.isAtMost(duration, Cypress.config('threshold'));

                    cy.writeFile('logs/performance.txt', `[PERFORMANCE] Init page load time: \n ${duration / 1000} seconds\n`)
                })
        })
    })

    it('Measure Graph load time', {
            defaultCommandTimeout: Cypress.config('timeout')
    }, () => {
        cy.intercept(`**/api/namespaces/graph*`).as('graphNamespaces');
        cy.visit(graphUrl, {
            onBeforeLoad(win) {
                win.performance.mark("start");
            }
        })
        .its("performance").then((performance) => {
            cy.wait('@graphNamespaces')
            //cy.get('#loading_kiali_spinner').should('not.exist')
            cy.get("#cy", { timeout: 10000 }).should('be.visible')
                .then(() => {
                    performance.mark("end")
                    performance.measure("pageLoad", "start", "end");
                    const measure = performance.getEntriesByName("pageLoad")[0];
                    const duration = measure.duration;
                    assert.isAtMost(duration, Cypress.config('threshold'));

                    cy.writeFile('logs/performance.txt', `[PERFORMANCE] Graph load time for ${graphUrl}: \n ${duration / 1000} seconds\n`, { flag: 'a+' })
                })

        })
    })
})