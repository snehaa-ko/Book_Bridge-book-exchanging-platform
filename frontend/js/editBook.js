const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

const API_BASE  = "http://127.0.0.1:5000";
const API_BOOKS = `${API_BASE}/books`;

const bookId = localStorage.getItem("editBookId");
if (!bookId) { alert("No book selected!"); window.location.href = "index.html"; }

const f = {
    title:          document.getElementById("title"),
    author:         document.getElementById("author"),
    price:          document.getElementById("price"),
    condition_text: document.getElementById("condition_text"),
    category:       document.getElementById("category"),
    description:    document.getElementById("description"),
    imageInput:     document.getElementById("imageInput"),
    preview:        document.getElementById("preview")
};

let oldImage = "";

async function loadBook() {
    try {
        const book = await fetch(`${API_BOOKS}/${bookId}`).then(r => r.json());
        f.title.value          = book.title          || "";
        f.author.value         = book.author         || "";
        f.price.value          = book.price          || "";
        f.condition_text.value = book.condition_text || "";
        f.category.value       = book.category       || "";
        f.description.value    = book.description    || "";
        oldImage  = book.image || "";
        f.preview.src = book.image ? API_BASE + book.image : "https://via.placeholder.com/150";
    } catch (err) { console.error(err); alert("Failed to load book"); }
}

f.imageInput.addEventListener("change", () => {
    const file = f.imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => f.preview.src = e.target.result;
    reader.readAsDataURL(file);
});

async function updateBook() {
    if (!f.title.value.trim()) return alert("Title is required");
    if (!f.price.value.trim() || isNaN(f.price.value)) return alert("Price must be a number");

    const formData = new FormData();
    formData.append("title",          f.title.value.trim());
    formData.append("author",         f.author.value.trim());
    formData.append("price",          parseFloat(f.price.value));
    formData.append("condition_text", f.condition_text.value);
    formData.append("category",       f.category.value.trim() || "General");
    formData.append("description",    f.description.value.trim());
    formData.append("user_id",        user.id);
    formData.append("image",          oldImage);
    if (f.imageInput.files[0]) formData.set("image", f.imageInput.files[0]);

    try {
        const res = await fetch(`${API_BOOKS}/${bookId}`, { method: "PUT", body: formData });
        const data = await res.json();
        if (!res.ok) return alert(data.message || "Update failed");
        alert("Book updated successfully!");
        window.location.replace("index.html");
    } catch (err) { console.error(err); alert("Failed to update book"); }
}

loadBook();
