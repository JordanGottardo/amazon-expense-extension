const amazonOrderHistoryUrlBase = "https://www.amazon.it/gp/your-account/order-history?opt=ab&digitalOrders=1&unifiedOrders=1&returnTo=&__mk_it_IT=%C3%85M%C3%85%C5%BD%C3%95%C3%91&orderFilter="

function startCalculation() {
    // window.open(
    // amazonOrderHistoryUrlBase + "year-2021",
    // "AMAZON-2021",
    // "height=1000,width=1000");

    chrome.windows.create({
        "url": amazonOrderHistoryUrlBase + "year-2021"
    });
}

window.onload = function () {
    document.getElementById("startButton").onclick = startCalculation;
}