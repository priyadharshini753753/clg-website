const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");

const app = express();
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "../admin/index.html"));
});
const PORT = 5000;

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// ===============================
// CONSTANTS
// ===============================

const BATCHES = [
  "2024-2027",
  "2025-2028",
  "2026-2029",
];

const PREFIX = {
  CS: "c4s",
  AI: "a3s",
  BCA: "b2s",
  DSA: "d6s",
};

const EXPIRY_DATE = {
  "2024-2027": "2027-05-29",
  "2025-2028": "2028-05-29",
  "2026-2029": "2029-05-29",
};

// ===============================
// HELPER
// ===============================

function isBatchExpired(batch) {
  const expiry = new Date(
    EXPIRY_DATE[batch] + "T23:59:59"
  );

  return new Date() > expiry;
}

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  res.send("MI Club Backend is running!");
});

// ===============================
// REGISTER STUDENT
// ===============================

app.post("/register", (req, res) => {
  let {
    name = "",
    batch = "",
    domain = "",
    registerNumber = "",
  } = req.body;

  name = name.trim();
  batch = batch.trim();
  domain = domain.trim().toUpperCase();
  registerNumber = registerNumber.trim();

  // Required fields
  if (!name || !batch || !domain || !registerNumber) {
    return res.status(400).json({
      message: "All student details are required",
    });
  }

  // Validate batch
  if (!BATCHES.includes(batch)) {
    return res.status(400).json({
      message: "Invalid batch",
    });
  }

  // Validate domain
  if (!PREFIX[domain]) {
    return res.status(400).json({
      message: "Invalid domain",
    });
  }

  // Validate register number prefix
  const requiredPrefix = PREFIX[domain];

  if (
    !registerNumber
      .toLowerCase()
      .startsWith(requiredPrefix.toLowerCase())
  ) {
    return res.status(400).json({
      message: `Register number must start with ${requiredPrefix}`,
    });
  }

  // Check existing student
  const checkSql = `
    SELECT *
    FROM students
    WHERE LOWER(register_number) = LOWER(?)
      AND batch = ?
    LIMIT 1
  `;

  db.query(
    checkSql,
    [registerNumber, batch],
    (err, results) => {
      if (err) {
        console.error("Registration check error:", err);

        return res.status(500).json({
          message: "Database error",
        });
      }

      // Student already exists
      if (results.length > 0) {
        const student = results[0];

        // Same student
        if (
          student.name.trim().toLowerCase() ===
            name.toLowerCase() &&
          student.domain.toUpperCase() === domain
        ) {
          return res.json({
            message:
              "Student already registered. You can login now.",
          });
        }

        // Same register number but different student
        return res.status(409).json({
          message:
            "This register number already belongs to another student in this batch.",
        });
      }

      // Create permanent QR token
      const qrToken = crypto
        .randomBytes(24)
        .toString("hex");

      const insertSql = `
        INSERT INTO students
        (
          name,
          register_number,
          batch,
          domain,
          qr_token
        )
        VALUES (?, ?, ?, ?, ?)
      `;

      db.query(
        insertSql,
        [
          name,
          registerNumber,
          batch,
          domain,
          qrToken,
        ],
        (insertErr) => {
          if (insertErr) {
            console.error(
              "Student registration error:",
              insertErr
            );

            return res.status(500).json({
              message: "Registration failed",
            });
          }

          return res.json({
            message:
              "Registration submitted successfully",
          });
        }
      );
    }
  );
});

// ===============================
// LOGIN
// ===============================

