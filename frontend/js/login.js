const form    = document.getElementById("loginForm");
const toggle  = document.getElementById("toggleMode");
const roleBox = document.querySelector(".role-switch");
const API     = "http://127.0.0.1:5000/users";

let isLogin = true;
let selectedRole = "user";

roleBox.style.display = "none";
document.getElementById("adminKey").style.display = "none";

function setRole(role, btn) {
    selectedRole = role;
    document.querySelectorAll(".role-switch button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("adminKey").style.display =
        (!isLogin && role === "admin") ? "block" : "none";
}

toggle.addEventListener("click", () => {
    isLogin = !isLogin;
    document.getElementById("email").style.display     = isLogin ? "none" : "block";
    roleBox.style.display                              = isLogin ? "none" : "flex";
    document.getElementById("submitBtn").innerText     = isLogin ? "Login" : "Register";
    document.querySelector(".tagline").innerText       = isLogin ? "Login to continue" : "Create an account";
    toggle.innerText                                   = isLogin ? "Register here" : "Login here";
    document.getElementById("adminKey").style.display =
        (!isLogin && selectedRole === "admin") ? "block" : "none";
});

form.addEventListener("submit", async e => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const email    = document.getElementById("email").value.trim();
    const adminKey = document.getElementById("adminKey").value.trim();

    try {
        if (isLogin) {
            const res = await fetch(`${API}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) return alert(data.message);
            localStorage.setItem("user", JSON.stringify(data));
            window.location.href = data.role === "admin" ? "admin.html" : "index.html";
        } else {
            if (!email) return alert("Email required!");
            if (selectedRole === "admin" && !adminKey) return alert("Admin secret key required!");
            const res = await fetch(`${API}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username, email, password, role: selectedRole,
                    ...(selectedRole === "admin" && { adminKey })
                })
            });
            const data = await res.json();
            if (!res.ok) return alert(data.message);
            alert("Registered successfully!"); toggle.click();
        }
    } catch (err) { console.error(err); alert("Backend not reachable"); }
});
