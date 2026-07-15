window.addEventListener("pageshow", () => {
    if (!localStorage.getItem("user")) window.location.href = "login.html";
});

const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

document.getElementById("userName").innerText = "Hi, " + user.username;

const BASE_URL   = "http://127.0.0.1:5000";
const API_BOOKS  = `${BASE_URL}/books`;
const API_CART   = `${BASE_URL}/cart`;

let books = [];
let cartItems = [];

const container = document.getElementById("books-container");
const search    = document.getElementById("search");

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

async function loadCart() {
    try {
        cartItems = await fetch(`${API_CART}/${user.id}`).then(r => r.json()) || [];
        const el = document.getElementById("cart-count");
        if (el) el.innerText = cartItems.length;
    } catch (err) { console.error("Cart load error", err); }
}

async function addToCart(bookId, btn) {
    if (cartItems.some(i => i.book_id === bookId)) {
        btn.innerText = "Added"; btn.disabled = true; return;
    }
    try {
        const res = await fetch(API_CART, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id, book_id: bookId })
        });
        if (!res.ok) throw new Error((await res.json()).message);
        btn.innerText = "Added ✔"; btn.disabled = true;
        cartItems.push({ book_id: bookId });
        const el = document.getElementById("cart-count");
        if (el) el.innerText = cartItems.length;
    } catch (err) { console.error(err); alert("Error adding to cart"); }
}

async function loadBooks() {
    try {
        const res = await fetch(API_BOOKS);
        if (!res.ok) throw new Error("Cannot fetch books");
        books = await res.json();
        displayBooks(books);
    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Cannot connect to backend</p>";
    }
}

function displayBooks(data) {
    container.innerHTML = "";
    if (!data?.length) { container.innerHTML = "<p>No books found</p>"; return; }

    const grouped = {};
    data.forEach(b => { (grouped[b.category || "Others"] ??= []).push(b); });

    Object.entries(grouped).forEach(([category, list]) => {
        const section = document.createElement("div");
        section.innerHTML = `<h2 style="margin:20px 0;">${category}</h2><div class="category-row"></div>`;
        const row = section.querySelector(".category-row");

        list.forEach(book => {
            const card = document.createElement("div");
            card.className = "book-card";
            const inCart = cartItems.some(i => i.book_id === book.id);
            const showDelete = user.role === "admin" || book.user_id === user.id;

            card.innerHTML = `
                <img src="${book.image ? BASE_URL + book.image : "https://via.placeholder.com/150"}">
                <div class="book-info">
                    <h3>${book.title}</h3>
                    <p>${book.author || "Unknown"}</p>
                    <p>₹${book.price || 0}</p>
                    ${book.user_id !== user.id
                        ? `<button class="cart-btn"${inCart ? " disabled" : ""}>${inCart ? "Added ✔" : "🛒 Add to Cart"}</button>`
                        : ""}
                    ${showDelete ? `<button class="delete-btn">Delete</button>` : ""}
                    ${book.user_id === user.id ? `<button class="edit-btn">Edit</button>` : ""}
                </div>`;

            card.addEventListener("click", e => {
                if (!["delete-btn","edit-btn","cart-btn"].some(c => e.target.classList.contains(c)))
                    openBook(book.id);
            });

            card.querySelector(".delete-btn")?.addEventListener("click", e => {
                e.stopPropagation(); deleteBook(book.id);
            });
            card.querySelector(".edit-btn")?.addEventListener("click", e => {
                e.stopPropagation();
                localStorage.setItem("editBookId", book.id);
                window.location.href = "editBook.html";
            });
            card.querySelector(".cart-btn")?.addEventListener("click", e => {
                e.stopPropagation(); addToCart(book.id, e.target);
            });

            row.appendChild(card);
        });
        container.appendChild(section);
    });
}

function openBook(id) {
    localStorage.setItem("selectedBookId", id);
    window.location.href = "book.html";
}

search.addEventListener("input", () => {
    const v = search.value.toLowerCase();
    displayBooks(books.filter(b =>
        (b.title || "").toLowerCase().includes(v) ||
        (b.author || "").toLowerCase().includes(v)
    ));
});

async function deleteBook(id) {
    if (!confirm("Delete this book?")) return;
    try {
        const res = await fetch(`${API_BOOKS}/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.message || "Cannot delete book");
        alert("Book deleted!"); loadBooks();
    } catch (err) { console.error(err); alert("Failed to delete book"); }
}

function loadMyBooks() {
    fetch(`${API_BOOKS}?user_id=${user.id}`)
        .then(r => r.json()).then(displayBooks);
}

async function updateUser(e) {
    e.preventDefault();
    const username = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value.trim();
    await fetch(`${BASE_URL}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentUserId: user.id, username, password })
    });
    alert("Updated successfully. Logging out...");
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

async function deleteUser() {
    if (!confirm("Delete account?")) return;
    try {
        const res = await fetch(`${BASE_URL}/users/${user.id}?currentUserId=${user.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        alert(data.message);
        localStorage.clear(); location.href = "login.html";
    } catch (err) { console.error(err); alert("Delete failed"); }
}

function toggleMenu() {
    document.getElementById("sideMenu").classList.toggle("active");
    document.getElementById("overlay").classList.toggle("active");
}

function goTo(page) {
    toggleMenu();
    if (page === "books") loadMyBooks();
    else if (page === "cart") window.location.href = "cart.html";
    else if (page === "orders") window.location.href = "orders.html";
}

if (document.getElementById("menuUserName"))
    document.getElementById("menuUserName").innerText = user.username;

(async () => { await loadCart(); loadBooks(); })();
