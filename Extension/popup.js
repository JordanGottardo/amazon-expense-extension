const amazonOrderHistoryLast3MonthUrl = "https://www.amazon.it/gp/your-account/order-history?ref_=nav_orders_first"
const calculationStartedKey = "calculationStarted";
let xScale;
let yScale;
let height;
let width;
let g;
let keys;
const margin = 200;
const AMAZON_EXPENSES_KEY = "amazonExpenses";

function startCalculation() {
    let localStorageInitialValue = getStorageInitialValue();

    chrome.storage.local.clear(() => {
        chrome.storage.local.set(localStorageInitialValue, () => {
            openFirstAmazonPage();
        });
    });
}

function getStorageInitialValue(calculateOnlyCurrentYear = false) {
    return {
        "amazonExpenses": getYearlyExpensesStartingValues(),
        "calculationStarted": true,
        "calculateOnlyCurrentYear": calculateOnlyCurrentYear
    };
}

function resetAll() {
    chrome.storage.local.clear();
    document.querySelector("#graphContainer").textContent = "";
    showIncompleteParsingError();
}

function startCalculationOnlyForCurrentYear() {
    let currentYear = getCurrentYear();
    let currentYearStartingValues = {
        "year": currentYear,
        "totalExpense": 0,
        "reimbursement": 0
    };

    chrome.storage.local.get(null, storage => {
        if (storage && !isObjectEmpty(storage)) {
            storage.amazonExpenses[currentYear] = currentYearStartingValues;
            storage.calculationStarted = true;
            storage.calculateOnlyCurrentYear = true;
        } else {
            storage = getStorageInitialValue(true);
        }

        chrome.storage.local.set(storage, () => {
            chrome.storage.local.get(null, newStorage => {
                openFirstAmazonPage();
            })
        })
    });


}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.calculationStarted && changes.calculationStarted.newValue === false) {
        parseAmazonExpensesAndPrintChart();
    }
});

function parseAmazonExpensesAndPrintChart() {
    hideIncompleteParsingError();
    chrome.storage.local.get("amazonExpenses", amazonExpenses => {
        let amazonExpensesObject = amazonExpenses[AMAZON_EXPENSES_KEY];
        let years = Object.getOwnPropertyNames(amazonExpensesObject);
        let totalExpenses = [];
        let reimbursements = [];
        years.forEach(year => {
            totalExpenses.push(amazonExpensesObject[year].totalExpense);
            reimbursements.push(amazonExpensesObject[year].reimbursement);
        });

        printExpensesBarChart(years, totalExpenses, reimbursements)
    });
}

function getCurrentYear() {
    return new Date().getFullYear();
}

