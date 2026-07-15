const user = JSON.parse(localStorage.getItem("user"));
if (!user || user.role !== "admin") window.location.href = "index.html";

document.getElementById("adminName").innerText = "Admin: " + (user.username || "Unknown");

const API = "http://127.0.0.1:5000";
let allUsers = [], allBooks = [], allOrders = [];

async function loadData() {
    try {
        [allUsers, allBooks, allOrders] = await Promise.all([
            fetch(`${API}/users`).then(r => r.ok ? r.json() : []),
            fetch(`${API}/books`).then(r => r.ok ? r.json() : []),
            fetch(`${API}/orders`).then(r => r.ok ? r.json() : [])
        ]);
        document.getElementById("userCount").innerText = "👥 " + allUsers.length;
        document.getElementById("bookCount").innerText = "📚 " + allBooks.length;
        renderUsers(); renderBooks(); renderOrders();
    } catch (err) { console.error("Error loading data:", err); }
}

function renderUsers() {
    const search = (document.getElementById("searchUser").value || "").toLowerCase();
    const role   = document.getElementById("filterRole").value;

    const filtered = allUsers.filter(u =>
        (u.username || "").toLowerCase().includes(search) &&
        (!role || u.role === role)
    );

    const badgeStyle = (bg, color) =>
        `style="background:${bg};color:${color};padding:2px 8px;border-radius:12px;font-size:12px;margin-left:5px;"`;

    document.getElementById("users").innerHTML = filtered.map(u => `
        <div class="user-card">
            <h3>${u.username || "Unknown"}
                ${u.id === user.id ? `<span ${badgeStyle("#2196f3","white")}>You</span>` : ""}
            </h3>
            <p>${u.email || "No email"}</p>
            <p><b>${u.role || "user"}</b>
                ${u.role === "admin" ? `<span ${badgeStyle("#e53935","white")}>Admin</span>` : ""}
            </p>
            ${u.role !== "admin" ? `
                <button onclick="makeAdmin(${u.id})">Make Admin</button>
                <button onclick="deleteUser(${u.id})">Delete</button>` : ""}
        </div>
    `).join("") || "<p>No users found.</p>";
}

function renderBooks() {
    const search = (document.getElementById("searchBook").value || "").toLowerCase();
    const cat    = document.getElementById("filterCategory").value;

    const filtered = allBooks.filter(b =>
        (b.title || "").toLowerCase().includes(search) &&
        (cat === "All Categories" || b.category === cat)
    );

    document.getElementById("books").innerHTML = filtered.map(b => `
        <div class="book-card" onclick="openBook(${b.id})" style="cursor:pointer;">
            <img src="${API}${b.image || ''}" alt="${b.title || 'Book'}">
            <div class="book-info">
                <h3>${b.title || "Untitled"}</h3>
                <p>${b.author || "Unknown"}</p>
                <p class="price">₹${b.price ?? 0}</p>
                <span class="badge">${b.category || "General"}</span>
                <p>Status: <b>${b.status || "available"}</b></p>
                ${b.status !== "sold" ? `
                    <button onclick="event.stopPropagation(); deleteBook(${b.id})">Delete</button>` : ""}
            </div>
        </div>
    `).join("") || "<p>No books found.</p>";
}

function renderOrders() {
    const container = document.getElementById("orders-container");
    if (!allOrders.length) {
        container.innerHTML = "<p>No orders yet.</p>";
        return;
    }

    const groups = {
        "🟡 Pending Orders":   { status: "pending",   cls: "status-pending",   list: [] },
        "🟢 Delivered Orders": { status: "delivered", cls: "status-delivered", list: [] },
        "🔴 Cancelled Orders": { status: "cancelled", cls: "status-cancelled", list: [] }
    };

    allOrders.forEach(o => {
        const g = Object.values(groups).find(g => g.status === o.status);
        if (g) g.list.push(o);
    });

    container.innerHTML = Object.entries(groups)
        .filter(([, g]) => g.list.length)
        .map(([title, g]) => `
            <div style="margin-bottom:30px;">
                <h2>${title}</h2>
                <div style="display:flex;flex-direction:column;gap:15px;">
                    ${g.list.map(o => `
                        <div class="book-card ${o.status}" style="width:100%;">
                            <h3>Order #${o.order_id}</h3>
                            <p><b>User:</b> ${o.user_username}</p>
                            <p><span class="${g.cls}">${o.status}</span></p>
                            ${(o.items || []).map(i => `
                                <div>${i.title || "Unknown"} — ₹${i.price || 0}
                                    <small>(Seller: ${i.seller || "Unknown"})</small>
                                </div>`).join("")}
                            ${o.status === "pending" ? `
                                <div style="margin-top:8px;">
                                    <button onclick="updateOrder(${o.order_id},'cancel')">Cancel</button>
                                    <button onclick="updateOrder(${o.order_id},'deliver')">Deliver</button>
                                </div>` : ""}
                        </div>
                    `).join("")}
                </div>
            </div>
        `).join("");
}

function openBook(id) {
    localStorage.setItem("selectedBookId", id); 
    window.location.href = "book.html";
}

function updateOrder(id, action) {
    fetch(`${API}/orders/${id}/${action}`, { method: "PUT" })
        .then(res => res.ok ? loadData() : res.json().then(r => console.error(r.message)))
        .catch(err => console.error(`Order ${action} error:`, err));
}

function deleteUser(targetId) {
    fetch(`${API}/users/${targetId}?currentUserId=${user.id}`, { method: "DELETE" })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert(data.message);
            loadData();
        })
        .catch(err => {
            console.error(err);
            alert("Delete failed");
        });
}

function makeAdmin(id) {
    fetch(`${API}/users/${id}/make-admin`, { method: "PUT" })
        .then(loadData)
        .catch(err => console.error("Make admin error:", err));
}

function deleteBook(id) {
    if (!confirm("Delete book?")) return;

    fetch(`${API}/books/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id })
    })
    .then(loadData)
    .catch(err => console.error("Delete book error:", err));
}

document.getElementById("searchUser").addEventListener("input", renderUsers);
document.getElementById("filterRole").addEventListener("change", renderUsers);
document.getElementById("searchBook").addEventListener("input", renderBooks);
document.getElementById("filterCategory").addEventListener("change", renderBooks);

function showSection(section) {
    ["users","books","orders"].forEach(s => {
        document.getElementById(`${s}-section`).style.display = s === section ? "block" : "none";
    });

    document.getElementById("user-controls").style.display = section === "users" ? "flex" : "none";
    document.getElementById("book-controls").style.display = section === "books" ? "flex" : "none";
}

function goHome() {
    document.getElementById("users-section").style.display  = "block";
    document.getElementById("books-section").style.display  = "block";
    document.getElementById("orders-section").style.display = "none";
    document.getElementById("user-controls").style.display  = "flex";
    document.getElementById("book-controls").style.display  = "flex";
}

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

goHome();
loadData();
