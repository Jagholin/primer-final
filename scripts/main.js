/*
 * The main purpose of this module is to request blog post entries from the server
 * and put them on the page
 */

const POST_ROOT = "main";
const POST_TEMPLATE = '#blog-item-template';

/**
 * function decomposes text into an array of tokens
 * @param {string} text input text
 */
function decomposeToTokens(text) {
    const tag_rx = /\\([a-zA-Z\\]+)/;
    const matches = text.matchAll(tag_rx);
    let cursor = 0;
    const result = [];
    for (const match of matches) {
        let tag_name = match[1];
        // extract string fragment token
        let endFrag = match.index;
        let stringFrag = text.substring(cursor, endFrag);
        cursor = endFrag + match[0].length + 1;
        if (stringFrag.length > 0) {
            result.push({type: 'text', content: stringFrag});
        }
        result.push({type: "tag", content: match[1]});
    }
    if (cursor < text.length) {
        result.push({type: "text", content: text.substring(cursor)});
    }
    return result;
}

/**
 * Turns a value from server API into something that can be passed to method
 * replaceWith() to replace a <slot>.
 * 
 * @param {function|string|*[]|Node} replacement value to be adjusted
 * @param {Node} node replacement context. If replacement doesn't containt a function, this parameter is not used.
 * @returns {Node|string|undefined}
 */
function adjustReplacement(replacement, node) {
    const replType = typeof replacement;
    if (replType === "function") {
        return adjustReplacement(replacement(node), node);
    }
    if (replType === "string") {
        // todo: parse this and turn tags like \code into corresponding HTML elements
        return replacement;
    }
    if (replType !== "object") {
        console.error("Cannot recognize replacement type, repl ", replacement);
        return; // undefined;
    }

    // ASSERT (typeof replacement === "object")
    // If its already some DOM just use it as is
    if (replacement instanceof Node) {
        return replacement;
    }
    const replArray = Array.from(replacement);
    if (replArray.length === 0) {
        console.error("replacement's object type is not supported, repl ", replacement);
        return; // undefined;
    }
    // lets make paragraphs out of each replArray element
    const result = document.createDocumentFragment();
    for (const repl of replArray) {
        const adjustedRepl = adjustReplacement(repl, node);
        // this function can return Node, string or undefined.
        if (typeof adjustedRepl === "undefined") {
            return; // undefined;
        }
        const newP = document.createElement("p");
        if (typeof adjustedRepl === "string") {
            newP.textContent = adjustedRepl;
        } else {
            newP.appendChild(adjustedRepl);
        }
        result.appendChild(newP);
    }
    return result;
}

/**
 * This function replaces slots in a given node tree with text or other nodes
 * the second argument is a dictionary where keys are values of attribute "name" from the slots
 * 
 * @param {HTMLElement} node element where <slot> tags will be replaced.
 * @param {object} replacements dictionary to what replace slots with
 */
function replaceSlots(node, replacements) {
    const slots = node.querySelectorAll("slot");
    for (const slot of slots) {
        const slotName = slot.getAttribute("name");
        let replacementCandidate = replacements[slotName];
        // if the element contains nops attribute, dont split the string
        if (!("nops" in slot.dataset)) {
            replacementCandidate = replacementCandidate.split("\n");
        }
        replacementCandidate = adjustReplacement(replacementCandidate, node);
        if (typeof replacementCandidate === "undefined") {
            console.error(`Cant replace slot named ${slotName} with data: field named ${slotName} doesnt exist`);
            console.error('In data block ', post);
            console.error('type is ', typeof replacementCandidate);
            continue;
        }
        slot.replaceWith(replacementCandidate);
    }
}

/**
 * function that is called when we receive post information from our web server;
 * has to add content to the page based on the data received and the settings
 * (eventually) like search filters(TODO)
 * 
 * @param {{title: string, content: string}[]} posts - an array of blog post entries received from our "API"
 * @returns undefined
 */
function createPosts(posts) {
    if (!posts) {
        console.error("empty posts object");
        return;
    }
    const postRoot = document.querySelector(POST_ROOT);
    const newFragment = document.createDocumentFragment();

    // the template itself is hidden behind .content property
    /** @type {HTMLElement} */
    let template_node = document.querySelector(POST_TEMPLATE).content;
    if (!postRoot) {
        console.error("Cant find root element to insert blog entries");
        return;
    }

    for (const post of posts) {
        let myNode = template_node.cloneNode(true);
        replaceSlots(myNode, post);
        newFragment.appendChild(myNode);
    }
    postRoot.appendChild(newFragment);
}

// lets load our blog entries

let dataRequest = new XMLHttpRequest();
dataRequest.open("GET", "./data/blog_entries.json");
dataRequest.timeout = 5000;
dataRequest.addEventListener('readystatechange', function() {
    if (dataRequest.readyState === XMLHttpRequest.DONE) {
        const status = dataRequest.status;
        if (status === 0 || status >= 200 && status < 400) {
            let result = JSON.parse(dataRequest.responseText);
            // result should contain fields "author" and "posts"
            createPosts(result.posts);
        }
    }
});
dataRequest.send();
