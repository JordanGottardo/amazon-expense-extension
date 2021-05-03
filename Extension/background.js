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
        chrome.tabs.query({
            active: true,
            windowId: windowId
        }, tabs => {
            let tabUrl = tabs[0].url;

            ifCalculationIsStarted(tabUrl, () => {
                if (windowId === last3MonthsOrderWindowId && currentOrdersByYearPageIndex >= ordersByYearPageUrls.length - 1) { // I'm on "last 3 months" order page and parsing has finished
                    setValueToLocalStorage("calculationStarted", false);
                    CloseWindow(windowId);
                } else if (windowId === last3MonthsOrderWindowId && currentOrdersByYearPageIndex < ordersByYearPageUrls.length - 1) { //  I'm on "last 3 months" order page and parsing has not finished
                    currentOrdersByYearPageIndex++;
                    currentlyProcessedYear = ordersByYearPageUrls[currentOrdersByYearPageIndex].year;
                    orderWindowId = undefined;
                    CreateNewWindowFromExactUrl(ordersByYearPageUrls[currentOrdersByYearPageIndex].url);
                } else if (windowId === orderWindowId &&
                    finishedParsingOrderDetails &&
                    currentOrderPage < orderPagesLinks.length) { // I'm on single year order page and there are still more pages to be opened
                    finishedParsingOrderDetails = false;
                    CreateNewWindow(orderPagesLinks[currentOrderPage].href);
                    currentOrderPage++;
                } else if (windowId === orderWindowId && finishedParsingOrderDetails && (!orderPagesLinks || orderPagesLinks.length === 0 || currentOrderPage === orderPagesLinks.length)) { // I'm on single year order page and there are still more pages to be opened
                    finishedParsingOrderDetails = false;
                    currentOrderPage = 1;
                    CloseWindow(windowId);
                } else if (windowId != orderWindowId && finishedParsingOrderDetails) { // I'm on order detail page page and parsing for single year order page has finished
                    CloseWindow(windowId);
                }
            });
        });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

    ifCalculationIsStarted(tab.url, () => {
        let isCurrentPageOrderHistory = IsCurrentPageOrderHistoryPage(tab.url);
        let isCurrentPageOrderDetails = IsCurrentPageOrderDetailsPage(tab.url);
        let isCurrentPageOrderHistoryLast3Month = IsCurrentPageLast3MonthsOrderPage(tab.url);
        let isCurrentPageOrderSummary = IsCurrentPageOrderSummaryPage(tab.url);
        if ((isCurrentPageOrderHistory || isCurrentPageOrderDetails || isCurrentPageOrderHistoryLast3Month || isCurrentPageOrderSummary) &&
            changeInfo.status === "complete") {
            currentWindowId = tab.windowId;

            if (isCurrentPageOrderHistoryLast3Month) {
                initializeOrdersByYearUrls(() => {
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
    addOrderValuesToLocalStorage(currentlyProcessedYear, totalOrderValue, totaleRimborsoValue, () => {
        if (parsedOrderDetailsLinkCount < orderDetailsLinks.length) {
            let nextUrl = orderDetailsLinks[parsedOrderDetailsLinkCount];
            parsedOrderDetailsLinkCount++;
            CreateNewOrderDetailsWindow(nextUrl);
        } else {
            finishedParsingOrderDetails = true;
            CloseAllWindows(openedOrderDetailsWindows);
        }
    });
}

function ifCalculationIsStarted(currentUrl, callback) {
    if (!isCurrentUrlAmazon(currentUrl)) {
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
    chrome.storage.local.get(key, value => {
        callback(value[key]);
    })
}

function setValueToLocalStorage(key, value, callback) {
    let obj = {};
    obj[key] = value;

    chrome.storage.local.set(obj, callback);
}


function addOrderValuesToLocalStorage(year, orderValue, reimbursementValue, callback) {
    getValueFromLocalStorage(AMAZON_EXPENSES_OBJECT_KEY, oldVal => {
        oldVal[year].totalExpense = oldVal[year].totalExpense + orderValue;
        oldVal[year].reimbursement = oldVal[year].reimbursement + reimbursementValue;

        setValueToLocalStorage(AMAZON_EXPENSES_OBJECT_KEY, oldVal, () => {
            chrome.storage.local.get(null, value => {
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
    return ORDER_URL_REGEX.exec(wrongBaseUriUrl)[0];
}

function injectForegroundScript(callback) {
    chrome.tabs.executeScript(null, {
        file: "./foreground.js"
    }, () => {
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