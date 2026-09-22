const express = require("express");

console.log("🔥 SERVER.JS LOADED");

const cors = require("cors");

const db = require("./db");

const app = express();


// Middleware
app.use(cors());
app.use(express.json());


// Fixed register-number prefix per domain
const DOMAIN_PREFIX = {
    CS: "c4s",
    AI: "a3s",
    BCA: "b2s",
    DSA: "d6s"
};

// Batch (e.g. "2024-2027") -> login expiry date ("2027-05-29")
function getExpiryDateForBatch(batch) {
    const match = /(\d{4})-(\d{4})/.exec(batch || "");
    if (!match) return null;
    const endYear = match[2];
    return `${endYear}-05-29`;
}

// Create table if it doesn't exist yet
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    register_number VARCHAR(100) NOT NULL,
    event VARCHAR(255) NOT NULL,
    batch VARCHAR(20) NOT NULL DEFAULT '',
    domain VARCHAR(10) NOT NULL DEFAULT '',
    expiry_date DATE NULL,
    reg_date DATE NOT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_batch_reg_event_date (batch, register_number, event, reg_date)
  )
`;

db.query(CREATE_TABLE_SQL, (err) => {
    if (err) {
        console.error("❌ Could not create registrations table:", err.message);
        return;
    }
    console.log("✅ registrations table ready");
    runMigrations();
});

// Runs once at startup, in strict order, so an older table gets upgraded
// safely to the current schema without losing data.
function runMigrations() {

    const addColumnIfMissing = (sql, next) => {
        db.query(sql, (err) => {
            if (err && err.code !== "ER_DUP_FIELDNAME") {
                console.error("⚠️  Migration step failed:", err.message);
            }
            next();
        });
    };

    addColumnIfMissing(
        "ALTER TABLE registrations ADD COLUMN batch VARCHAR(20) NOT NULL DEFAULT ''",
        () => {
            addColumnIfMissing(
                "ALTER TABLE registrations ADD COLUMN domain VARCHAR(10) NOT NULL DEFAULT ''",
                () => {
                    addColumnIfMissing(
                        "ALTER TABLE registrations ADD COLUMN expiry_date DATE NULL",
                        () => {
                            addColumnIfMissing(
                                "ALTER TABLE registrations ADD COLUMN reg_date DATE NULL",
                                dedupeThenBackfill
                            );
                        }
                    );
                }
            );
        }
    );

    // Some very old rows may share the same batch + register_number +
    // event (from before any of these constraints existed, or from a
    // moment where a constraint was briefly missing during an earlier
    // migration). Backfilling reg_date on those would recreate a genuine
    // duplicate, so clean those up first — keeping only the earliest row
    // (lowest id) per group — before assigning dates and adding the key.
    function dedupeThenBackfill() {
        const dedupeSql = `
            DELETE t1 FROM registrations t1
            INNER JOIN registrations t2
              ON t1.batch = t2.batch
             AND t1.register_number = t2.register_number
             AND t1.event = t2.event
             AND DATE(t1.submitted_at) = DATE(t2.submitted_at)
             AND t1.id > t2.id
        `;

        db.query(dedupeSql, (err, result) => {
            if (err) {
                console.error("⚠️  Could not remove duplicate rows:", err.message);
            } else if (result && result.affectedRows > 0) {
                console.log(`🧹 Removed ${result.affectedRows} duplicate registration row(s)`);
            }
            backfillRegDate();
        });
    }

    function backfillRegDate() {
        db.query(
            "UPDATE registrations SET reg_date = DATE(submitted_at) WHERE reg_date IS NULL",
            (err) => {
                if (err) {
                    console.error("⚠️  Could not backfill reg_date:", err.message);
                }
                dropOldKeys();
            }
        );
    }

    function dropOldKeys() {
        db.query("ALTER TABLE registrations DROP INDEX unique_reg_event", (err) => {
            if (err && err.code !== "ER_CANT_DROP_FIELD_OR_KEY") {
                console.error("⚠️  Could not drop old unique key:", err.message);
            }
            db.query("ALTER TABLE registrations DROP INDEX unique_batch_reg_event", (err2) => {
                if (err2 && err2.code !== "ER_CANT_DROP_FIELD_OR_KEY") {
                    console.error("⚠️  Could not drop old composite unique key:", err2.message);
                }
                addNewKey();
            });
        });
    }

    function addNewKey() {
        db.query(
            "ALTER TABLE registrations ADD UNIQUE KEY unique_batch_reg_event_date (batch, register_number, event, reg_date)",
            (err) => {
                if (err && err.code !== "ER_DUP_KEYNAME") {
                    console.error("⚠️  Could not add date-scoped unique key:", err.message);
                } else {
                    console.log("✅ Migrations complete");
                }
            }
        );
    }
}


// Home test
app.get("/", (req, res) => {

    res.send("MI Club Backend is running!");

});


// Database test
app.get("/test-db", (req, res) => {

    db.query("SELECT 1", (err, result) => {

        if (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                message: "Database connection failed"
            });

        }

        res.json({
            success: true,
            message: "Database connected successfully!"
        });

    });

});


// ==========================================
// REGISTER — save a participant's event signup
// ==========================================
app.post("/register", (req, res) => {

    const name = (req.body.name || "").trim();
    const registerNumber = (req.body.registerNumber || "").trim();
    const event = (req.body.event || "").trim();
    const batch = (req.body.batch || "").trim();
    const domain = (req.body.domain || "").trim().toUpperCase();

    if (!name || !registerNumber || !event || !batch || !domain) {
        return res.status(400).json({
            message: "Name, Register Number, Batch, Domain and Event are all required"
        });
    }

    const expectedPrefix = DOMAIN_PREFIX[domain];

    if (!expectedPrefix) {
        return res.status(400).json({
            message: "Invalid domain selected"
        });
    }

    if (!registerNumber.toLowerCase().startsWith(expectedPrefix)) {
        return res.status(400).json({
            message: `Register number must start with "${expectedPrefix}" for ${domain}`
        });
    }

    const sql = `
        INSERT INTO registrations (name, register_number, event, batch, domain, expiry_date, reg_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const expiryDate = getExpiryDateForBatch(batch);

    // "Today" in YYYY-MM-DD, so the same event can be registered again
    // on a different calendar day.
    const todayStr = new Date().toISOString().slice(0, 10);

    db.query(sql, [name, registerNumber, event, batch, domain, expiryDate, todayStr], (err, result) => {

        if (err) {

            if (err.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "You have already registered for this event today"
                });
            }

            console.error(err);
            return res.status(500).json({
                message: "Could not save registration"
            });
        }

        res.status(201).json({
            message: "Registration saved",
            id: result.insertId
        });

    });

});


