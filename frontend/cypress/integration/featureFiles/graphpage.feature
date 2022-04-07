Feature: Kiali grpah page
This is set of smokes for regression on graph page
​
    Scenario Outline:: duration dropdown
        When user clicks duration dropdown
        Then user see values <duration>
​
        Examples:
            | enum            | duration |
            | LAST_MINUTE     | Last 1m  |
            | LAST_5_MINUTES  | Last 5m  |
            | LAST_10_MINUTES | Last 10m |
            | LAST_30_MINUTES | Last 30m |
            | LAST_HOUR       | Last 1h  |
            | LAST_3_HOURS    | Last 3h  |
            | LAST_6_HOURS    | Last 6h  |
            | LAST_12_HOURS   | Last 12h |
            | LAST_1_DAY      | Last 1d  |
            | LAST_7_DAYS     | Last 7d  |
​
​
    Scenario Outline:: refresh interval dropdown
        When user clicks refresh interval dropdown
        Then user see values <interval>
​
        Examples:
            | enum_interval | interval  |
            | PAUSE         | Pause     |
            | IN_10_SECONDS | Every 10s |
            | IN_15_SECONDS | Every 15s |
            | IN_30_SECONDS | Every 30s |
            | IN_1_MINUTE   | Every 1m  |
            | IN_5_MINUTES  | Every 5m  |
            | IN_15_MINUTES | Every 15m |
​
    Scenario: refresh interval dropdown
        When user clicks refresh interval dropdown
        Then user see values <interval>
​
    @Bookinfo_dependet @demoapp
    Scenario Outline:: select all types graph
        When user clciks App graph dropdown
        Then user see values <graphType>
​
            | grapEnum      | graphType           |
            | APP           | App graph           |
            | SERVICE       | Service graph       |
            | VERSIONED_APP | Versioned app graph |
            | WORKLOAD      | Workload graph      |
​
​
    Scenario Outline:: test filter
        When user clicks on Display dropdow
        Then user see <displayValues>
​
            | DisplayEnum          | displayValues        |
            | RESPONSE_TIME        | Response Time        |
            | THROUGHPUT           | Throughput           |
            | TRAFFIC_DISTRIBUTION | Traffic Distribution |
            | TRAFFIC_RATE         | Traffic Rate         |
            | CLUSTER_BOXES        | Cluster Boxes        |
            | NAMESPACE_BOXES      | Namespace Boxes      |
            | COMPRESSED_HIDE      | Compressed Hide      |
            | IDLE_EDGES           | Idle Edges           |
            | IDLE_NODES           | Idle Nodes           |
            | OPERATION_NODES      | Operation Nodes      |
            | RANK                 | Rank                 |
            | SERVICE_NODES        | Service Nodes        |
            | TRAFFIC_ANIMATION    | Traffic Animation    |
            | MISSING_SIDECARS     | Missing Sidecars     |
            | SECURITY             | Security             |
            | VIRTUAL_SERVICES     | Virtual Services     |
​
    Scenario: test Find search box
        When user select input #graph_find
        And user type 'version=v1'
        And user click cancel (cross) button
        Then #graph_find input is empty
​
    Scenario: test Hide search box
        When user select input #graph_hide
        And user type 'version=v1'
        And user click cancel (cross) button
        Then #graph_hide input is empty

     Scenario: test layout type 1
        When user click on #toolbar_layout_default
        Then user see first type of graph layout

    Scenario: test layout type 2
        When user click on #toolbar_layout1
        Then user see second type of graph layout

     Scenario: test layout type 3
        When user click on #toolbar_layout2
        Then user see third type of graph layout

    Scenario: test layout type 4
        When user click on #toolbar_layout3
        Then user see fourth type of graph layout
