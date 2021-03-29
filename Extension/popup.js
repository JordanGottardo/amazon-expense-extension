const amazonOrderHistoryLast3MonthUrl = "https://www.amazon.it/gp/your-account/order-history?ref_=nav_orders_first"
const calculationStartedKey = "calculationStarted";

function startCalculation() {
    // window.open(
    // amazonOrderHistoryUrlBase + "year-2021",
    // "AMAZON-2021",
    // "height=1000,width=1000");

    let localStorageKeysToRemove = [...getYearsKeys(), calculationStartedKey];
    console.log(localStorageKeysToRemove);

    chrome.storage.local.remove(localStorageKeysToRemove, () => {
        chrome.storage.local.set({
            "calculationStarted": true
        }, () => {
            chrome.windows.create({
                "url": amazonOrderHistoryLast3MonthUrl
            });
        });
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
    // document.getElementById("b1").onclick = b1;
    // document.getElementById("b2").onclick = b2;
    // document.getElementById("bGet").onclick = bGet;
}

function getYearsKeys() {
    let yearsKeys = [];
    let currentYear = new Date().getFullYear();

    for (let year = currentYear; year >= 2010; year--) {
        yearsKeys.push(year.toString());
    }

    return yearsKeys;
}