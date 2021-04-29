console.log("From background");

const AMAZON_URL_BASE = "https://www.amazon.it";
const AMAZON_ORDER_PAGE_BY_YEAR_URL_BASE = "https://www.amazon.it/gp/your-account/order-history?opt=ab&digitalOrders=1&unifiedOrders=1&returnTo=&__mk_it_IT=%C3%85M%C3%85%C5%BD%C3%95%C3%91&orderFilter=year-";
const AMAZON_ORDER_HISTORY_LAST_3_MONTH_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/your-account\/order-history?.*nav_orders_first/;
const AMAZON_ORDER_HISTORY_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/your-account\/order-history?.*orderFilter/;
const AMAZON_ORDER_DETAILS_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/your\-account\/order\-details.*/;
const AMAZON_ORDER_SUMMARY_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/digital\/your\-account\/order\-summary.*/; // for orders such as audiobooks
const ORDER_URL_REGEX = /\/gp.*/;
const CURRENCY_REGEX = /\d*,\d*/g;
const SEND_DOM_MESSAGE = "SendDomToBackground";
const AMAZON_EXPENSES_OBJECT_KEY = "amazonExpenses";

let activeTabId = 0;
let orderDetailsLinks;
let currentOrderPage = 1;
let currentWindowId;
let orderPagesLinks;
let orderWindowId;
let last3MonthsOrderWindowId;
let currentlyProcessedYear;

let ordersByYearPageUrls = [];
let parsedOrderDetailsLinkCount = 0;
let openedOrderDetailsWindows = [];
let finishedParsingOrderDetails = false;
let currentOrdersByYearPageIndex = undefined;

chrome.windows.onFocusChanged.addListener(windowId => {
    if (windowId != -1) {
        console.log("focus changed currentWindow= " + windowId + " orderWindowId= " + orderWindowId + " last3MonthsOrderWindowId = " + last3MonthsOrderWindowId);

        chrome.tabs.query({
            active: true,
            windowId: windowId
        }, tabs => {
            let tabUrl = tabs[0].url;
            console.log("Active tab url is: " + tabs[0].url);
            let isMainOrderWindow = windowId == orderWindowId;
            let areThereOrderPagesLeft = currentOrderPage < orderPagesLinks.length;

            console.log("IsMainOrderWindow = " + isMainOrderWindow +
                " last3MonthsOrderWindowId = " + last3MonthsOrderWindowId +
                " finishedParsingOrderDetails = " + finishedParsingOrderDetails +
                " areThereOrderPagesLeft = " + areThereOrderPagesLeft +
                " orderPagesLink = " + orderPagesLinks);
            ifCalculationIsStarted(tabUrl, () => {

                if (windowId === last3MonthsOrderWindowId && currentOrdersByYearPageIndex >= ordersByYearPageUrls.length - 1) { // ritorno alla pagina last3Months e ho finito tutto
                    console.log("Finished everything");
                    setValueToLocalStorage("calculationStarted", false);
                    CloseWindow(windowId);
                } else if (windowId === last3MonthsOrderWindowId && currentOrdersByYearPageIndex < ordersByYearPageUrls.length - 1) { //ritorno alla pagina last3Months e non ho finito
                    currentOrdersByYearPageIndex++;
                    console.log("Creating new orderByYears page for index " + currentOrdersByYearPageIndex + " url " + JSON.stringify(ordersByYearPageUrls[currentOrdersByYearPageIndex]));
                    currentlyProcessedYear = ordersByYearPageUrls[currentOrdersByYearPageIndex].year;
                    orderWindowId = undefined;
                    CreateNewWindowFromExactUrl(ordersByYearPageUrls[currentOrdersByYearPageIndex].url);
                } else if (windowId === orderWindowId &&
                    finishedParsingOrderDetails &&
                    currentOrderPage < orderPagesLinks.length) { // ritorno alla pagina di un singolo anno e ho ancora pagine da aprire
                    console.log("ritorno alla pagina di un singolo anno e ho ancora pagine da aprire");
                    finishedParsingOrderDetails = false;
                    console.log("Opening page at index " + currentOrderPage);
                    CreateNewWindow(orderPagesLinks[currentOrderPage].href);
                    currentOrderPage++;
                } else if (windowId === orderWindowId && finishedParsingOrderDetails && (!orderPagesLinks || orderPagesLinks.length === 0 || currentOrderPage === orderPagesLinks.length)) { // // ritorno alla pagina di un singolo anno e ho finito le pagine
                    console.log("ritorno alla pagina di un singolo anno e ho finito le pagine");
                    finishedParsingOrderDetails = false;
                    currentOrderPage = 1;
                    CloseWindow(windowId);
                } else if (windowId != orderWindowId && finishedParsingOrderDetails) { // sono su una pagina di dettaglio ordine e ho finito la pagina di un anno
                    console.log("Closing page at index " + currentOrderPage)
                    CloseWindow(windowId);
                }
            });
        });
    }
});

