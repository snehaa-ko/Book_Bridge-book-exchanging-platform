const express = require("express");
const cors = require("cors");
const db = require("./db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 5000;
const uploadFolder = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadFolder),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        ["image/jpeg", "image/png", "image/jpg"].includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error("Only images allowed"));
    }
});

app.use("/uploads", express.static(uploadFolder));

const isEmpty = v => !v || v.trim() === "";

const dbErr = (res, err) => res.status(500).json({ message: err.sqlMessage });

// Authentication
app.post("/users/register", async (req, res) => {
    let { username, email, password, role } = req.body;
    if (isEmpty(username) || isEmpty(password))
        return res.status(400).json({ message: "Required fields missing" });
    if (!email) email = `${username}_${Date.now()}@temp.com`;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const safeRole = role === "admin" ? "admin" : "user";
        db.query(
            "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
            [username, email, hashedPassword, safeRole],
            (err, result) => err ? dbErr(res, err) : res.json({ message: "Registered", id: result.insertId })
        );
    } catch { res.status(500).json({ message: "Error hashing password" }); }
});

app.post("/users/login", (req, res) => {
    const { username, password, role } = req.body;
    db.query(
        "SELECT * FROM users WHERE username=? OR email=?",
        [username, username],
        async (err, result) => {
            if (err) return dbErr(res, err);
            if (!result.length) return res.status(401).json({ message: "Invalid credentials" });
            const user = result[0];
            if (!await bcrypt.compare(password, user.password))
                return res.status(401).json({ message: "Invalid credentials" });
            if (role && user.role !== role)
                return res.status(403).json({ message: "Wrong role selected" });
            res.json(user);
        }
    );
});

app.get("/users", (req, res) => {
    db.query("SELECT id, username, email, role FROM users", (err, result) =>
        err ? dbErr(res, err) : res.json(result)
    );
});

app.put("/users/:id", async (req, res) => {
    const { id } = req.params;
    const { username, password, currentUserId } = req.body;
    if (Number(id) !== Number(currentUserId))
        return res.status(403).json({ message: "Not allowed" });
    const fields = [], values = [];
    if (username?.trim()) { fields.push("username=?"); values.push(username.trim()); }
    if (password?.trim()) { fields.push("password=?"); values.push(await bcrypt.hash(password, 10)); }
    if (!fields.length) return res.json({ message: "Nothing to update" });
    values.push(id);
    db.query(`UPDATE users SET ${fields.join(", ")} WHERE id=?`, values,
        err => err ? res.status(500).json({ message: "Update failed" }) : res.json({ message: "Updated successfully" })
    );
});

app.delete("/users/:id", (req, res) => {
    const targetId = Number(req.params.id);
    const currentUserId = Number(req.query.currentUserId);
    if (!currentUserId) return res.status(400).json({ message: "User missing" });
    db.query("SELECT id, role FROM users WHERE id IN (?, ?)", [targetId, currentUserId], (err, users) => {
        if (err) return dbErr(res, err);
        const target = users.find(u => Number(u.id) === targetId);
        const actor  = users.find(u => Number(u.id) === currentUserId);
        if (!target || !actor) return res.status(404).json({ message: "User not found" });
        if (targetId === currentUserId) {
            return db.query("DELETE FROM users WHERE id=?", [targetId],
                err2 => err2 ? res.status(500).json({ message: "Delete failed" }) : res.json({ message: "Account deleted" })
            );
        }
        if (actor.role !== "admin") return res.status(403).json({ message: "Only admin allowed" });
        if (target.role === "admin") return res.status(403).json({ message: "Cannot delete another admin" });
        db.query("DELETE FROM users WHERE id=?", [targetId],
            err2 => err2 ? res.status(500).json({ message: "Delete failed" }) : res.json({ message: "User deleted by admin" })
        );
    });
});

app.put("/users/:id/make-admin", (req, res) => {
    db.query("UPDATE users SET role='admin' WHERE id=?", [req.params.id],
        err => err ? res.status(500).json({ message: "Error updating role" }) : res.json({ message: "User promoted" })
    );
});

// Books
app.get("/books", (req, res) => {
    const { user_id } = req.query;
    let sql = "SELECT books.*, users.username AS owner FROM books LEFT JOIN users ON books.user_id = users.id";
    if (user_id) sql += " WHERE books.user_id = ?";
    db.query(sql, user_id ? [user_id] : [], (err, result) =>
        err ? dbErr(res, err) : res.json(result)
    );
});

app.get("/books/:id", (req, res) => {
    db.query(
        "SELECT books.*, users.username AS owner FROM books LEFT JOIN users ON books.user_id = users.id WHERE books.id=?",
        [req.params.id],
        (err, result) => {
            if (err) return dbErr(res, err);
            if (!result.length) return res.status(404).json({ message: "Book not found" });
            res.json(result[0]);
        }
    );
});

app.post("/books", upload.single("image"), (req, res) => {
    const { title, author, price, condition_text, category, description, user_id } = req.body;
    if (isEmpty(title) || !user_id) return res.status(400).json({ message: "Missing fields" });
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    db.query(
        "INSERT INTO books (title, author, price, condition_text, category, description, image, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [title, author, price, condition_text, category, description, image, user_id],
        (err, result) => err ? dbErr(res, err) : res.json({ message: "Book added", id: result.insertId })
    );
});

