const API = "http://127.0.0.1:5000";
const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

const container = document.getElementById("orders-container");

function logout() { localStorage.removeItem("user"); window.location.href = "login.html"; }

async function loadOrders() {
    try {
        const res = await fetch(`${API}/orders/user/${user.id}`);
        if (!res.ok) throw new Error("Cannot fetch orders");
        const orders = await res.json();

        if (!orders.length) { container.innerHTML = "<p>No orders yet.</p>"; return; }

        const groups = {
            pending:   { label: "🟡 Pending Orders",   cls: "status-pending",   list: [] },
            delivered: { label: "🟢 Delivered Orders",  cls: "status-delivered", list: [] },
            cancelled: { label: "🔴 Cancelled Orders",  cls: "status-cancelled", list: [] }
        };
        orders.forEach(o => groups[o.status]?.list.push(o));

        container.innerHTML = Object.values(groups)
            .filter(g => g.list.length)
            .map(g => `
                <div style="margin-bottom:35px;">
                    <h2>${g.label}</h2>
                    <div class="horizontal-orders">
                        ${g.list.map(order => `
                            <div class="book-card" style="padding:15px;min-width:280px;flex-shrink:0;">
                                <h3>Order #${order.order_id}</h3>
                                <p><b>Date:</b> ${new Date(order.created_at).toLocaleString()}</p>
                                <p><b>Total:</b> ₹${parseFloat(order.total).toFixed(2)}</p>
                                <p><span class="${g.cls}">${order.status}</span></p>
                                <hr>
                                ${order.items?.length
                                    ? order.items.map(i => `
                                        <div style="margin-bottom:8px;">
                                            📚 ${i.title || "Unknown"} — ₹${parseFloat(i.price).toFixed(2)}
                                            <br><small>Seller: ${i.seller || "Unknown"}</small>
                                        </div>`).join("")
                                    : "<p>No items</p>"}
                                ${order.status === "pending" ? `
                                    <button onclick="cancelOrder(${order.order_id})">Cancel</button>
                                    <button onclick="payOrder(${order.order_id})">Pay</button>` : ""}
                            </div>`).join("")}
                    </div>
                </div>`).join("");
    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error loading orders</p>";
    }
}

async function cancelOrder(id) {
    if (!confirm("Cancel this order?")) return;
    await fetch(`${API}/orders/${id}/cancel`, { method: "PUT" });
    loadOrders();
}

async function payOrder(id) {
    alert("Payment Successful!");
    await fetch(`${API}/orders/${id}/deliver`, { method: "PUT" });
    loadOrders();
}

loadOrders();