// chrome.tabs.onActivated.addListener(activeInfo => {
//     chrome.storage.local.get("calculationStarted", value => {
//         console.log("LocalStorage calculation started");
//         console.log(value.calculationStarted);
//     });
// })

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

    ifCalculationIsStarted(tab.url, () => {
        console.log("Tab URL = " + tab.url);
        let isCurrentPageOrderHistory = IsCurrentPageOrderHistoryPage(tab.url);
        let isCurrentPageOrderDetails = IsCurrentPageOrderDetailsPage(tab.url);
        let isCurrentPageOrderHistoryLast3Month = IsCurrentPageLast3MonthsOrderPage(tab.url);
        let isCurrentPageOrderSummary = IsCurrentPageOrderSummaryPage(tab.url);
        if ((isCurrentPageOrderHistory || isCurrentPageOrderDetails || isCurrentPageOrderHistoryLast3Month || isCurrentPageOrderSummary) &&
            changeInfo.status === "complete") {
            currentWindowId = tab.windowId;

            console.log("onUpdated");
            if (isCurrentPageOrderHistoryLast3Month) {
                console.log("In last 3 month page: initializing order years urls");
                initializeOrdersByYearUrls(() => {
                    console.log("years");
                    console.log(ordersByYearPageUrls);
                    last3MonthsOrderWindowId = tab.windowId;
                    currentlyProcessedYear = ordersByYearPageUrls[0].year;
                    CreateNewWindow(ordersByYearPageUrls[0].url);
                });
            } else {
                let responseCallback = undefined;
                if (isCurrentPageOrderHistory) {
                    responseCallback = processOrderHistoryPageDom;
                } else if (isCurrentPageOrderDetails || isCurrentPageOrderSummary) {
                    responseCallback = processOrderDetailPageDom;
                }
                injectForegroundScript(() => sendMessage(tab.id, SEND_DOM_MESSAGE, responseCallback));
            }
        }
    });
});

function initializeOrdersByYearUrls(callback) {
    getValueFromLocalStorage("calculateOnlyCurrentYear", onlyCurrentYear => {
        let currentYear = new Date().getFullYear();
        let firstYear = 2010;

        if (onlyCurrentYear) {
            console.log("Calculating only current year")
            firstYear = currentYear;
        }
        for (let year = currentYear; year >= firstYear; year--) {
            ordersByYearPageUrls.push({
                year: year,
                url: AMAZON_ORDER_PAGE_BY_YEAR_URL_BASE + year.toString()
            });
            currentOrdersByYearPageIndex = 0;
        }
        callback();
    });
}

function processOrderHistoryPageDom(domContent) {
    console.log("Processing order history page DOM");

    let doc = GetDocumentFromDomContent(domContent);
    orderDetailsLinks = doc.querySelectorAll(".a-unordered-list.a-nostyle.a-vertical > a");

    if (!orderWindowId) {
        orderPagesLinks = GetOrderPagesLinks(doc);
        orderWindowId = currentWindowId;
        currentOrderPage = 1;
    }

    if (orderDetailsLinks.length === 0) {
        finishedParsingOrderDetails = true;
        CloseWindow(currentWindowId);
    } else {
        parsedOrderDetailsLinkCount = 1;
        CreateNewOrderDetailsWindow(orderDetailsLinks[0]);
    }
}

