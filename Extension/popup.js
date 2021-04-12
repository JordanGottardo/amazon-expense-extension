const amazonOrderHistoryLast3MonthUrl = "https://www.amazon.it/gp/your-account/order-history?ref_=nav_orders_first"
const calculationStartedKey = "calculationStarted";
let xScale;
let yScale;
let height;
let width;
let g;
const margin = 200;

function startCalculation() {
    // window.open(
    // amazonOrderHistoryUrlBase + "year-2021",
    // "AMAZON-2021",
    // "height=1000,width=1000");
    let localStorageInitialValue = {
        "amazonExpenses": getYearlyExpensesStartingValues(),
        "calculationStarted": true
    };

    chrome.storage.local.clear(() => {
        chrome.storage.local.set(localStorageInitialValue, () => {
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

function getYearlyExpensesStartingValues() {
    let currentYear = new Date().getFullYear();
    let yearlyExpenses = {};

    for (let year = currentYear; year >= 2010; year--) {
        yearlyExpenses[year] = {
            "year": year,
            "totalExpense": 0,
            "reimbursement": 0
        };
    }

    return yearlyExpenses;
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
    var values = [28.63, 1026.05, 366.58, 634.7700000000001, 564.12, 310.22, 1024.82,
        3408.799999999998, 1339.9400000000005, 1154.9900000000002
    ];
    var years = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021];

    let data = values.map((value, index) => {
        return {
            year: years[index],
            value: value
        }
    });

    var svg = d3.select("svg");
    width = svg.attr("width") - margin,
        height = svg.attr("height") - margin;

    xScale = d3.scaleBand().range([0, width]).padding(0.4);
    yScale = d3.scaleLinear().range([height, 0]);
    xScale.domain(data.map(d => {
        return d.year;
    }));
    yScale.domain([0, d3.max(data, d => {
        return d.value;
    })]);

    g = svg.append("g")
        .attr("transform", "translate(" + 100 + "," + 100 + ")");

    g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale));

    g.append("g")
        .call(d3.axisLeft(yScale).tickFormat(d => {
            return "€" + d;
        }).ticks(10))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "-5.1em")
        .attr("text-anchor", "end")
        .attr("stroke", "black")
        .text("Stock Price");

    g.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .on("mouseover", onMouseOver)
        .on("mouseout", onMouseOut)
        .attr("x", d => {
            return xScale(d.year);
        })
        .attr("y", d => {
            return yScale(d.value);
        })
        .attr("width", xScale.bandwidth())
        .transition()
        .ease(d3.easeLinear)
        .duration(400)
        .delay((d, i) => {
            return i * 50;
        })
        .attr("height", d => {
            return height - yScale(d.value);
        });



    // var data = [100, 400, 300, 900, 850, 1000];

    // var scale = d3.scaleLinear()
    //     .domain([d3.min(data), d3.max(data)])
    //     .range([50, 400]);

    //     var width = 500,
    //     barHeight = 20,
    //     margin = 1;

    // var graph = d3.select("body")
    //     .append("svg")
    //     .attr("width", width)
    //     .attr("height", barHeight * data.length);

    // var bar = graph.selectAll("g")
    //     .data(data)
    //     .enter()
    //     .append("g")
    //     .attr("transform", function (d, i) {
    //         return "translate(0," + i * barHeight + ")";
    //     });

    // bar.append("rect")
    //     .attr("width", function (d) {
    //         return scale(d);
    //     })
    //     .attr("height", barHeight - margin)

    // bar.append("text")
    //     .attr("x", function (d) {
    //         return (scale(d));
    //     })
    //     .attr("y", barHeight / 2)
    //     .attr("dy", ".35em")
    //     .text(function (d) {
    //         return d;
    //     });

}

function onMouseOver(d, i) {
    console.log(d);
    console.log(d.value)
    console.log(i);
    d3.select(this).attr('class', 'highlight');
    d3.select(this)
        .transition()
        .duration(400)
        .attr('width', xScale.bandwidth() + 5)
        .attr("y", d => {
            return yScale(i.value) - 10;
        })
        .attr("height", d => {
            return height - yScale(i.value) + 10;
        });

    g.append("text")
        .attr('class', 'val')
        .attr('x', () => {
            return xScale(i.year);
        })
        .attr('y', () => {
            return yScale(i.value) - 15;
        })
        .text(() => {
            return ['€' + i.value];
        });
}

function onMouseOut(d, i) {
    d3.select(this).attr('class', 'bar');
    d3.select(this)
        .transition()
        .duration(400)
        .attr('width', xScale.bandwidth())
        .attr("y", d => {
            return yScale(i.value);
        })
        .attr("height", d => {
            return height - yScale(i.value);
        });

    d3.selectAll('.val')
        .remove()
}