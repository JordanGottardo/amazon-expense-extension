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

let activeTabId = 0;
let orderDetailsLinks;
let currentOrderPage = 1;
let currentWindowId;
let orderPagesLinks;
let orderWindowId;
let last3MonthsOrderWindowId;

let ordersByYearPageUrls = [];
let parsedOrderDetailsLinkCount = 0;
let openedOrderDetailsWindows = [];
let finishedParsingOrderDetails = false;
let finishedParsingAllOrderPagesByYear = false;
let currentOrdersByYearPage = undefined;

chrome.windows.onFocusChanged.addListener(windowId => {
    console.log("focus changed currentWindow= " + windowId + " orderWindowId= " + orderWindowId + " last3MonthsOrderWindowId = " + last3MonthsOrderWindowId);

    let isMainOrderWindow = windowId == orderWindowId;
    let areThereOrderPagesLeft = currentOrderPage < orderPagesLinks.length;

    console.log("IsMainOrderWindow = " + isMainOrderWindow + 
    " finishedParsingOrderDetails = " + finishedParsingOrderDetails + 
    " areThereOrderPagesLeft = " + areThereOrderPagesLeft);

    if (windowId != -1) {
        ifCalculationIsStarted(() => {

            if (windowId === last3MonthsOrderWindowId && finishedParsingAllOrderPagesByYear) {// ritorno alla pagina last3Months e ho finito tutto
                console.log("Finished everything");
                setValueToLocalStorage("calculationStarted", false);
            } 
            else if (windowId === last3MonthsOrderWindowId && currentOrdersByYearPage < ordersByYearPageUrls.length) { //ritorno alla pagina last3Months e non ho finito
                console.log("Creating new orderByYears page for index " + currentOrdersByYearPage) + " url " + ordersByYearPageUrls[currentOrdersByYearPage];
                CreateNewWindowFromExactUrl(ordersByYearPageUrls[currentOrdersByYearPage]);
                currentOrdersByYearPage++;
                orderWindowId = undefined;
                if (currentOrdersByYearPage === ordersByYearPageUrls.length) {
                    console.log("Finished everything: setting to true");
                    finishedParsingAllOrderPagesByYear = true;
                }
            }
            else if (windowId === orderWindowId &&
                finishedParsingOrderDetails &&
                currentOrderPage < orderPagesLinks.length) { // ritorno alla pagina di un singolo anno e ho ancora pagine da aprire
                console.log("ritorno alla pagina di un singolo anno e ho ancora pagine da aprire");
                finishedParsingOrderDetails = false;
                console.log("Opening page at index " + currentOrderPage);
                CreateNewWindow(orderPagesLinks[currentOrderPage].href);
                currentOrderPage++;
                
            } else if (windowId == orderWindowId && finishedParsingOrderDetails && currentOrderPage === orderPagesLinks.length) { // // ritorno alla pagina di un singolo anno e ho finito le pagine
                console.log("ritorno alla pagina di un singolo anno e ho finito le pagine");
                finishedParsingOrderDetails = false;
                currentOrderPage = 1;
                CloseWindow(windowId);
                
            }

            if (windowId != orderWindowId && finishedParsingOrderDetails) { // sono su una pagina di dettaglio ordine e ho finito la pagina di un anno
                console.log("Closing page at index " + currentOrderPage)
                CloseWindow(windowId);
            }
        });
    }
})

// chrome.tabs.onActivated.addListener(activeInfo => {
//     chrome.storage.local.get("calculationStarted", value => {
//         console.log("LocalStorage calculation started");
//         console.log(value.calculationStarted);
//     });
// })

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log("Tab URL = " + tab.url);
    let isCurrentPageOrderHistory = IsCurrentPageOrderHistoryPage(tab);
    let isCurrentPageOrderDetails = AMAZON_ORDER_DETAILS_URL_REGEX.test(tab.url)
    let isCurrentPageOrderHistoryLast3Month = AMAZON_ORDER_HISTORY_LAST_3_MONTH_URL_REGEX.test(tab.url)
    let isCurrentPageOrderSummary = AMAZON_ORDER_SUMMARY_URL_REGEX.test(tab.url)
    if ((isCurrentPageOrderHistory || isCurrentPageOrderDetails || isCurrentPageOrderHistoryLast3Month || isCurrentPageOrderSummary) &&
        changeInfo.status === "complete") {
        currentWindowId = tab.windowId;

        console.log("onUpdated");
        ifCalculationIsStarted(() => {
            if (isCurrentPageOrderHistoryLast3Month) {
                console.log("In last 3 month page: initializing order years urls");
                initializeOrdersByYearUrls();
                last3MonthsOrderWindowId = tab.windowId;
                CreateNewWindow(ordersByYearPageUrls[0]);
            } else {
                let responseCallback = undefined;
                if (isCurrentPageOrderHistory) {
                    responseCallback = processOrderHistoryPageDom;
                } else if (isCurrentPageOrderDetails || isCurrentPageOrderSummary) {
                    responseCallback = processOrderDetailPageDom;
                }
                injectForegroundScript(() => sendMessage(tab.id, SEND_DOM_MESSAGE, responseCallback));
            }
        });

    }
});

function initializeOrdersByYearUrls() {

    let currentYear = new Date().getFullYear();

    for (let year = currentYear; year >= 2010; year--) {
        ordersByYearPageUrls.push(AMAZON_ORDER_PAGE_BY_YEAR_URL_BASE + year);
        currentOrdersByYearPage = 0;
    }
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

    CreateNewOrderDetailsWindow(orderDetailsLinks[0]);
    parsedOrderDetailsLinkCount = 1;
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
    let scontiApplicatiValue = GetValueOfElementAtIndex(orderSummaryArray, indexOfScontiApplicati)
    let totaleRimborsoValue = GetValueOfElementAtIndex(orderSummaryArray, indexOfTotaleRimborso)
    let totalOrderValue = totalValue + buonoRegaloValue - scontiApplicatiValue - totaleRimborsoValue;
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
}

function ifCalculationIsStarted(callback) {
    getValueFromLocalStorage("calculationStarted", calculationStarted => {
        if (calculationStarted) {
            callback();
        }
    })
}

function getValueFromLocalStorage(key, callback) {
    chrome.storage.local.get(key, value => {
        callback(value[key]);
    })
}

function setValueToLocalStorage(key, value) {
    let obj = {};
    obj[key] = value;

    chrome.storage.local.set(obj);
}

function GetOrderPagesLinks(doc) {
    let pagesElements = Array.from(doc.querySelectorAll("#ordersContainer > .a-row li a"));
    pagesElements.pop();

    return pagesElements;
}

function IsCurrentPageOrderHistoryPage(tab) {
    return AMAZON_ORDER_HISTORY_URL_REGEX.test(tab.url);
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