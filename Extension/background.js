console.log("From background");

const AMAZON_URL_BASE = "https://www.amazon.it";
const AMAZON_ORDER_HISTORY_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/your-account\/order-history?.*orderFilter/;
const AMAZON_ORDER_DETAILS_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/your\-account\/order\-details.*/;
const ORDER_URL_REGEX = /\/gp.*/;
const CURRENCY_REGEX = /\d*,\d*/;
const SEND_DOM_MESSAGE = "SendDomToBackground";

let activeTabId = 0;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    let isCurrentPageOrderHistory = AMAZON_ORDER_HISTORY_URL_REGEX.test(tab.url);
    let isCurrentPageOrderDetails = AMAZON_ORDER_DETAILS_URL_REGEX.test(tab.url)
    if ((isCurrentPageOrderHistory || isCurrentPageOrderDetails) &&
        changeInfo.status === "complete") {
        console.log("Complete");
        console.log(tab);
        let responseCallback = undefined;
        if (isCurrentPageOrderHistory) {
            responseCallback = processOrderHistoryPageDom;
        } else if (isCurrentPageOrderDetails) {
            responseCallback = processOrderDetailPageDom;
        }

        injectForegroundScript(() => sendMessage(tab.id, SEND_DOM_MESSAGE, responseCallback));

        let orders = Array.from(document.querySelectorAll("#ordersContainer > div")).slice(1);
        console.log(orders.length);

        orders.forEach(order => {
            console.log(order);
            let orderDetailsLink = order.querySelector(".a-link-normal");
            console.log(orderDetailsLink.href);
        });
    }

    // chrome.windows.remove(tab.windowId);

});

function processOrderHistoryPageDom(domContent) {
    console.log("Processing order history page DOM");

    let doc = GetDocumentFromDomContent(domContent);
    let orderDetailsLinks = doc.querySelectorAll(".a-unordered-list.a-nostyle.a-vertical > a");
    console.log(orderDetailsLinks);

    chrome.windows.create({
        "url": AMAZON_URL_BASE + ToUrl(orderDetailsLinks[0].href)
    });
}

function processOrderDetailPageDom(domContent) {
    console.log("Processing order detail page DOM");
    console.log(domContent);
    let doc = GetDocumentFromDomContent(domContent);
  
    totalOrderValue = Number(
        CURRENCY_REGEX
        .exec(doc
        .querySelector("#od-subtotals DIV:nth-child(5) DIV:nth-child(2)")
        .innerText)[0]
        .replace(",", "."));
    console.log("TotalOrderValue = " + totalOrderValue);
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
    console.log("Sending message");
    console.log(message);
    chrome.tabs.sendMessage(
        tabId, {
            message: message
        }, {}, responseCallback
    );
}

// ============ DEMO STUFF

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "check the storage") {
        chrome.tabs.sendMessage(activeTabId, {
            message: "Message initiated from background"
        });
        sendResponse({
            message: "Message received from background"
        });
        chrome.storage.local.get("password", value => {
            console.log(value);
        });
    }
})

chrome.tabs.onActivated.addListener(tab => {
    chrome.tabs.get(tab.tabId, currentTabInfo => {
        activeTabId = tab.tabId;
        console.log(currentTabInfo);
        if (/^https:\/\/www\.amazon\.it\/gp\/css\/order\-history/.test(currentTabInfo.url)) {
            chrome.tabs.insertCSS(null, {
                file: "./mystyles.css"
            })
            chrome.tabs.executeScript(null, {
                file: "./foreground.js"
            }, () => console.log("I injected"))
        }
    })
});

chrome.tabs.onActivated.addListener(tab => {
    chrome.tabs.get(tab.tabId, currentTabInfo => {
        activeTabId = tab.tabId;
        console.log(currentTabInfo);
        if (/^https:\/\/www\.amazon\.it\/gp\/css\/order\-history/.test(currentTabInfo.url)) {
            chrome.tabs.insertCSS(null, {
                file: "./mystyles.css"
            })
            chrome.tabs.executeScript(null, {
                file: "./foreground.js"
            }, () => console.log("I injected"))
        }
    })
});