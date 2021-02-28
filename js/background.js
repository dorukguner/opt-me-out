chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'iconNotification') {
        setIcon(request.enabled);
    }
});

chrome.tabs.onActivated.addListener(function (tabId, changeInfo, tab) {
    chrome.tabs.query({ active: true, currentWindow: true, }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'statusNotification', }, (response) => {
            setIcon(!chrome.runtime.lastError && response && response.enabled && response.checkboxesFound > 0);
        });
    });
});

setIcon = (enabled) => {
    let path16 = enabled ? '../img/activated-16.png' : '../img/deactivated-16.png';
    let path32 = enabled ? '../img/activated-32.png' : '../img/deactivated-32.png';
    let path48 = enabled ? '../img/activated-48.png' : '../img/deactivated-48.png';
    let path128 = enabled ? '../img/activated-128.png' : '../img/deactivated-128.png';
    chrome.browserAction.setIcon({
        path: {
            "16": path16,
            "32": path32,
            "48": path48,
            "128": path128,
        }
    });
}