app.put("/books/:id", upload.single("image"), (req, res) => {
    const { title, author, price, condition_text, category, description, image: oldImage, user_id } = req.body;
    if (isEmpty(title) || !user_id) return res.status(400).json({ message: "Missing fields" });
    const image = req.file ? `/uploads/${req.file.filename}` : oldImage;
    db.query(
        "UPDATE books SET title=?, author=?, price=?, condition_text=?, category=?, description=?, image=?, user_id=? WHERE id=?",
        [title, author, price, condition_text, category, description, image, user_id, req.params.id],
        err => err ? dbErr(res, err) : res.json({ message: "Book updated" })
    );
});

app.delete("/books/:id", (req, res) => {
    const { user_id } = req.body;
    db.query("SELECT role FROM users WHERE id=?", [user_id], (err, users) => {
        if (err) return dbErr(res, err);
        if (!users.length) return res.status(404).json({ message: "User not found" });
        db.query("SELECT user_id FROM books WHERE id=?", [req.params.id], (err2, books) => {
            if (err2) return dbErr(res, err2);
            if (!books.length) return res.status(404).json({ message: "Book not found" });
            if (books[0].user_id !== user_id && users[0].role !== "admin")
                return res.status(403).json({ message: "Not allowed" });
            db.query("DELETE FROM books WHERE id=?", [req.params.id],
                err3 => err3 ? dbErr(res, err3) : res.json({ message: "Book deleted" })
            );
        });
    });
});

// Comment Section
app.get("/comments/:book_id", (req, res) => {
    db.query(`
        SELECT comments.*, users.username,
            COALESCE(SUM(CASE WHEN comment_votes.vote='like' THEN 1 ELSE 0 END),0) AS likes,
            COALESCE(SUM(CASE WHEN comment_votes.vote='dislike' THEN 1 ELSE 0 END),0) AS dislikes
        FROM comments
        LEFT JOIN users ON comments.user_id = users.id
        LEFT JOIN comment_votes ON comments.id = comment_votes.comment_id
        WHERE comments.book_id=?
        GROUP BY comments.id ORDER BY comments.id DESC`,
        [req.params.book_id],
        (err, result) => err ? dbErr(res, err) : res.json(result)
    );
});

app.post("/comments", (req, res) => {
    const { book_id, user_id, text, parent_id } = req.body;
    if (!book_id || !user_id || isEmpty(text))
        return res.status(400).json({ message: "Missing fields" });
    db.query(
        "INSERT INTO comments (book_id, user_id, text, parent_id) VALUES (?, ?, ?, ?)",
        [book_id, user_id, text, parent_id || null],
        (err, result) => err ? dbErr(res, err) : res.json({ message: "Comment added", id: result.insertId })
    );
});

app.put("/comments/:id", (req, res) => {
    const { text, user_id } = req.body;
    db.query("UPDATE comments SET text=? WHERE id=? AND user_id=?", [text, req.params.id, user_id],
        (err, result) => {
            if (err) return dbErr(res, err);
            if (!result.affectedRows) return res.status(403).json({ message: "Not allowed" });
            res.json({ message: "Comment updated" });
        }
    );
});

app.put("/comments/:id/vote", (req, res) => {
    const { user_id, vote } = req.body;
    if (!user_id || !vote) return res.status(400).json({ message: "Missing data" });
    db.query("SELECT * FROM comment_votes WHERE comment_id=? AND user_id=?", [req.params.id, user_id],
        (err, results) => {
            if (err) return dbErr(res, err);
            if (!results.length) {
                db.query("INSERT INTO comment_votes (comment_id, user_id, vote) VALUES (?, ?, ?)",
                    [req.params.id, user_id, vote],
                    err2 => err2 ? dbErr(res, err2) : res.json({ message: "Vote added" })
                );
            } else {
                if (results[0].vote === vote) return res.json({ message: "Already voted" });
                db.query("UPDATE comment_votes SET vote=? WHERE comment_id=? AND user_id=?",
                    [vote, req.params.id, user_id],
                    err3 => err3 ? dbErr(res, err3) : res.json({ message: "Vote updated" })
                );
            }
        }
    );
});

// Ratings
app.get("/ratings/:book_id", (req, res) => {
    const { book_id } = req.params;
    db.query("SELECT AVG(rating) AS avg FROM ratings WHERE book_id=?", [book_id], (err, avg) => {
        if (err) return dbErr(res, err);
        db.query("SELECT rating FROM ratings WHERE book_id=? AND user_id=?",
            [book_id, req.query.user_id || 0],
            (err2, userRating) => {
                if (err2) return dbErr(res, err2);
                res.json({ avg: avg[0].avg || 0, userRating: userRating[0]?.rating || 0 });
            }
        );
    });
});

app.post("/ratings", (req, res) => {
    const { book_id, user_id, rating } = req.body;
    db.query(
        "INSERT INTO ratings (book_id, user_id, rating) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rating=?",
        [book_id, user_id, rating, rating],
        err => err ? dbErr(res, err) : res.json({ message: "Rating saved" })
    );
});

