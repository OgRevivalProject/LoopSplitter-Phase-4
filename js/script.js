// One key for everything — if I ever need to rename it, I only change it here
const STORAGE_KEY = "lootSplitterState";

// Student ID used in both the route parameter and the JSON payload — must match exactly
const STUDENT_ID = "shaneR";

// Server base URL — pulled out so I'm not repeating it in every fetch call
// Using https so GitHub Pages (which serves over https) doesn't block the request
const SERVER_BASE = "https://goldtop.hopto.org";

// let instead of const so restoreState and loadFromServer can reassign these
let loot = [];
let partySize = 1;


// DOM references
const partySizeInput    = document.getElementById("party-size");
const lootNameInput     = document.getElementById("loot-name");
const lootValueInput    = document.getElementById("loot-value");
const lootQuantityInput = document.getElementById("loot-quantity");
const addLootBtn        = document.getElementById("add-loot-btn");
const splitLootBtn      = document.getElementById("split-loot-btn");
const resetAllBtn       = document.getElementById("reset-all-btn");
const syncBtn           = document.getElementById("sync-btn");
const loadBtn           = document.getElementById("load-btn");
const serverStatus      = document.getElementById("server-status");
const noLootMessage     = document.getElementById("noLootMessage");
const lootTableWrapper  = document.getElementById("loot-table-wrapper");
const lootRows          = document.getElementById("lootRows");
const totalLootSpan     = document.getElementById("totalLoot");
const resultsArea       = document.getElementById("results-area");
const resultTotal       = document.getElementById("result-total");
const resultPerMember   = document.getElementById("result-per-member");
const partyError        = document.getElementById("party-error");
const lootError         = document.getElementById("loot-error");
const splitError        = document.getElementById("split-error");


