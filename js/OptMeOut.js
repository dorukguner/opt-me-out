const targetNode = document;
const config = { childList: true, subtree: true };
const filterRegex = /mail|sub|letter|marketing|opt\-in|optin|promo/i;

let labelsAndCheckboxes = {};
let modifiedLabelsAndCheckboxes = {};

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

                // Get all checkboxes and labels that haven't already been found

                const checkboxes = [...node.getElementsByTagName('INPUT')].filter(elem => !Object.values(labelsAndCheckboxes).some(value => value.checkbox === elem));
                const labels = [...node.getElementsByTagName('LABEL')].filter(elem => !labelsAndCheckboxes.hasOwnProperty(elem.id) && elem.offsetWidth > 0 && elem.offsetHeight > 0);

                let filteredCheckboxes = checkboxes.filter(elem => !Object.values(modifiedLabelsAndCheckboxes).some(value => value.checkbox === elem)
                    && (elem.type === 'checkbox' || (elem.classList && [...elem.classList].find(clazz => clazz.match(/checkbox/i))))
                    && ((elem.id && elem.id.match(filterRegex)) || (elem.name && elem.name.match(filterRegex))
                        || (elem.title && elem.title.match(filterRegex)) || (elem.classList && [...elem.classList].find(clazz => clazz.match(filterRegex)))));


                let filteredLabels = labels.filter(elem => !modifiedLabelsAndCheckboxes.hasOwnProperty(elem) && ((elem.id && elem.id.match(filterRegex)) || (elem.name && elem.name.match(filterRegex))
                    || (elem.title && elem.title.match(filterRegex)) || (elem.for && elem.for.match(filterRegex))
                    || (elem.classList && [...elem.classList].find(clazz => clazz.match(filterRegex)))));


                const labelsAndCheckboxesToDisable = {};

                for (var i = 0, labelsLength = filteredLabels.length; i < labelsLength; i++) {
                    const label = filteredLabels[i];
                    for (var j = 0, checkboxesLength = checkboxes.length; j < checkboxesLength; j++) {
                        const checkbox = checkboxes[j];

                        if ((label.for && checkbox.id && label.for === checkbox.id) || isParentOrChild(checkbox, label) || areSiblings(checkbox, label)) {
                            if (!label.id) {
                                label.id = uuidv4();
                            }

                            if (!labelsAndCheckboxesToDisable.hasOwnProperty(label.id)) {
                                labelsAndCheckboxesToDisable[label.id] = {
                                    label,
                                    checkbox,
                                    pointerEvents: label.style.pointerEvents,
                                }
                            }

                            break;
                        }
                    }
                }

                for (var i = 0, checkboxesLength = filteredCheckboxes.length; i < checkboxesLength; i++) {
                    const checkbox = filteredCheckboxes[i];
                    for (var j = 0, labelsLength = labels.length; j < labelsLength; j++) {
                        const label = labels[j];

                        if ((label.for && checkbox.id && label.for === checkbox.id) || isParentOrChild(checkbox, label) || areSiblings(checkbox, label)) {
                            if (!label.id) {
                                label.id = uuidv4();
                            }

                            if (!labelsAndCheckboxesToDisable.hasOwnProperty(label)) {
                                labelsAndCheckboxesToDisable[label.id] = {
                                    label,
                                    checkbox,
                                    pointerEvents: label.style.pointerEvents,
                                };
                            }

                            break;
                        }
                    }
                }

                if (enabled) {
                    disableLabelsAndCheckboxes(labelsAndCheckboxesToDisable);
                }

                labelsAndCheckboxes = {
                    ...labelsAndCheckboxes,
                    ...labelsAndCheckboxesToDisable
                }
            });
        }
    });
}

function areSiblings(elem1, elem2) {
    return elem1 != elem2 && [...elem1.parentNode.children].some(child => child == elem2);
}

function isParentOrChild(elem1, elem2) {
    return elem1.contains(elem2) || elem2.contains(elem1);
}

disableLabelsAndCheckboxes = (labelsAndCheckboxes) => {
    for (const labelId in labelsAndCheckboxes) {
        const label = labelsAndCheckboxes[labelId].label;
        const checkbox = labelsAndCheckboxes[labelId].checkbox;

        if (!iconSet) {
            chrome.runtime.sendMessage({ type: 'iconNotification', enabled, });
            iconSet = true;
        }

        if (checkbox.checked) {
            label.click();
        }

        label.disabled = true;
        label.style.pointerEvents = 'none';

        checkbox.checked = undefined;
        checkbox.value = undefined;
        checkbox.disabled = true;  
    }

    modifiedLabelsAndCheckboxes = {
        ...modifiedLabelsAndCheckboxes,
        ...labelsAndCheckboxes,
    }
}

enableLabelsAndCheckboxes = () => {
    for (const labelId in modifiedLabelsAndCheckboxes) {
        const curObj = modifiedLabelsAndCheckboxes[labelId];
        const label = curObj.label;

        curObj.checkbox.disabled = false;

        label.disabled = false;
        label.style.pointerEvents = curObj.pointerEvents;
        delete modifiedLabelsAndCheckboxes[labelId];
    }
}

uuidv4 = () => {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
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
                disableLabelsAndCheckboxes(labelsAndCheckboxes);
            } else {
                enableLabelsAndCheckboxes();
            }
        }

        sendResponse({
            enabled,
            modifiedCheckboxes: Object.keys(modifiedLabelsAndCheckboxes).length,
            checkboxesFound: Object.keys(labelsAndCheckboxes).length,
        })

        return true;
    }
});