const mysql = require("mysql2");
const db = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
db.getConnection((err, connection) => {
    if (err) {
        console.log("DB CONNECTION FAILED:", err);
    } else {
        console.log("MySQL Pool Connected");
        connection.release();
    }
});
module.exports = db;
