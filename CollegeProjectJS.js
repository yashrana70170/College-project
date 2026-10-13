// Group Trip Settle-Up - Core JavaScript Logic

const DEFAULT_MEMBERS = ["Yash", "Rahul", "Aman"];

// Load members from localStorage or use defaults
function getMembers() {
    const stored = localStorage.getItem("members");
    if (!stored) {
        localStorage.setItem("members", JSON.stringify(DEFAULT_MEMBERS));
        return DEFAULT_MEMBERS;
    }
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MEMBERS;
    } catch (e) {
        return DEFAULT_MEMBERS;
    }
}

// Save members
function saveMembers(members) {
    localStorage.setItem("members", JSON.stringify(members));
}

// Load expenses from localStorage
function getExpenses() {
    try {
        return JSON.parse(localStorage.getItem("expenses")) || [];
    } catch (e) {
        return [];
    }
}

// Save expenses
function saveExpenses(expenses) {
    localStorage.setItem("expenses", JSON.stringify(expenses));
}

// Toast notification helper
function showToast(message, type = "info") {
    let toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.id = "toast-container";
        toastContainer.className = "toast-container";
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("show");
    }, 10);

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Populate Member Dropdown in forms
function populateMemberDropdown() {
    const personSelect = document.getElementById("person");
    if (!personSelect) return;

    const members = getMembers();
    const currentVal = personSelect.value;
    personSelect.replaceChildren();

    members.forEach(member => {
        const opt = document.createElement("option");
        opt.value = member;
        opt.textContent = member;
        personSelect.appendChild(opt);
    });

    if (members.includes(currentVal)) {
        personSelect.value = currentVal;
    }
}

// Add Expense handler
function addExpense() {
    const nameInput = document.getElementById("name");
    const amountInput = document.getElementById("amount");
    const personInput = document.getElementById("person");

    if (!nameInput || !amountInput || !personInput) return;

    const name = nameInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const person = personInput.value;

    if (!name) {
        showToast("Please enter an expense title / description", "error");
        nameInput.focus();
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        showToast("Please enter a valid amount greater than 0", "error");
        amountInput.focus();
        return;
    }

    const newExpense = {
        id: Date.now().toString(),
        name: name,
        amount: Math.round(amount * 100) / 100,
        person: person,
        date: new Date().toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short"
        })
    };

    const expenses = getExpenses();
    expenses.push(newExpense);
    saveExpenses(expenses);

    showToast(`Added ₹${amount.toFixed(2)} for "${name}"`, "success");

    // If on main page, refresh UI
    if (document.getElementById("expenses")) {
        renderDashboard();
        nameInput.value = "";
        amountInput.value = "";
        nameInput.focus();
    } else {
        // If on secondary page, redirect to index
        setTimeout(() => {
            window.location.href = "index.html";
        }, 600);
    }
}

// Delete single expense
function deleteExpense(id) {
    let expenses = getExpenses();
    const target = expenses.find(e => e.id === id);
    expenses = expenses.filter(e => e.id !== id);
    saveExpenses(expenses);

    if (target) {
        showToast(`Deleted "${target.name}"`, "info");
    }
    renderDashboard();
}

// Clear all expenses
function clearAllExpenses() {
    const expenses = getExpenses();
    if (expenses.length === 0) {
        showToast("No expenses to clear", "info");
        return;
    }

    if (confirm("Are you sure you want to clear all expenses? This cannot be undone.")) {
        saveExpenses([]);
        showToast("All expenses have been cleared", "info");
        renderDashboard();
    }
}

// Add new member
function addMember() {
    const newMemberInput = document.getElementById("new-member-name");
    if (!newMemberInput) return;

    const name = newMemberInput.value.trim();
    if (!name) {
        showToast("Please enter a member name", "error");
        return;
    }

    const members = getMembers();
    if (members.some(m => m.toLowerCase() === name.toLowerCase())) {
        showToast(`${name} is already in the group!`, "error");
        return;
    }

    members.push(name);
    saveMembers(members);
    newMemberInput.value = "";
    showToast(`Added ${name} to group`, "success");

    populateMemberDropdown();
    renderDashboard();
}

