const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

const API = "http://127.0.0.1:5000";
let cartData = [];

async function loadCart() {
    cartData = await fetch(`${API}/cart/${user.id}`).then(r => r.json());
    renderCart();
}

function renderCart() {
    const container = document.getElementById("cartItems");
    if (!cartData.length) {
        container.innerHTML = "<p>Your cart is empty</p>";
        document.getElementById("totalBox").innerText = "Total: ₹0";
        return;
    }
    let total = 0;
    container.innerHTML = cartData.map(item => {
        total += Number(item.price || 0);
        return `
            <div class="cart-card">
                <img src="${API}${item.image || ''}">
                <h3>${item.title}</h3>
                <p>${item.author || "Unknown"}</p>
                <p><b>₹${item.price}</b></p>
                <button onclick="removeItem(${item.cart_id})">🗑 Remove</button>
            </div>`;
    }).join("");
    document.getElementById("totalBox").innerText = "Total: ₹" + total;
}

function removeItem(id) {
    fetch(`${API}/cart/${id}`, { method: "DELETE" }).then(loadCart);
}

function checkout() {
    if (!cartData.length) return alert("Cart is empty!");
    fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id })
    })
    .then(r => r.json())
    .then(d => {
        alert(d.message);
        window.location.href = "orders.html";
    });
}

loadCart();
