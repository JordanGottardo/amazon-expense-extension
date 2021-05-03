const AMAZON_ORDER_HISTORY_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/your-account\/order-history?.*orderFilter/;
const AMAZON_ORDER_DETAILS_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/your\-account\/order\-details.*/;


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "SendDomToBackground") {
        sendResponse(getDomContent());
    }
});

function getDomContent() {
    return new XMLSerializer().serializeToString(document);
}