console.log("From foreground");
//document.querySelector(".lnXdpd").classList.add("spin")

const AMAZON_ORDER_HISTORY_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/your-account\/order-history?.*orderFilter/;
const AMAZON_ORDER_DETAILS_URL_REGEX = /^https:\/\/www.amazon.it\/gp\/your\-account\/order\-details.*/;


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("current url " + window.location.href);
   
    if (request.message === "SendDomToBackground") {
        sendResponse(getDomContent());
    }
});

function getDomContent() {
    return new XMLSerializer().serializeToString(document);
}

// ============= DEMO STUFF

const first = document.createElement("button");
first.innerText = "SET DATA";
first.id = "first";

const second = document.createElement("button");
second.innerText = "SEND TO BACKEND";
second.id = "second";

document.querySelector("body").appendChild(first);
document.querySelector("body").appendChild(second);

first.addEventListener("click", () => {
    chrome.storage.local.set({
        "password": "123"
    });
    console.log("Set password to local storage")
})

second.addEventListener("click", () => {
    chrome.runtime.sendMessage({
        message: "check the storage"
    }, response => {
        console.log(response);
    });
    console.log("Sent message to backend");
})