// Cart
app.post("/cart", (req, res) => {
    const { user_id, book_id } = req.body;
    if (!user_id || !book_id) return res.status(400).json({ message: "Missing data" });
    db.query("SELECT * FROM cart WHERE user_id=? AND book_id=?", [user_id, book_id], (err, existing) => {
        if (err) return dbErr(res, err);
        if (existing.length) return res.json({ message: "Already in cart" });
        db.query("INSERT INTO cart (user_id, book_id) VALUES (?, ?)", [user_id, book_id],
            err2 => err2 ? dbErr(res, err2) : res.json({ message: "Added to cart" })
        );
    });
});

app.get("/cart/:user_id", (req, res) => {
    db.query(
        "SELECT cart.id AS cart_id, books.* FROM cart JOIN books ON cart.book_id = books.id WHERE cart.user_id=? ORDER BY cart.id DESC",
        [req.params.user_id],
        (err, result) => err ? dbErr(res, err) : res.json(result)
    );
});

app.delete("/cart/:id", (req, res) => {
    db.query("DELETE FROM cart WHERE id=?", [req.params.id], (err, result) => {
        if (err) return dbErr(res, err);
        if (!result.affectedRows) return res.status(404).json({ message: "Item not found" });
        res.json({ message: "Removed from cart" });
    });
});

// Orders
function buildOrdersMap(rows, includeUser = false) {
    const map = {};
    rows.forEach(row => {
        if (!map[row.order_id]) {
            map[row.order_id] = {
                order_id: row.order_id,
                total: parseFloat(row.total) || 0,
                status: row.status || "pending",
                created_at: row.created_at,
                items: [],
                ...(includeUser ? { user_id: row.user_id, user_username: row.user_username } : {})
            };
        }
        if (row.book_id) {
            map[row.order_id].items.push({
                book_id: row.book_id,
                title: row.book_title,
                price: parseFloat(row.price) || 0,
                seller_id: row.seller_id,
                seller: row.seller_name || "Unknown"
            });
        }
    });
    return Object.values(map);
}

const ORDER_SQL_BASE = `
    SELECT o.id AS order_id, o.total, o.status, o.created_at,
           b.id AS book_id, b.title AS book_title, b.user_id AS seller_id,
           s.username AS seller_name, oi.price`;

app.get("/orders", (req, res) => {
    db.query(
        ORDER_SQL_BASE + `, o.user_id, u.username AS user_username
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN books b ON oi.book_id = b.id
        LEFT JOIN users s ON b.user_id = s.id
        ORDER BY o.id DESC, oi.id ASC`,
        [],
        (err, rows) => err ? dbErr(res, err) : res.json(buildOrdersMap(rows, true))
    );
});

app.get("/orders/user/:user_id", (req, res) => {
    db.query(
        ORDER_SQL_BASE + `
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN books b ON oi.book_id = b.id
        LEFT JOIN users s ON b.user_id = s.id
        WHERE o.user_id=?
        ORDER BY o.id DESC, oi.id ASC`,
        [req.params.user_id],
        (err, rows) => err ? dbErr(res, err) : res.json(buildOrdersMap(rows))
    );
});

app.post("/orders", (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ message: "User missing" });
    db.query(
        "SELECT books.id AS book_id, books.price FROM cart JOIN books ON cart.book_id = books.id WHERE cart.user_id=?",
        [user_id],
        (err, items) => {
            if (err) return res.status(500).json({ message: "Error fetching cart" });
            if (!items.length) return res.status(400).json({ message: "Cart empty" });
            const total = items.reduce((sum, i) => sum + Number(i.price || 0), 0);
            db.query("INSERT INTO orders (user_id, total) VALUES (?, ?)", [user_id, total], (err, result) => {
                if (err) return res.status(500).json({ message: "Order failed" });
                const values = items.map(i => [result.insertId, i.book_id, Number(i.price || 0)]);
                db.query("INSERT INTO order_items (order_id, book_id, price) VALUES ?", [values], err => {
                    if (err) return res.status(500).json({ message: "Items failed" });
                    db.query("DELETE FROM cart WHERE user_id=?", [user_id], () =>
                        res.json({ message: "Order placed!" })
                    );
                });
            });
        }
    );
});

app.put("/orders/:id/cancel", (req, res) => {
    db.query("UPDATE orders SET status='cancelled' WHERE id=? AND status='pending'", [req.params.id],
        (err, result) => {
            if (err) return dbErr(res, err);
            if (!result.affectedRows) return res.status(400).json({ message: "Cannot cancel" });
            res.json({ message: "Order cancelled" });
        }
    );
});

app.put("/orders/:id/deliver", (req, res) => {
    db.query("UPDATE orders SET status='delivered' WHERE id=? AND status='pending'", [req.params.id],
        (err, result) => {
            if (err) return dbErr(res, err);
            if (!result.affectedRows) return res.status(400).json({ message: "Cannot deliver" });
            res.json({ message: "Order delivered" });
        }
    );
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