// Compute Settlements using greedy debt simplification algorithm
function calculateSettlements(expenses, members) {
    if (members.length === 0) return { settlements: [], balances: {}, totalExpense: 0, perPersonShare: 0 };

    // 1. Calculate total paid by each member
    const paidByMember = {};
    members.forEach(m => paidByMember[m] = 0);

    let totalExpense = 0;
    expenses.forEach(e => {
        totalExpense += e.amount;
        if (paidByMember[e.person] !== undefined) {
            paidByMember[e.person] += e.amount;
        } else {
            // In case an expense was logged for a member not in members list
            paidByMember[e.person] = e.amount;
            if (!members.includes(e.person)) {
                members.push(e.person);
            }
        }
    });

    const activeMemberCount = members.length;
    const perPersonShare = activeMemberCount > 0 ? (totalExpense / activeMemberCount) : 0;

    // 2. Net balances (Positive = creditor/gets money back, Negative = debtor/owes money)
    const balances = {};
    members.forEach(m => {
        balances[m] = Math.round((paidByMember[m] - perPersonShare) * 100) / 100;
    });

    // 3. Greedy algorithm to resolve debts with minimal transactions
    const debtors = [];
    const creditors = [];

    members.forEach(m => {
        const bal = balances[m];
        if (bal < -0.01) {
            debtors.push({ name: m, amount: -bal });
        } else if (bal > 0.01) {
            creditors.push({ name: m, amount: bal });
        }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const settlements = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
        const debtor = debtors[dIdx];
        const creditor = creditors[cIdx];

        const settledAmount = Math.min(debtor.amount, creditor.amount);

        if (settledAmount > 0.01) {
            settlements.push({
                from: debtor.name,
                to: creditor.name,
                amount: Math.round(settledAmount * 100) / 100
            });
        }

        debtor.amount -= settledAmount;
        creditor.amount -= settledAmount;

        if (debtor.amount <= 0.01) dIdx++;
        if (creditor.amount <= 0.01) cIdx++;
    }

    return {
        settlements,
        balances,
        paidByMember,
        totalExpense: Math.round(totalExpense * 100) / 100,
        perPersonShare: Math.round(perPersonShare * 100) / 100
    };
}

// Render Dashboard (Expenses, Stats, Member Balances, Settlement)
function renderDashboard() {
    const expensesContainer = document.getElementById("expenses");
    if (!expensesContainer) return;

    const expenses = getExpenses();
    const members = getMembers();
    const data = calculateSettlements(expenses, members);

    // Update Overview Stats
    const totalEl = document.getElementById("total-spent");
    const shareEl = document.getElementById("per-person-share");
    const countEl = document.getElementById("expense-count");

    if (totalEl) totalEl.textContent = `₹${data.totalExpense.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (shareEl) shareEl.textContent = `₹${data.perPersonShare.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (countEl) countEl.textContent = expenses.length.toString();

    // Render Expenses List
    expensesContainer.replaceChildren();

    if (expenses.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        emptyState.innerHTML = `
            <div class="empty-icon">💸</div>
            <p class="empty-title">No expenses recorded yet</p>
            <p class="empty-desc">Add trip expenses using the form above to see splits & settlements.</p>
        `;
        expensesContainer.appendChild(emptyState);
    } else {
        expenses.slice().reverse().forEach(exp => {
            const item = document.createElement("div");
            item.className = "expense-card";
            item.innerHTML = `
                <div class="expense-info">
                    <div class="expense-title-row">
                        <span class="expense-name">${escapeHtml(exp.name)}</span>
                        <span class="expense-badge">${escapeHtml(exp.person)}</span>
                    </div>
                    <span class="expense-meta">${exp.date ? exp.date : "Trip Expense"}</span>
                </div>
                <div class="expense-action-row">
                    <span class="expense-amount">₹${exp.amount.toFixed(2)}</span>
                    <button class="delete-btn" title="Delete expense" onclick="deleteExpense('${exp.id}')">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
            expensesContainer.appendChild(item);
        });
    }

    // Render Member Breakdown Cards
    const memberBreakdown = document.getElementById("member-breakdown");
    if (memberBreakdown) {
        memberBreakdown.replaceChildren();
        members.forEach(m => {
            const paid = data.paidByMember[m] || 0;
            const bal = data.balances[m] || 0;
            const isCreditor = bal > 0.01;
            const isDebtor = bal < -0.01;

            const card = document.createElement("div");
            card.className = "member-chip";
            card.innerHTML = `
                <div class="member-header">
                    <span class="member-avatar">${m.charAt(0).toUpperCase()}</span>
                    <div>
                        <div class="member-name">${escapeHtml(m)}</div>
                        <div class="member-paid">Paid: ₹${paid.toFixed(2)}</div>
                    </div>
                </div>
                <div class="member-status ${isCreditor ? 'status-gets' : isDebtor ? 'status-owes' : 'status-settled'}">
                    ${isCreditor ? `Gets ₹${bal.toFixed(2)}` : isDebtor ? `Owes ₹${(-bal).toFixed(2)}` : 'Settled'}
                </div>
            `;
            memberBreakdown.appendChild(card);
        });
    }

    // Render Settlements Section
    const settlementContainer = document.getElementById("settlement-list");
    if (settlementContainer) {
        settlementContainer.replaceChildren();

        if (expenses.length === 0) {
            const emptySettlement = document.createElement("div");
            emptySettlement.className = "settlement-empty";
            emptySettlement.textContent = "Add your expenses above to generate instant settlement paths.";
            settlementContainer.appendChild(emptySettlement);
        } else if (data.settlements.length === 0) {
            const allSettled = document.createElement("div");
            allSettled.className = "all-settled-card";
            allSettled.innerHTML = `
                <span class="settled-icon">🎉</span>
                <div>
                    <strong>All Balanced!</strong>
                    <p>Everyone in the group has paid an equal share.</p>
                </div>
            `;
            settlementContainer.appendChild(allSettled);
        } else {
            data.settlements.forEach(s => {
                const row = document.createElement("div");
                row.className = "settlement-card";
                row.innerHTML = `
                    <div class="settlement-route">
                        <span class="person-tag debtor">${escapeHtml(s.from)}</span>
                        <span class="arrow-indicator">
                            <span class="arrow-text">pays</span>
                            <svg width="20" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </span>
                        <span class="person-tag creditor">${escapeHtml(s.to)}</span>
                    </div>
                    <div class="settlement-amount">₹${s.amount.toFixed(2)}</div>
                `;
                settlementContainer.appendChild(row);
            });
        }
    }
}

// Utility: HTML escaping
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
    populateMemberDropdown();

    const addBtn = document.getElementById("add-expense-button");
    if (addBtn) {
        addBtn.addEventListener("click", addExpense);
    }

    // Allow Enter key to submit on inputs
    const nameInput = document.getElementById("name");
    const amountInput = document.getElementById("amount");
    [nameInput, amountInput].forEach(inp => {
        if (inp) {
            inp.addEventListener("keypress", (e) => {
                if (e.key === "Enter") addExpense();
            });
        }
    });

    const addMemberBtn = document.getElementById("add-member-btn");
    if (addMemberBtn) {
        addMemberBtn.addEventListener("click", addMember);
    }

    const newMemberInput = document.getElementById("new-member-name");
    if (newMemberInput) {
        newMemberInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") addMember();
        });
    }

    const clearBtn = document.getElementById("clear-expenses-btn");
    if (clearBtn) {
        clearBtn.addEventListener("click", clearAllExpenses);
    }

    // Render if on dashboard
    if (document.getElementById("expenses")) {
        renderDashboard();
    }
});