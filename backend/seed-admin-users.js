/*
  ONE-TIME SETUP SCRIPT
  ----------------------
  Uses the SAME hashing method as server.js's hashPassword()
  function (SHA-256), so the login check will match correctly.

  1. Change the username/password below for your 2 admins.
  2. Run: node seed-admin-users.js
  3. Delete or move this file after running it.
*/

const crypto = require("crypto");
const db = require("./db"); // adjust path if this file sits elsewhere

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

const admins = [
  { username: "admin1", password: "ChangeMe123!" },
  { username: "admin2", password: "ChangeMe456!" },
];

admins.forEach((admin) => {
  const hash = hashPassword(admin.password);

  db.query(
    `INSERT INTO admin_users (username, password_hash)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE password_hash = ?`,
    [admin.username, hash, hash],
    (err) => {
      if (err) {
        console.error(`❌ Error seeding ${admin.username}:`, err);
      } else {
        console.log(`✅ Admin '${admin.username}' ready`);
      }
    }
  );
});