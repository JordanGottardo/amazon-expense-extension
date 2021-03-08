console.log("From background")

const amazonUrlBase = "https://www.amazon.it"
const amazonOrderHistoryUrlRegex = /^https:\/\/www.amazon.it\/gp\/your-account\/order-history?.*orderFilter/;
let activeTabId = 0;

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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (amazonOrderHistoryUrlRegex.test(tab.url) && changeInfo.status === "complete") {
        console.log("Complete");
        console.log(tab);
        injectForegroundScript(() => sendMessage(tab.id, "SendDomToBackground"), processDom);

        let orders = Array.from(document.querySelectorAll("#ordersContainer > div")).slice(1);
        console.log(orders.length);

        orders.forEach(order => {
            console.log(order);
            let orderDetailsLink = order.querySelector(".a-link-normal");
            console.log(orderDetailsLink["href"]);
        });

    }

    // chrome.windows.remove(tab.windowId);

});

function injectForegroundScript(callback) {
    chrome.tabs.executeScript(null, {
        file: "./foreground.js"
    }, () => {
        console.log("Foreground script has been injected")
        callback();
    });
}

function processDom(dom) {
    console.log("Processing DOM");
    console.log(dom);
}

function sendMessage(tabId, message, responseCallback) {
    console.log("Sending message");
    console.log(message);
    chrome.tabs.sendMessage(
        tabId, {
            message: message
        }, {},
        responseCallback);
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