// ==========================================
// LOGIN — verify name + register number, return their events
// ==========================================
app.post("/login", (req, res) => {

    const name = (req.body.name || "").trim();
    const registerNumber = (req.body.registerNumber || "").trim();
    const batch = (req.body.batch || "").trim();

    if (!name || !registerNumber || !batch) {
        return res.status(400).json({
            message: "Name, Batch and Register Number are required"
        });
    }

    const sql = `
        SELECT name, register_number, event, batch, domain, expiry_date, submitted_at
        FROM registrations
        WHERE LOWER(register_number) = LOWER(?)
          AND batch = ?
        ORDER BY submitted_at ASC
    `;

    db.query(sql, [registerNumber, batch], (err, rows) => {

        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Login failed, please try again"
            });
        }

        if (rows.length === 0) {
            return res.status(401).json({
                message: "Invalid Name or Register Number"
            });
        }

        const nameMatches = rows.some(
            (row) => row.name.trim().toLowerCase() === name.toLowerCase()
        );

        if (!nameMatches) {
            return res.status(401).json({
                message: "Invalid Name or Register Number"
            });
        }

        // Check batch-based login expiry
        const expiryDate = rows[0].expiry_date;

        if (expiryDate) {
            const today = new Date();
            const expiry = new Date(expiryDate);

            // compare by date only, ignore time-of-day
            today.setHours(0, 0, 0, 0);
            expiry.setHours(0, 0, 0, 0);

            if (today > expiry) {
                const formattedExpiry = expiry.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                });

                return res.status(403).json({
                    message: `Login Expired. Your student login validity ended on ${formattedExpiry}. Please contact the MI Club administrator.`,
                    expired: true
                });
            }
        }

        res.json({
            participant: {
                name: rows[0].name,
                registerNumber: rows[0].register_number,
                batch: rows[0].batch,
                domain: rows[0].domain,
                events: rows.map((row) => ({
                    event: row.event,
                    submittedAt: row.submitted_at
                }))
            }
        });

    });

});


// Start server
const PORT = 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});