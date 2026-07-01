import { colSelectors, netflowPage, overviewSelectors, topologySelectors, viewSelectors } from "@views/netflow-page"
import { Operator } from "@views/netobserv"

// Expected panels per view (text visible in overview panel titles)
const pktDropPanels = [
    'Top 5 average dropped packets rates',
    'Top 5 dropped packets rates stacked with total',
    'Top 5 packet dropped state stacked with total',
    'Top 5 packet dropped cause stacked with total',
    'Top 5 average dropped bytes rates',
    'Top 5 dropped bytes rates stacked with total'
]

const dnsPanels = [
    'Top 5 average DNS latencies with overall',
    'Top 5 90th percentile DNS latencies',
    'Top 5 99th percentile DNS latencies',
    'Top 5 maximum DNS latencies',
    'Top 5 DNS name',
    'Top 5 DNS response code'
]

const rttPanels = [
    'Top 5 average TCP smoothed Round Trip Time with overall',
    'Top 5 90th percentile TCP smoothed Round Trip Time',
    'Top 5 99th percentile TCP smoothed Round Trip Time',
    'Top 5 maximum TCP smoothed Round Trip Time',
    'Bottom 5 minimum TCP smoothed Round Trip Time'
]

const tlsPanels = [
    'TLS usage',
    'TLS usage per version',
    'TLS usage per group',
    'TLS usage per cipher suite'
]

describe('(OCP-XXXXX) Views selector tests', { tags: ['Network_Observability'] }, function () {

    before('any test', function () {
        cy.adminCLI(`oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
        cy.uiLogin(Cypress.env('LOGIN_IDP'), Cypress.env('LOGIN_USERNAME'), Cypress.env('LOGIN_PASSWORD'))

        Operator.install()
        cy.checkStorageClass(this)
        Operator.createFlowcollector("AllFeatures")
    })

    beforeEach('view selector test', function () {
        netflowPage.visit()
        netflowPage.waitForLokiQuery()
    })

    it("(OCP-XXXXX, memodi) should display view selector with all feature views", { tags: ['@netobserv-critical'] }, function () {
        // Verify view selector is visible
        cy.get(viewSelectors.container).should('exist')
        cy.get(viewSelectors.dropdown).should('exist')

        // Default view should be "All Traffic"
        cy.get(viewSelectors.dropdown).should('contain.text', 'All Traffic')

        // Open dropdown and verify all views are present
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).should('exist')
        cy.get(viewSelectors.packetDrops).should('exist')
        cy.get(viewSelectors.dnsLatency).should('exist')
        cy.get(viewSelectors.flowRTT).should('exist')
        cy.get(viewSelectors.tlsTracking).should('exist')
        cy.get(viewSelectors.udnMapping).should('exist')
        cy.get(viewSelectors.networkEvents).should('exist')
        cy.get(viewSelectors.packetTranslation).should('exist')

        // Close dropdown
        cy.get(viewSelectors.dropdown).click()
    })

    it("(OCP-XXXXX, memodi) should show feature-specific panels when view is selected", function () {
        // Select Packet Drops view and verify panels
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        netflowPage.waitForLokiQuery()
        cy.get(viewSelectors.dropdown).should('contain.text', 'Packet Drops')
        cy.checkPanel(pktDropPanels)

        // Select DNS Latency view and verify panels
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()
        netflowPage.waitForLokiQuery()
        cy.get(viewSelectors.dropdown).should('contain.text', 'DNS Latency')
        cy.checkPanel(dnsPanels)

        // Select Flow RTT view and verify panels
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.flowRTT).click()
        netflowPage.waitForLokiQuery()
        cy.get(viewSelectors.dropdown).should('contain.text', 'Flow RTT')
        cy.checkPanel(rttPanels)

        // Select TLS Tracking view and verify panels
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.tlsTracking).click()
        netflowPage.waitForLokiQuery()
        cy.get(viewSelectors.dropdown).should('contain.text', 'TLS Tracking')
        cy.checkPanel(tlsPanels)

        // Return to All Traffic and verify base panels
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()
        netflowPage.waitForLokiQuery()
        cy.get(viewSelectors.dropdown).should('contain.text', 'All Traffic')
        cy.checkPanel(overviewSelectors.defaultPanels)
    })

    it("(OCP-XXXXX, memodi) should show feature-specific columns when view is selected", function () {
        // Switch to Traffic flows tab
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        netflowPage.stopAutoRefresh()

        // Select Packet Drops view and verify columns
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.bytes).should('exist')
            cy.get(colSelectors.packets).should('exist')
            // Drop-specific columns
            cy.get('[data-label="Dropped Bytes"]').should('exist')
            cy.get('[data-label="Dropped Packets"]').should('exist')
        })

        // Select DNS Latency view and verify columns
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.dnsLatency).should('exist')
            cy.get(colSelectors.dnsResponseCode).should('exist')
        })

        // Select Flow RTT view and verify columns
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.flowRTT).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.flowRTT).should('exist')
        })

        // Select TLS Tracking view and verify columns
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.tlsTracking).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.tlsVersion).should('exist')
        })

        // Return to All Traffic — feature columns should NOT be visible (default: false)
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            // Base columns should exist
            cy.get(colSelectors.srcNS).should('exist')
            cy.get(colSelectors.protocol).should('exist')
            // Feature columns should not be visible in All Traffic
            cy.get(colSelectors.dnsLatency).should('not.exist')
            cy.get(colSelectors.flowRTT).should('not.exist')
            cy.get(colSelectors.tlsVersion).should('not.exist')
        })
    })

    it("(OCP-XXXXX, memodi) should persist custom column additions across views", function () {
        // Switch to Traffic flows tab
        cy.get('#tabs-container').contains('Traffic flows').click()
        cy.byTestID("table-composable").should('exist')
        netflowPage.stopAutoRefresh()

        // Select DNS Latency view
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.dnsLatency).click()

        // Add a non-default column (Flow RTT) while on DNS view
        cy.openColumnsModal()
        cy.get(colSelectors.columnsModal).should('be.visible')
        cy.get(colSelectors.flowRTT).check()
        cy.byTestID(colSelectors.save).click()

        // Verify RTT column is visible alongside DNS columns
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.dnsLatency).should('exist')
            cy.get(colSelectors.flowRTT).should('exist')
        })

        // Switch to Packet Drops view — custom RTT column should persist
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.packetDrops).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.flowRTT).should('exist')
        })

        // Switch to All Traffic — custom RTT column should persist
        cy.get(viewSelectors.dropdown).click()
        cy.get(viewSelectors.allTraffic).click()
        cy.byTestID('table-composable').should('exist').within(() => {
            cy.get(colSelectors.flowRTT).should('exist')
        })

        // Clean up: remove the added column
        cy.openColumnsModal()
        cy.get(colSelectors.columnsModal).should('be.visible')
        cy.get(colSelectors.flowRTT).uncheck()
        cy.byTestID(colSelectors.save).click()
    })

    afterEach("test", function () {
        netflowPage.resetClearFilters()
    })

    after("all tests", function () {
        Operator.deleteFlowCollector()
        cy.adminCLI(`oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`)
    })
})
