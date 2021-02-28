const targetNode = document;

const config = { childList: true, subtree: true };

const filterRegex = /mail|sub|letter|marketing|opt\-in/i;

let checkboxesFound = [];
const modifiedCheckboxes = [];
const modifiedLabels = {};

let enabled;
let iconSet = false;

const callback = (mutations, observer) => {
    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            [...mutation.addedNodes].forEach((node) => {
                // Skip text and comment nodes
                if (node.nodeType === 3 || node.nodeType === 8) {
                    return;
                }

                const checkboxes = [...node.getElementsByTagName('INPUT')].filter(elem => !checkboxesFound.includes(elem) && !modifiedCheckboxes.includes(elem)
                    && (elem.type === 'checkbox' || (elem.classList && [...elem.classList].find(clazz => clazz.match(/checkbox/i))))
                    && ((elem.id && elem.id.match(filterRegex)) || (elem.name && elem.name.match(filterRegex)) || (elem.title && elem.title.match(filterRegex))));

                if (enabled) {
                    disableCheckboxes(checkboxes);
                }

                checkboxesFound = checkboxesFound.concat(checkboxes);
            });
        }
    });
}

disableCheckboxes = (checkboxes) => {
    for (const checkbox of checkboxes) {
        if (!iconSet) {
            chrome.runtime.sendMessage({ type: 'iconNotification', enabled, });
            iconSet = true;
        }
        modifiedCheckboxes.push(checkbox);
        checkbox.checked = undefined;
        checkbox.value = undefined;
        checkbox.disabled = true;
        disableLabels(checkbox.parentNode);
    }
}

disableLabels = (node) => {
    const labels = [...node.getElementsByTagName('LABEL')].filter(elem => !modifiedLabels.hasOwnProperty(elem) /*&& typeof elem.onclick === 'function'*/
        && ((elem.id && elem.id.match(filterRegex)) || (elem.name && elem.name.match(filterRegex))
            || (elem.title && elem.title.match(filterRegex)) || (elem.for && elem.for.match(filterRegex))));

    for (const label of labels) {
        modifiedLabels[label.id] = label.style.pointerEvents;
        label.disabled = true;
        label.style.pointerEvents = 'none';
    }
}

enableCheckboxes = () => {
    while (modifiedCheckboxes.length > 0) {
        const checkbox = modifiedCheckboxes.pop();
        checkbox.disabled = false;
    }
}

enableLabels = () => {
    for (const labelId in modifiedLabels) {
        const label = document.getElementById(labelId);
        label.disabled = false;
        label.style.pointerEvents = modifiedLabels[labelId];
        delete modifiedLabels[labelId];
    }
}

const observer = new MutationObserver(callback);
observer.observe(targetNode, config);

chrome.storage.local.get(['optOutEnabled'], (result) => {
    enabled = result.optOutEnabled !== undefined ? result.optOutEnabled : true;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'statusNotification') {
        if (request.enabled !== undefined) {
            enabled = request.enabled;

            chrome.storage.local.set({
                optOutEnabled: enabled,
            });

            if (enabled) {
                disableCheckboxes(checkboxesFound);
            } else {
                enableCheckboxes();
                enableLabels();
            }
        }

        sendResponse({
            enabled,
            modifiedCheckboxes: modifiedCheckboxes.length,
            checkboxesFound: checkboxesFound.length,
        })

        return true;
    }
});