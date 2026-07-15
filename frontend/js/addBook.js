const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

const API_BOOKS = "http://127.0.0.1:5000/books";

const fields = {
    title: document.getElementById("title"),
    author: document.getElementById("author"),
    price: document.getElementById("price"),
    condition_text: document.getElementById("condition_text"),
    category: document.getElementById("category"),
    description: document.getElementById("description"),
    imageInput: document.getElementById("imageInput"),
    preview: document.getElementById("preview")
};

fields.imageInput.addEventListener("change", () => {
    const file = fields.imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => fields.preview.src = e.target.result;
    reader.readAsDataURL(file);
});

async function addBook() {
    if (!fields.title.value.trim()) return alert("Title is required");
    if (!fields.price.value.trim() || isNaN(fields.price.value)) return alert("Price must be a number");

    const formData = new FormData();
    formData.append("title", fields.title.value.trim());
    formData.append("author", fields.author.value.trim());
    formData.append("price", parseFloat(fields.price.value));
    formData.append("condition_text", fields.condition_text.value);
    formData.append("category", fields.category.value.trim() || "General");
    formData.append("description", fields.description.value.trim());
    formData.append("user_id", user.id);
    if (fields.imageInput.files[0]) formData.append("image", fields.imageInput.files[0]);

    try {
        const res = await fetch(API_BOOKS, { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) return alert(data.message || "Failed to add book");
        alert("Book added successfully!");
        window.location.replace("index.html");
    } catch (err) { console.error(err); alert("Failed to add book"); }
}
