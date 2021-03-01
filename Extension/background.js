console.log("From background")

let activeTabId = 0;

chrome.tabs.onActivated.addListener(tab =>
{    
    chrome.tabs.get(tab.tabId, currentTabInfo => 
    {
        activeTabId = tab.tabId;
            if (/^https:\/\/www\.google/.test(currentTabInfo.url))
            {
                chrome.tabs.insertCSS(null, {file: "./mystyles.css"})
                chrome.tabs.executeScript(null, {file: "./foreground.js"}, () => console.log("I injected"))
            }
    })
})


chrome.runtime.onMessage.addListener((request, sender, sendResponse) =>
{
    if (request.message === "check the storage")
    {
        chrome.tabs.sendMessage(activeTabId, {message: "Message initiated from background"});
        sendResponse({message: "Message received from background"});
        chrome.storage.local.get("password", value => 
        {
            console.log(value);
        });
    }
})