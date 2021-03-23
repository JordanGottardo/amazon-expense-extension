console.log("From background");

const AMAZON_URL_BASE = "https://www.amazon.it";
const AMAZON_ORDER_HISTORY_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/your-account\/order-history?.*orderFilter/;
const AMAZON_ORDER_DETAILS_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/your\-account\/order\-details.*/;
const ORDER_URL_REGEX = /\/gp.*/;
const CURRENCY_REGEX = /\d*,\d*/g;
const SEND_DOM_MESSAGE = "SendDomToBackground";

let activeTabId = 0;
let orderDetailsLinks;
let currentOrderPage = 1;
let currentWindowId;
let orderPagesLinks;
let orderWindowId;

let parsedOrderDetailsLinkCount = 0;
let openedOrderDetailsWindows = [];
let finishedParsingOrderDetails = false;

chrome.windows.onFocusChanged.addListener(windowId => {
    console.log("focus changed currentWindow= " + windowId + " orderWindowId= " + orderWindowId);

    let isMainOrderWindow = windowId == orderWindowId;
    let areThereOrderPagesLeft = currentOrderPage < orderPagesLinks.length;

    console.log("IsMainOrderWindow = " + isMainOrderWindow + " finishedParsingOrderDetails = " + finishedParsingOrderDetails + " areThereOrderPagesLeft = " +
        areThereOrderPagesLeft);

    if (windowId != -1) {
        ifCalculationIsStarted(() => {
            console.log("LocalStorage calculation started");

            if (windowId == orderWindowId &&
                finishedParsingOrderDetails &&
                currentOrderPage < orderPagesLinks.length) {
                finishedParsingOrderDetails = false;
                console.log("Opening page at index " + currentOrderPage);
                CreateNewWindow(orderPagesLinks[currentOrderPage].href);
                currentOrderPage++;
                //gone back to order page 1
            } else if (windowId == orderWindowId && finishedParsingOrderDetails && currentOrderPage === orderPagesLinks.length) {
                finishedParsingOrderDetails = false;
                currentOrderPage = 1;
                CloseWindow(windowId);
                setValueToLocalStorage("calculationStarted", false);
            }

            if (windowId != orderWindowId && finishedParsingOrderDetails) {
                console.log("Closing page at index " + currentOrderPage)
                CloseWindow(windowId);
            }
        });
    }
})

chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.storage.local.get("calculationStarted", value => {
        console.log("LocalStorage calculation started");
        console.log(value.calculationStarted);
    });
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    let isCurrentPageOrderHistory = IsCurrentPageOrderHistoryPage(tab);
    let isCurrentPageOrderDetails = AMAZON_ORDER_DETAILS_URL_REGEX.test(tab.url)
    if ((isCurrentPageOrderHistory || isCurrentPageOrderDetails) &&
        changeInfo.status === "complete") {
        currentWindowId = tab.windowId;
        let responseCallback = undefined;

        ifCalculationIsStarted(() => {
            if (isCurrentPageOrderHistory) {
                responseCallback = processOrderHistoryPageDom;
            } else if (isCurrentPageOrderDetails) {
                responseCallback = processOrderDetailPageDom;
            }

            injectForegroundScript(() => sendMessage(tab.id, SEND_DOM_MESSAGE, responseCallback));
        });

    }
});

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