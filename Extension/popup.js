const amazonOrderHistoryLast3MonthUrl = "https://www.amazon.it/gp/your-account/order-history?ref_=nav_orders_first"
const calculationStartedKey = "calculationStarted";

function startCalculation() {
    // window.open(
    // amazonOrderHistoryUrlBase + "year-2021",
    // "AMAZON-2021",
    // "height=1000,width=1000");

    chrome.storage.local.clear(() => {
        chrome.storage.local.set({
            "calculationStarted": true
        }, () => {
            chrome.storage.local.get(null, storage => {
                console.log("initial storage");
                console.log(storage);
            });
            chrome.windows.create({
                "url": amazonOrderHistoryLast3MonthUrl
            });
        });
    });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.calculationStarted && changes.calculationStarted.newValue === false) {
        printGraph();
    }
});


function printGraph() {
    console.log("Starting to print graph");
    chrome.storage.local.get(null, value => {
        console.log("LocalStorage value");
        console.log(value);

        console.log(d3.select("#graph"));
    });
}

// function b1() {
//     chrome.storage.local.set({
//         "calculationStarted": true
//     });
// }

// function b2() {
//     chrome.storage.local.set({
//         "calculationStarted": false
//     });
// }

// function bGet() {
//     chrome.storage.local.get("calculationStarted", value => {
//         console.log("LocalStorage calculation started");
//         console.log(value.calculationStarted);
//     });
// }

window.onload = function () {
    document.getElementById("startButton").onclick = startCalculation;
    
    // basic example: to be removed
    var data = [5, 10, 12];
    var width = 200,
        scaleFactor = 10,
        barHeight = 20;

    var graph = d3.select("body")
        .append("svg")
        .attr("width", width)
        .attr("height", barHeight * data.length);

    var bar = graph.selectAll("g")
        .data(data)
        .enter()
        .append("g")
        .attr("transform", function (d, i) {
            return "translate(0," + i * barHeight + ")";
        });

    bar.append("rect")
        .attr("width", function (d) {
            return d * scaleFactor;
        })
        .attr("height", barHeight - 1);

    bar.append("text")
        .attr("x", function (d) {
            return (d * scaleFactor);
        })
        .attr("y", barHeight / 2)
        .attr("dy", ".35em")
        .text(function (d) {
            return d;
        });

}