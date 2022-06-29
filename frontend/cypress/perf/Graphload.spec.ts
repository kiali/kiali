describe('graphload', () => {

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

        cy.login("ibmcloud", Cypress.env('USERNAME'), Cypress.env('PASSWD'));
    })

    beforeEach(() => {
        Cypress.Cookies.preserveOnce('kiali-token-aes');
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
                    assert.isAtMost(duration, Cypress.env('threshold'));

                    cy.writeFile('logs/performance.txt', `[PERFORMANCE] Init page load time: \n ${duration / 1000} seconds\n`)
                })
        })
    })

    it('Measure Graph load time', {
            defaultCommandTimeout: Cypress.env('timeout')
    }, () => {
        cy.intercept(`**/api/namespaces/graph*`).as('graphNamespaces');
        cy.visit(graphUrl, {
            onBeforeLoad(win) {
                win.performance.mark("start");
            }
        })
        .its("performance").then((performance) => {
            cy.wait('@graphNamespaces')

            cy.get("#cy", { timeout: 10000 }).should('be.visible')
                .then(() => {
                    performance.mark("end")
                    performance.measure("pageLoad", "start", "end");
                    const measure = performance.getEntriesByName("pageLoad")[0];
                    const duration = measure.duration;
                    assert.isAtMost(duration, Cypress.env('threshold'));

                    cy.writeFile('logs/performance.txt', `[PERFORMANCE] Graph load time for ${graphUrl}: \n ${duration / 1000} seconds\n`, { flag: 'a+' })
                })

        })
    })
})