function getYearlyExpensesStartingValues() {
    let currentYear = getCurrentYear();
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

window.onload = function () {
    document.getElementById("startButton").onclick = startCalculation;
    document.getElementById("currentYearButton").onclick = startCalculationOnlyForCurrentYear;
    document.getElementById("resetButton").onclick = resetAll;

    chrome.storage.local.get("amazonExpenses", amazonExpenses => {
        if (amazonExpenses["amazonExpenses"] && !amazonExpenses.calculationStarted) {
            parseAmazonExpensesAndPrintChart();
        } else {
            showIncompleteParsingError();
        }
    });
}

function printExpensesBarChart(years, totalExpenses, reimbursements) {
    keys = ["totalExpense", "reimbursement"];
    legendText = {
        totalExpense: "Spesa tot.",
        reimbursement: "Rimborso"
    }

    let data = totalExpenses.map((totalExpense, index) => {
        return {
            year: years[index],
            totalExpense: roundToTwoDecimal(totalExpense),
            reimbursement: roundToTwoDecimal(reimbursements[index])
        }
    });

    var svg = d3.select("svg");

    let totalMargin = 200;
    width = svg.attr("width") - totalMargin;
    height = svg.attr("height") - totalMargin;

    xScale = d3.scaleBand()
        .domain(data.map(d => d.year))
        .range([0, width])
        .paddingInner(0.1)

    let x1Scale = d3.scaleBand()
        .domain(keys)
        .rangeRound([0, xScale.bandwidth()])
        .padding(0.05)

    yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d3.max(keys, key => d[key]))]).nice()
        .range([height, 0]);

    let color = d3.scaleOrdinal()
        .range(["#98abc5", "#8a89a6"]);

    g = svg.append("g")
        .attr("transform", "translate(" + 80 + "," + 50 + ")");

    g.append("g")
        .selectAll("g")
        .data(data)
        .join("g")
        .attr("transform", d => `translate(${xScale(d.year)},0)`)
        .selectAll("rect")
        .data(d => keys.map(key => ({
            key,
            year: d.year,
            totalExpense: d[key]
        })))
        .join("rect")
        .attr("class", "bar")
        .on("mouseover", onMouseOver)
        .on("mouseout", onMouseOut)
        .attr("x", d => x1Scale(d.key))
        .attr("y", d => yScale(d.totalExpense))
        .attr("width", x1Scale.bandwidth())
        .transition()
        .ease(d3.easeLinear)
        .duration(400)
        .delay((d, i) => {
            return i * 50;
        })
        .attr("height", d => yScale(0) - yScale(d.totalExpense))
        .attr("fill", d => color(d.key));

    g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale))
        .append("text")
        .attr("class", "axisText")
        .attr("x", 200)
        .attr("dy", "3em")
        .attr("text-anchor", "middle")
        .text("Anno");;

    g.append("g")
        .call(d3.axisLeft(yScale).tickFormat(d => {
            return "€" + d3.format(",")(d).replace(",", ".");
        }).ticks(10))
        .append("text")
        .attr("class", "axisText")
        .attr("transform", "translate(0, 100) rotate(-90)")
        .attr("y", 6)
        .attr("dy", "-5.1em")
        .attr("text-anchor", "end")
        .text("Spese / Rimborsi");

    let legendContainer = g.append("g")
        .attr("transform", `translate(${width + 80},0)`)
        .attr("text-anchor", "end")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .selectAll("g")
        .data(color.domain().slice().reverse())
        .join("g")
        .attr("transform", (d, i) => `translate(0,${i * 20})`);

    legendContainer.append("rect")
        .attr("x", -19)
        .attr("width", 19)
        .attr("height", 19)
        .attr("fill", color);

    legendContainer.append("text")
        .attr("x", -24)
        .attr("y", 9.5)
        .attr("dy", "0.35em")
        .text(d => legendText[d]);
}

function onMouseOver(d, i) {
    let indexOfKey = keys.indexOf(i.key);
    let width = getWidthOfElementWithClass("bar");

    d3.select(this).attr('class', 'highlight');
    d3.select(this)
        .transition()
        .duration(400)
        .attr('width', width + 5)
        .attr("y", d => {
            return yScale(i.totalExpense) - 10;
        })
        .attr("height", d => {
            return height - yScale(i.totalExpense) + 10;
        });

    g.append("text")
        .attr('class', 'val')
        .attr('x', () => {
            return xScale(i.year) + width * indexOfKey;
        })
        .attr('y', () => {
            return yScale(i.totalExpense) - 15;
        })
        .text(() => {
            return ['€' + i.totalExpense];
        });
}

function onMouseOut(d, i) {
    d3.select(this).attr('class', 'bar');
    d3.select(this)
        .transition()
        .duration(400)
        .attr('width', getWidthOfElementWithClass("bar"))
        .attr("y", d => {
            return yScale(i.totalExpense);
        })
        .attr("height", d => {
            return height - yScale(i.totalExpense);
        });

    d3.selectAll('.val')
        .remove()
}

function getWidthOfElementWithClass(className) {
    return d3.select("." + className)
        .node()
        .getBBox()
        .width;
}

function roundToTwoDecimal(num) {
    return Math.round(num * 100) / 100
}

function showIncompleteParsingError() {
    document.querySelector("#parsingNotCompleted").classList.remove("hidden");
}

function hideIncompleteParsingError() {
    document.querySelector("#parsingNotCompleted").classList.add("hidden");
}

function isObjectEmpty(obj) {
    return Object.keys(obj).length === 0;
}

function openFirstAmazonPage() {
    chrome.windows.create({
        "url": amazonOrderHistoryLast3MonthUrl
    })
}