// Packs loot and partySize into one object and writes it to localStorage.
// This never touches the DOM — saving and rendering are kept separate on purpose.
function saveState() {
    const state = {
        loot: loot,
        partySize: partySize
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}


// Pulls saved data out of localStorage and puts it back into the live variables.
// Each loot item gets checked individually — one bad item gets skipped, not the whole array.
function restoreState() {
    const saved = localStorage.getItem(STORAGE_KEY);

    // First visit or after a reset — nothing to restore
    if (saved === null) {
        return;
    }

    let parsed;

    // localStorage could have garbage in it if something went wrong, so we wrap the parse
    try {
        parsed = JSON.parse(saved);
    } catch (e) {
        return;
    }

    // Sanity check before we start reading properties off it
    if (typeof parsed !== "object" || parsed === null) {
        return;
    }

    // Put the party size back into the input field too, not just the variable
    if (typeof parsed.partySize === "number" && parsed.partySize >= 1) {
        partySize = parsed.partySize;
        partySizeInput.value = partySize;
    }

    // Re-validate every item before pushing it — don't trust what's in storage blindly
    if (Array.isArray(parsed.loot)) {
        for (let i = 0; i < parsed.loot.length; i++) {
            const item = parsed.loot[i];

            const hasName     = typeof item.name === "string" && item.name.trim() !== "";
            const hasValue    = typeof item.value === "number" && item.value >= 0;
            const hasQuantity = typeof item.quantity === "number" && item.quantity >= 1;

            if (hasName && hasValue && hasQuantity) {
                loot.push(item);
            }
        }
    }
}


// Everything that touches the DOM lives here — totals, list, button state, results.
// It never reads from localStorage, only from the live variables.
function updateUI() {

    let total = 0;
    for (let i = 0; i < loot.length; i++) {
        total += loot[i].value * loot[i].quantity;
    }

    totalLootSpan.textContent = total.toFixed(2);

    lootRows.innerHTML = "";

    if (loot.length === 0) {
        noLootMessage.classList.remove("hidden");
        lootTableWrapper.classList.add("hidden");
    } else {
        noLootMessage.classList.add("hidden");
        lootTableWrapper.classList.remove("hidden");

        for (let i = 0; i < loot.length; i++) {

            let row = document.createElement("div");
            row.className = "loot-row";

            let nameCell = document.createElement("div");
            nameCell.className = "loot-cell";
            nameCell.textContent = loot[i].name;

            let valueCell = document.createElement("div");
            valueCell.className = "loot-cell value-cell";
            valueCell.textContent = "$" + loot[i].value.toFixed(2);

            let quantityCell = document.createElement("div");
            quantityCell.className = "loot-cell";
            quantityCell.textContent = loot[i].quantity;

            let actionCell = document.createElement("div");
            actionCell.className = "loot-cell";

            let removeBtn = document.createElement("button");
            removeBtn.textContent = "Remove";
            removeBtn.type = "button";

            // Without the IIFE, every button would use whatever i is at the end of the loop
            removeBtn.addEventListener("click", (function(index) {
                return function() {
                    removeLoot(index);
                };
            })(i));

            actionCell.appendChild(removeBtn);
            row.appendChild(nameCell);
            row.appendChild(valueCell);
            row.appendChild(quantityCell);
            row.appendChild(actionCell);
            lootRows.appendChild(row);
        }
    }

    // Read straight from the input so a bad value typed in real-time disables the button immediately
    const currentPartySize = parseInt(partySizeInput.value, 10);
    const partyValid = !isNaN(currentPartySize) && currentPartySize >= 1;

    if (loot.length > 0 && partyValid) {
        splitLootBtn.disabled = false;
    } else {
        splitLootBtn.disabled = true;
    }

    if (loot.length > 0 && partyValid) {
        const perMember = total / currentPartySize;
        resultTotal.textContent     = "$" + total.toFixed(2);
        resultPerMember.textContent = "$" + perMember.toFixed(2);
        resultsArea.classList.remove("hidden");
    } else {
        resultsArea.classList.add("hidden");
    }
}


// Validate first, then mutate, then save, then render — in that order
function addLoot() {
    lootError.textContent = "";

    const name     = lootNameInput.value.trim();
    const value    = parseFloat(lootValueInput.value);
    const quantity = parseInt(lootQuantityInput.value, 10);

    if (name === "") {
        lootError.textContent = "Please enter a loot item name.";
        lootNameInput.focus();
        return;
    }
    if (isNaN(value)) {
        lootError.textContent = "Please enter a valid loot value.";
        lootValueInput.focus();
        return;
    }
    if (value < 0) {
        lootError.textContent = "Loot value cannot be negative.";
        lootValueInput.focus();
        return;
    }
    if (isNaN(quantity) || quantity < 1) {
        lootError.textContent = "Quantity must be at least 1.";
        lootQuantityInput.focus();
        return;
    }

    loot.push({ name: name, value: value, quantity: quantity });
    saveState();

    lootNameInput.value     = "";
    lootValueInput.value    = "";
    lootQuantityInput.value = "";
    lootNameInput.focus();

    updateUI();
}


// Remove the item, save so the deletion persists, then redraw
function removeLoot(index) {
    loot.splice(index, 1);
    saveState();
    updateUI();
}


// All the math happens in updateUI — this just clears old errors and kicks it off
function splitLoot() {
    splitError.textContent = "";
    partyError.textContent = "";
    updateUI();
}


// Clears memory, clears the input, and removes the localStorage entry so
// the next page load doesn't bring everything back
function resetAll() {
    loot = [];
    partySize = 1;
    partySizeInput.value = "";
    localStorage.removeItem(STORAGE_KEY);
    updateUI();
}


// Utility: shows a message in the server status area with success or error styling.
// Keeps display logic out of the sync and load functions themselves.
function showServerStatus(message, isSuccess) {
    serverStatus.textContent = message;
    serverStatus.classList.remove("hidden", "status-success", "status-error");
    serverStatus.classList.add(isSuccess ? "status-success" : "status-error");
}


// Sends the current state to the server.
// This function reads state but never writes to it — no mutation, no saveState, no updateUI.
// Lifecycle: read state → build payload → POST → check response → show feedback only.
function syncToServer() {

    // Build the payload exactly as the server contract requires
    const payload = {
        studentId: STUDENT_ID,
        state: {
            loot: loot,
            partySize: partySize
        }
    };

    fetch(SERVER_BASE + "/save/" + STUDENT_ID, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(function(response) {
        // Non-200 responses count as failures — don't try to parse them as success
        if (!response.ok) {
            throw new Error("Server returned status " + response.status);
        }
        return response.json();
    })
    .then(function(data) {
        // Only show success if the server explicitly confirms with status "saved"
        if (data.status === "saved") {
            showServerStatus("State synced to server successfully.", true);
        } else {
            showServerStatus("Sync failed: unexpected server response.", false);
        }
    })
    .catch(function(error) {
        showServerStatus("Sync failed: could not reach the server.", false);
    });
}


// Loads state from the server and applies it if it passes validation.
// Lifecycle: GET → validate → assign → saveState (local) → updateUI.
// Nothing is assigned to loot or partySize until every item passes all checks.
function loadFromServer() {

    fetch(SERVER_BASE + "/load/" + STUDENT_ID)
    .then(function(response) {
        // Treat any non-200 as a hard failure — don't touch in-memory state
        if (!response.ok) {
            throw new Error("Server returned status " + response.status);
        }
        return response.json();
    })
    .then(function(data) {

        // Server has no data saved yet — stay in current state, inform the user
        if (data.status === "empty") {
            showServerStatus("No saved state found on server.", false);
            return;
        }

        // Only proceed if the server explicitly signals a successful load
        if (data.status !== "loaded") {
            showServerStatus("Load failed: unexpected server response.", false);
            return;
        }

        // Verify the top-level studentId matches so we know this data is ours
        if (data.studentId !== STUDENT_ID) {
            showServerStatus("Load failed: student ID mismatch.", false);
            return;
        }

        // Make sure the state wrapper actually exists before reaching into it
        if (typeof data.state !== "object" || data.state === null) {
            showServerStatus("Load failed: invalid state structure.", false);
            return;
        }

        // partySize must be a number and at least 1 — same rule as Phase 3
        const incomingPartySize = data.state.partySize;
        if (typeof incomingPartySize !== "number" || incomingPartySize < 1) {
            showServerStatus("Load failed: invalid party size in server data.", false);
            return;
        }

        // loot must be an array — reject outright if it isn't
        if (!Array.isArray(data.state.loot)) {
            showServerStatus("Load failed: loot data is not an array.", false);
            return;
        }

        // Validate every item before touching in-memory state.
        // Build a clean array first — only assign if everything passes.
        const validatedLoot = [];
        for (let i = 0; i < data.state.loot.length; i++) {
            const item = data.state.loot[i];

            const hasName     = typeof item.name === "string" && item.name.trim() !== "";
            const hasValue    = typeof item.value === "number" && item.value >= 0;
            const hasQuantity = typeof item.quantity === "number" && item.quantity >= 1;

            // One bad item fails the whole load — partial state is worse than stale state
            if (!hasName || !hasValue || !hasQuantity) {
                showServerStatus("Load failed: one or more loot items failed validation.", false);
                return;
            }

            validatedLoot.push({
                name:     item.name.trim(),
                value:    item.value,
                quantity: item.quantity
            });
        }

        // All checks passed — now we assign. Not before.
        loot      = validatedLoot;
        partySize = incomingPartySize;
        partySizeInput.value = partySize;

        // Save locally first, then render — same order as Phase 3 mutation lifecycle
        saveState();
        updateUI();

        showServerStatus("State loaded from server successfully.", true);
    })
    .catch(function(error) {
        showServerStatus("Load failed: could not reach the server.", false);
    });
}


// Event listeners — nothing wired in the HTML
addLootBtn.addEventListener("click", addLoot);
splitLootBtn.addEventListener("click", splitLoot);
resetAllBtn.addEventListener("click", resetAll);
syncBtn.addEventListener("click", syncToServer);
loadBtn.addEventListener("click", loadFromServer);

// Only save when the value is actually valid — don't persist a half-typed number
partySizeInput.addEventListener("input", function() {
    partyError.textContent = "";

    const val = parseInt(partySizeInput.value, 10);

    if (partySizeInput.value !== "" && (isNaN(val) || val < 1)) {
        partyError.textContent = "Party size must be at least 1.";
    } else if (!isNaN(val) && val >= 1) {
        partySize = val;
        saveState();
    }

    updateUI();
});

// Enter works from any of the three loot fields
lootNameInput.addEventListener("keydown",     function(e) { if (e.key === "Enter") addLoot(); });
lootValueInput.addEventListener("keydown",    function(e) { if (e.key === "Enter") addLoot(); });
lootQuantityInput.addEventListener("keydown", function(e) { if (e.key === "Enter") addLoot(); });


// Restore before rendering so the first updateUI call has real data to work with
restoreState();
updateUI();
