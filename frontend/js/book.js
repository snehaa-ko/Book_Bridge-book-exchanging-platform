window.addEventListener("pageshow", () => {
    if (!localStorage.getItem("user")) window.location.href = "login.html";
});

const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

document.getElementById("userName").innerText = "Hi, " + user.username;

const API_BASE     = "http://127.0.0.1:5000";
const API_BOOKS    = `${API_BASE}/books`;
const API_COMMENTS = `${API_BASE}/comments`;
const API_RATINGS  = `${API_BASE}/ratings`;

const bookId = localStorage.getItem("selectedBookId");
if (!bookId) { alert("No book selected!"); window.location.href = "index.html"; }

let replyTo = null;

function logout() { localStorage.removeItem("user"); window.location.href = "login.html"; }

// BOOK 
async function loadBook() {
    try {
        const res = await fetch(`${API_BOOKS}/${bookId}`);
        if (!res.ok) throw new Error("Book not found");
        const book = await res.json();
        const img = book.image ? API_BASE + book.image : "https://via.placeholder.com/150";

        document.getElementById("bookDetails").innerHTML = `
            <img src="${img}" onerror="this.src='https://via.placeholder.com/150'">
            <div class="book-info">
                <h2>${book.title || "No Title"}</h2>
                <p><b>Author:</b> ${book.author || "Unknown"}</p>
                <p><b>Price:</b> ₹${book.price || 0}</p>
                <p><b>Condition:</b> ${book.condition_text || "N/A"}</p>
                <p><b>Category:</b> ${book.category || "General"}</p>
                <button onclick="addToCart(${book.id})">Add to Cart</button>
            </div>`;

        document.getElementById("heroImage").src = img;
        document.getElementById("descText").innerText = book.description || "No description available.";
        document.getElementById("sellerInfo").innerText = "Uploaded by: " + (book.owner || "User");
    } catch (err) {
        console.error(err);
        document.getElementById("bookDetails").innerHTML = "<p>Failed to load book details</p>";
    }
}

// COMMENTS
function renderComments(comments, parent = null) {
    return comments
        .filter(c => (c.parent_id || null) == parent)
        .map(c => `
            <div class="comment">
                <p><b>${c.username || "User"}:</b> ${c.text}</p>
                <small>
                    👍 ${c.likes ?? 0} 👎 ${c.dislikes ?? 0}<br>
                    <button onclick="voteComment(${c.id},'like')">Like</button>
                    <button onclick="voteComment(${c.id},'dislike')">Dislike</button>
                    <button onclick="replyComment(${c.id})">Reply</button>
                    ${c.user_id === user.id ? `<button onclick="editComment(${c.id},\`${c.text}\`)">Edit</button>` : ""}
                </small>
                <div class="replies">${renderComments(comments, c.id)}</div>
            </div>`).join("");
}

async function loadComments() {
    try {
        const data = await fetch(`${API_COMMENTS}/${bookId}`).then(r => r.json());
        document.getElementById("commentsList").innerHTML =
            data.length ? renderComments(data) : "<p>No comments yet.</p>";
    } catch (err) {
        console.error(err);
        document.getElementById("commentsList").innerHTML = "<p>Cannot load comments</p>";
    }
}

async function addComment() {
    const input = document.getElementById("commentInput");
    if (!input.value.trim()) return;
    try {
        await fetch(API_COMMENTS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ book_id: bookId, user_id: user.id, text: input.value, parent_id: replyTo })
        });
        input.value = ""; replyTo = null;
        await loadComments();
    } catch (err) { console.error(err); alert("Failed to post comment"); }
}

function replyComment(id) { replyTo = id; document.getElementById("commentInput").focus(); }

async function editComment(id, oldText) {
    const newText = prompt("Edit your comment:", oldText);
    if (!newText?.trim()) return;
    try {
        const res = await fetch(`${API_COMMENTS}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: newText.trim(), user_id: user.id })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.message);
        await loadComments();
    } catch (err) { console.error(err); alert("Failed to edit comment"); }
}

async function voteComment(id, type) {
    try {
        await fetch(`${API_COMMENTS}/${id}/vote`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id, vote: type })
        });
        await loadComments();
    } catch (err) { console.error(err); }
}

// RATINGS 
async function loadRating() {
    try {
        const data = await fetch(`${API_RATINGS}/${bookId}?user_id=${user.id}`).then(r => r.json());
        const avg = parseFloat(data.avg) || 0;
        document.getElementById("avgRating").innerText = `Average Rating: ${avg.toFixed(1)}`;
        highlightStars(data.userRating || 0);

        let userText = document.getElementById("userRatingText");
        if (!userText) {
            userText = Object.assign(document.createElement("p"), { id: "userRatingText" });
            document.getElementById("ratingSection").appendChild(userText);
        }
        userText.innerText = data.userRating ? `Your rating: ${data.userRating} ⭐` : "You have not rated yet";
    } catch (err) { console.error(err); }
}

async function rate(value) {
    try {
        await fetch(API_RATINGS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ book_id: bookId, user_id: user.id, rating: value })
        });
        highlightStars(value); await loadRating();
    } catch (err) { console.error(err); alert("Failed to rate book"); }
}

function highlightStars(value) {
    document.querySelectorAll("#stars span").forEach((s, i) => s.classList.toggle("active", i < value));
}

// CART 
function addToCart(id) {
    fetch(`${API_BASE}/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, book_id: id })
    }).then(r => r.json()).then(d => alert(d.message)).catch(() => alert("Error adding to cart"));
}

loadBook(); loadComments(); loadRating();
