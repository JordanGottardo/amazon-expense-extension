console.log("From foreground");
//document.querySelector(".lnXdpd").classList.add("spin")

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "SendDomToBackground") {
        let domContent = new XMLSerializer().serializeToString(document);

        sendResponse(domContent);
    }
});

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