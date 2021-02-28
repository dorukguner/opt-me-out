const wrapper = document.getElementById('wrapper');
const optOutCheckbox = document.getElementById('on-off-switch');
const text = document.getElementById('text');

updatePopup = (enabled) => {
    chrome.tabs.query({ active: true, currentWindow: true, }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'statusNotification', enabled, }, (response) => {
            if (chrome.runtime.lastError || !response || response.checkboxesFound <= 0) {
                text.innerHTML = 'No marketing checkboxes found';
                optOutCheckbox.checked = false;
                optOutCheckbox.disabled = true;
            } else {
                optOutCheckbox.checked = response.enabled !== undefined ? response.enabled : true;
                text.innerHTML = `Opted out of ${response.modifiedCheckboxes}/${response.checkboxesFound} marketing checkboxes`
            }

            wrapper.hidden = false;
        });
    });
}

optOutCheckbox.onclick = (e) => {
    const enabled = e.target.checked;
    updatePopup(enabled);
    chrome.runtime.sendMessage({ type: 'iconNotification', enabled, });
}

updatePopup();