app.post("/login", (req, res) => {
  let {
    name = "",
    batch = "",
    registerNumber = "",
  } = req.body;

  name = name.trim();
  batch = batch.trim();
  registerNumber = registerNumber.trim();

  if (!name || !batch || !registerNumber) {
    return res.status(400).json({
      message:
        "Name, Batch and Register Number are required",
    });
  }

  if (!BATCHES.includes(batch)) {
    return res.status(400).json({
      message: "Invalid batch selected",
    });
  }

  const sql = `
    SELECT
      name,
      register_number,
      batch,
      domain,
      qr_token
    FROM students
    WHERE LOWER(register_number) = LOWER(?)
      AND batch = ?
    LIMIT 1
  `;

  db.query(
    sql,
    [registerNumber, batch],
    (err, results) => {
      if (err) {
        console.error("Login error:", err);

        return res.status(500).json({
          message: "Login failed",
        });
      }

      // Student not found
      if (results.length === 0) {
        return res.status(401).json({
          message:
            "Invalid Name, Batch or Register Number",
        });
      }

      const student = results[0];

      // Check name
      if (
        student.name.trim().toLowerCase() !==
        name.toLowerCase()
      ) {
        return res.status(401).json({
          message:
            "Invalid Name, Batch or Register Number",
        });
      }

      // Check batch expiry
      if (isBatchExpired(batch)) {
        return res.status(403).json({
          expired: true,
          message:
            `Your batch (${batch}) login validity has expired.`,
        });
      }

      // Successful login
      return res.json({
        message: "Login successful",

        participant: {
          name: student.name,
          registerNumber: student.register_number,
          batch: student.batch,
          domain: student.domain,
          qrToken: student.qr_token,
        },
      });
    }
  );
});

// ===============================
// EVENT ENROLLMENT
// ===============================

app.post("/event-enroll", (req, res) => {
  const {
    qrToken,
    eventType,
    venue,
    participantEvent,
    status,
    eventDate,
  } = req.body;

  // Required fields
  if (
    !qrToken ||
    !eventType ||
    !venue ||
    !participantEvent ||
    !status ||
    !eventDate
  ) {
    return res.status(400).json({
      message: "All event details are required",
    });
  }

  // Find student using permanent QR token
  const studentSql = `
    SELECT id
    FROM students
    WHERE qr_token = ?
    LIMIT 1
  `;

  db.query(
    studentSql,
    [qrToken],
    (err, results) => {
      if (err) {
        console.error(
          "Event student lookup error:",
          err
        );

        return res.status(500).json({
          message: "Database error",
        });
      }

      if (results.length === 0) {
        return res.status(401).json({
          message: "Invalid student session",
        });
      }

      const studentId = results[0].id;

      const insertSql = `
        INSERT INTO event_enrollments
        (
          student_id,
          event_type,
          venue,
          participant_event,
          status,
          event_date
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.query(
        insertSql,
        [
          studentId,
          eventType,
          venue,
          participantEvent,
          status,
          eventDate,
        ],
        (insertErr) => {
          if (insertErr) {
            console.error(
              "Event enrollment error:",
              insertErr
            );

            return res.status(500).json({
              message:
                "Event enrollment failed",
            });
          }

          return res.json({
            message:
              "Event enrollment submitted successfully",
          });
        }
      );
    }
  );
});

// ===============================
// STUDENT PROFILE + EVENT HISTORY
// ===============================

app.get("/api/student/:token", (req, res) => {
  const qrToken = req.params.token;

  const studentSql = `
    SELECT
      id,
      name,
      register_number,
      batch,
      domain
    FROM students
    WHERE qr_token = ?
    LIMIT 1
  `;

  db.query(
    studentSql,
    [qrToken],
    (err, results) => {
      if (err) {
        console.error(
          "Student profile error:",
          err
        );

        return res.status(500).json({
          message: "Database error",
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      const student = results[0];

      // Get ALL events for this student
      const eventSql = `
        SELECT
          event_type,
          venue,
          participant_event,
          status,
          event_date
        FROM event_enrollments
        WHERE student_id = ?
        ORDER BY event_date ASC, id ASC
      `;

      db.query(
        eventSql,
        [student.id],
        (eventErr, events) => {
          if (eventErr) {
            console.error(
              "Event history error:",
              eventErr
            );

            return res.status(500).json({
              message:
                "Could not load event history",
            });
          }

          return res.json({
            student: student,
            events: events,
          });
        }
      );
    }
  );
});

// ===============================
// SERVER START
// ===============================

app.listen(PORT, () => {
  console.log(
    `🚀 Server running on http://localhost:${PORT}`
  );
});