function processOrderDetailPageDom(domContent) {
    console.log("Processing order detail page DOM");
    let doc = GetDocumentFromDomContent(domContent);

    let orderSummary = doc.querySelectorAll("#od-subtotals > div");
    let orderSummaryArray = Array.from(orderSummary).reverse();

    let indexOfTotalRow = GetIndex(orderSummaryArray, "Totale:");
    let indexOfImportoBuonoRegalo = GetIndex(orderSummaryArray, "Importo Buono Regalo:");
    let indexOfScontiApplicati = GetIndex(orderSummaryArray, "Sconti applicati:");
    let indexOfTotaleRimborso = GetIndex(orderSummaryArray, "Totale rimborso");

    let totalValue = GetValueOfElementAtIndex(orderSummaryArray, indexOfTotalRow)
    let buonoRegaloValue = GetValueOfElementAtIndex(orderSummaryArray, indexOfImportoBuonoRegalo)
    let totaleRimborsoValue = GetValueOfElementAtIndex(orderSummaryArray, indexOfTotaleRimborso)
    let totalOrderValue = totalValue + buonoRegaloValue - totaleRimborsoValue;
    console.log(currentlyProcessedYear);
    console.log(totalOrderValue);
    addOrderValuesToLocalStorage(currentlyProcessedYear, totalOrderValue, totaleRimborsoValue, () => {
        console.log("TotalOrderValue = " + totalOrderValue);
        if (parsedOrderDetailsLinkCount < orderDetailsLinks.length) {
            let nextUrl = orderDetailsLinks[parsedOrderDetailsLinkCount];
            console.log("Opening new window for single order detail");
            parsedOrderDetailsLinkCount++;
            CreateNewOrderDetailsWindow(nextUrl);
        } else {
            console.log("Closing all windows");
            finishedParsingOrderDetails = true;
            CloseAllWindows(openedOrderDetailsWindows);
        }
    });
}

// function sumCurrencies(values) {
//     values.forEach(value => {
//         let splitValues = value.toString.split(".");

//     })
// }

function ifCalculationIsStarted(currentUrl, callback) {
    if (!isCurrentUrlAmazon(currentUrl)) {
        console.log("Current page is not amazon");
        return;
    }

    getValueFromLocalStorage("calculationStarted", calculationStarted => {
        if (calculationStarted) {
            callback();
        }
    })
}

function isCurrentUrlAmazon(currentUrl) {
    return IsCurrentPageOrderHistoryPage(currentUrl) ||
        IsCurrentPageOrderDetailsPage(currentUrl) ||
        IsCurrentPageLast3MonthsOrderPage(currentUrl) ||
        IsCurrentPageOrderSummaryPage(currentUrl);
}

function getValueFromLocalStorage(key, callback) {
    // console.log("getValueFromLocalStorage key= " + key);
    chrome.storage.local.get(key, value => {
        // console.log("getLocalStorage value= ");
        console.log(value);
        callback(value[key]);
    })
}

function setValueToLocalStorage(key, value, callback) {
    let obj = {};
    obj[key] = value;

    chrome.storage.local.set(obj, callback);
}


function addOrderValuesToLocalStorage(year, orderValue, reimbursementValue, callback) {
    // console.log("addOrSetValueToLocalStorage key = " + key + " value = " + value);
    getValueFromLocalStorage(AMAZON_EXPENSES_OBJECT_KEY, oldVal => {
        oldVal[year].totalExpense = oldVal[year].totalExpense + orderValue;
        oldVal[year].reimbursement = oldVal[year].reimbursement + reimbursementValue;

        // console.log("Oldvalue found , adding to " + key + " oldVal= " + oldVal + " + value= " + value);

        setValueToLocalStorage(AMAZON_EXPENSES_OBJECT_KEY, oldVal, () => {
            chrome.storage.local.get(null, value => {
                console.log("LocalStorage all= ");
                console.log(value);
                callback();
            });
        });

    });
}

function isObjectEmpty(obj) {
    return Object.keys(obj).length === 0;
}

function GetOrderPagesLinks(doc) {
    let pagesElements = Array.from(doc.querySelectorAll("#ordersContainer > .a-row li a"));
    pagesElements.pop();

    return pagesElements;
}

function IsCurrentPageOrderHistoryPage(url) {
    return AMAZON_ORDER_HISTORY_URL_REGEX.test(url);
}

