const targetNode = document;
const config = { childList: true, subtree: true };
const filterRegex = /3rdparty|thirdparty|send.*mail|update|daily|news|product|subscribe|letter|marketing|opt\-in|optin|promo|offer/i;

let labelsAndCheckboxes = {};
let modifiedLabelsAndCheckboxes = {};

let enabled;
let pageLoaded = false;

const modifiedLabelsAndCheckboxesSetHandler = (target, key, value) => {
    const prevLength = Object.keys(target).length;
    target[key] = value;
    const newLength = Object.keys(target).length;

    const shouldUpdateIcon = (prevLength <= 0 && newLength > 0);
    if (shouldUpdateIcon) {
        chrome.runtime.sendMessage({ type: 'iconNotification', enabled: true, });
    }

    return true;
}

const modifiedLabelsAndCheckboxesDeleteHandler = (target, key, value) => {
    const prevLength = Object.keys(target).length;
    delete target[key];
    const newLength = Object.keys(target).length;

    const shouldUpdateIcon = (prevLength > 0 && newLength <= 0);
    if (shouldUpdateIcon) {
        chrome.runtime.sendMessage({ type: 'iconNotification', enabled: false, });
    }

    return true;
}

const modifiedLabelsAndCheckboxesProxy = new Proxy(modifiedLabelsAndCheckboxes, {
    set: modifiedLabelsAndCheckboxesSetHandler,
    deleteProperty: modifiedLabelsAndCheckboxesDeleteHandler,
});

const callback = (mutations, observer) => {
    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            [...mutation.addedNodes].forEach((node) => {
                // Skip text and comment nodes
                if (node.nodeType === 3 || node.nodeType === 8) {
                    return;
                }

                const checkboxes = [...node.getElementsByTagName('INPUT')].filter(elem => !labelsAndCheckboxes.hasOwnProperty(elem.id)
                    && (elem.type === 'checkbox' || (elem.classList && [...elem.classList].some(clazz => /checkbox/i.test(clazz)))));

                const filteredCheckboxes = checkboxes.filter(elem => {
                    let id = elem.id;
                    let name = elem.name || elem.getAttribute('name');
                    let title = elem.title || elem.getAttribute('title');
                    let classList = elem.classList;

                    return filterRegex.test(id) || filterRegex.test(name)
                        || filterRegex.test(title) || (classList && [...classList].some(clazz => filterRegex.test(clazz)))
                });

                const textNodeParents = textNodesParents(node).filter(elem => !Object.values(labelsAndCheckboxes).some(value => value.label === elem) && elem.tagName !== 'INPUT'
                    && elem.offsetWidth > 0 && elem.offsetHeight > 0);

                const labels = [...node.getElementsByTagName('*')].filter(elem => elem.tagName !== 'INPUT').filter(elem => !Object.values(labelsAndCheckboxes).some(value => value.label === elem)
                    && elem.offsetWidth > 0 && elem.offsetHeight > 0);

                const filteredLabels = [...textNodeParents, ...labels.filter(elem => {
                    let id = elem.id;
                    let name = elem.name || elem.getAttribute('name');
                    let title = elem.title || elem.getAttribute('title');
                    let elemFor = elem.for || elem.getAttribute('for');
                    let classList = elem.classList;

                    return filterRegex.test(id) || filterRegex.test(name)
                        || filterRegex.test(title) || filterRegex.test(elemFor)
                        || (classList && [...classList].some(clazz => filterRegex.test(clazz)))
                })];


                const labelsAndCheckboxesToDisable = {};

                for (var i = 0, labelsLength = filteredLabels.length; i < labelsLength; i++) {
                    const label = filteredLabels[i];
                    for (var j = 0, checkboxesLength = filteredCheckboxes.length; j < checkboxesLength; j++) {
                        const checkbox = filteredCheckboxes[j];

                        if (((label.getAttribute('for') === checkbox.id) || isParentOrChild(checkbox, label) || areSiblings(checkbox, label) || checkboxParentContainsLabel(checkbox, label))
                            && !labelContainsOtherCheckboxes(checkboxes, label, checkbox)) {
                            if (!checkbox.id) {
                                checkbox.id = uuidv4();
                            }

                            if (!labelsAndCheckboxesToDisable.hasOwnProperty(checkbox.id) || Object.values(labelsAndCheckboxesToDisable).some(value => label.contains(value.label))) {
                                labelsAndCheckboxesToDisable[checkbox.id] = {
                                    label,
                                    checkbox,
                                    pointerEvents: label.style.pointerEvents,
                                }
                            }
                        }
                    }
                }


                // We remove any checkboxes that are no longer on the page in case they are added again
                if (pageLoaded) {
                    removeCheckboxesThatNoLongerExist();
                }

                // We want to disable any sneakily added checkboxes after the page has loaded
                if (pageLoaded && enabled) {
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

window.addEventListener('load', () => {
    pageLoaded = true;
    if (enabled) {
        disableLabelsAndCheckboxes(labelsAndCheckboxes);
    }
});

function removeCheckboxesThatNoLongerExist() {
    for (const checkboxId in labelsAndCheckboxes) {
        if (!document.getElementById(checkboxId)) {
            delete labelsAndCheckboxes[checkboxId];

            if (modifiedLabelsAndCheckboxesProxy.hasOwnProperty(checkboxId)) {
                delete modifiedLabelsAndCheckboxesProxy[checkboxId];
            }
        }
    }
}

function labelContainsOtherCheckboxes(checkboxes, label, okayCheckbox) {
    return [...Object.values(labelsAndCheckboxes).map(labelAndCheckbox => labelAndCheckbox.checkbox), ...checkboxes]
        .some(checkbox => checkbox !== okayCheckbox && label.contains(checkbox));
}

function textNodesParents(elem) {
    let node;
    const parents = [];
    const nodeIterator = document.createNodeIterator(elem, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            return filterRegex.test(node.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
    });
    while (node = nodeIterator.nextNode()) {
        parents.push(node.parentElement);
    }
    return parents;
}

function checkboxParentContainsLabel(checkbox, label) {
    return checkbox.parentElement.contains(label);
}

function areSiblings(elem1, elem2) {
    return elem1 != elem2 && [...elem1.parentNode.children].some(child => child == elem2)
}

function isParentOrChild(elem1, elem2) {
    return elem1.contains(elem2) || elem2.contains(elem1);
}

function isFunction(functionToCheck) {
    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
}

disableLabelsAndCheckboxes = (labelsAndCheckboxes) => {
    for (const checkboxId in labelsAndCheckboxes) {
        const label = labelsAndCheckboxes[checkboxId].label;
        const checkbox = labelsAndCheckboxes[checkboxId].checkbox;

        if (checkbox.checked) {
            if (isFunction(checkbox.click)) {
                checkbox.click();
            }
        }

        if (checkbox.checked) {
            if (isFunction(label.click)) {
                label.click();
            }
        }

        label.disabled = true;
        label.style.pointerEvents = 'none';

        checkbox.checked = undefined;
        checkbox.value = undefined;
        checkbox.disabled = true;

        modifiedLabelsAndCheckboxesProxy[checkboxId] = labelsAndCheckboxes[checkboxId];
    }
}

enableLabelsAndCheckboxes = () => {
    for (const checkboxId in modifiedLabelsAndCheckboxesProxy) {
        const curObj = modifiedLabelsAndCheckboxes[checkboxId];
        const label = curObj.label;

        curObj.checkbox.disabled = false;

        label.disabled = false;
        label.style.pointerEvents = curObj.pointerEvents;

        delete modifiedLabelsAndCheckboxesProxy[checkboxId];
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