function IsCurrentPageOrderDetailsPage(url) {
    return AMAZON_ORDER_DETAILS_URL_REGEX.test(url);
}

function IsCurrentPageLast3MonthsOrderPage(url) {
    return AMAZON_ORDER_HISTORY_LAST_3_MONTH_URL_REGEX.test(url);
}

function IsCurrentPageOrderSummaryPage(url) {
    return AMAZON_ORDER_SUMMARY_URL_REGEX.test(url);
}

function CreateNewOrderDetailsWindow(link) {
    CreateNewWindow(link, AddWindowToOpenedOrderDetailsWindows);
}

function GetIndex(orderSummaryArray, innerText) {
    return orderSummaryArray
        .findIndex(d => {
            if (d.children.length < 2) {
                return false;
            }
            return d.children[0].innerText.includes(innerText);
        });
}

function CloseAllWindows(windows) {
    windows.forEach(w => {
        CloseWindow(w.id);
    });
    openedOrderDetailsWindows = [];
}

function CloseWindow(windowId) {
    console.log("Closing window id= " + windowId);
    chrome.windows.remove(windowId);
}

function GetValueOfElementAtIndex(orderSummary, index) {
    if (index === -1) {
        return 0;
    }

    let matches = orderSummary[index].innerText.match(CURRENCY_REGEX);
    return Number(matches[matches.length - 1].replace(",", "."));
}

function CreateNewWindowFromExactUrl(url) {
    chrome.windows.create({
        "url": url
    });
}

function CreateNewWindow(wrongBaseUriUrl, callback) {
    console.log("Creating new window at url " + ToUrl(wrongBaseUriUrl));
    chrome.windows.create({
        "url": AMAZON_URL_BASE + ToUrl(wrongBaseUriUrl)
    }, callback);
}

function AddWindowToOpenedOrderDetailsWindows(newWindow) {
    openedOrderDetailsWindows.push(newWindow);
}

function GetDocumentFromDomContent(domContent) {
    return (new DOMParser).parseFromString(domContent, "text/html");
}

function ToUrl(wrongBaseUriUrl) {
    console.log("WrongBaseUrl= " + wrongBaseUriUrl);
    return ORDER_URL_REGEX.exec(wrongBaseUriUrl)[0];
}

function injectForegroundScript(callback) {
    chrome.tabs.executeScript(null, {
        file: "./foreground.js"
    }, () => {
        console.log("Foreground script has been injected");
        callback();
    });
}

function sendMessage(tabId, message, responseCallback) {
    chrome.tabs.sendMessage(
        tabId, {
            message: message
        }, {}, responseCallback
    );
}

// ============ DEMO STUFF

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.message === "check the storage") {
//         chrome.tabs.sendMessage(activeTabId, {
//             message: "Message initiated from background"
//         });
//         sendResponse({
//             message: "Message received from background"
//         });
//         chrome.storage.local.get("password", value => {
//             console.log(value);
//         });
//     }
// })

// chrome.tabs.onActivated.addListener(tab => {
//     chrome.tabs.get(tab.tabId, currentTabInfo => {
//         activeTabId = tab.tabId;
//         console.log(currentTabInfo);
//         if (/^https:\/\/www\.amazon\.it\/gp\/css\/order\-history/.test(currentTabInfo.url)) {
//             chrome.tabs.insertCSS(null, {
//                 file: "./mystyles.css"
//             })
//             chrome.tabs.executeScript(null, {
//                 file: "./foreground.js"
//             }, () => console.log("I injected"))
//         }
//     })
// });

// chrome.tabs.onActivated.addListener(tab => {
//     chrome.tabs.get(tab.tabId, currentTabInfo => {
//         activeTabId = tab.tabId;
//         console.log(currentTabInfo);
//         if (/^https:\/\/www\.amazon\.it\/gp\/css\/order\-history/.test(currentTabInfo.url)) {
//             chrome.tabs.insertCSS(null, {
//                 file: "./mystyles.css"
//             })
//             chrome.tabs.executeScript(null, {
//                 file: "./foreground.js"
//             }, () => console.log("I injected"))
//         }
//     })
// });