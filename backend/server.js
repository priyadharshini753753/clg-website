const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");

const app = express();
const PORT = 5000;


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
  Project structure:

  college website/
  ├── admin/
  ├── images/
  ├── signin.html
  ├── index.html
  └── backend/
      └── server.js

  So static root must be ../
*/
app.use(express.static(path.join(__dirname, "..")));


/* =========================================================
   ADMIN PAGE
========================================================= */

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../admin/index.html")
  );
});


/* =========================================================
   CONSTANTS
========================================================= */

const BATCHES = [
  "2024-2027",
  "2025-2028",
  "2026-2029"
];

const PREFIX = {
  CS: "c4s",
  AI: "a3s",
  BCA: "b2s",
  DSA: "d6s"
};

const EXPIRY_DATE = {
  "2024-2027": "2027-05-29",
  "2025-2028": "2028-05-29",
  "2026-2029": "2029-05-29"
};


/* =========================================================
   ADMIN AUTH
========================================================= */

const adminTokens = new Set();

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

function adminAuth(req, res, next) {

  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({
      message: "Admin login required"
    });
  }

  next();
}


/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
  res.send("MI Club Backend is running!");
});


/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post("/admin/login", async (req, res) => {

  const username = String(
    req.body.username || ""
  ).trim();

  const password = String(
    req.body.password || ""
  );

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required"
    });
  }

  try {

    const [rows] = await db.promise().query(
      `
      SELECT *
      FROM admin_users
      WHERE username = ?
      LIMIT 1
      `,
      [username]
    );

    if (!rows.length) {
      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    const passwordHash = hashPassword(password);

    if (
      passwordHash !== rows[0].password_hash
    ) {
      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    const token = crypto
      .randomBytes(32)
      .toString("hex");

    adminTokens.add(token);

    return res.json({
      message: "Admin login successful",
      token
    });

  } catch (err) {

    console.error("Admin login error:", err);

    return res.status(500).json({
      message: "Admin login failed"
    });
  }
});


/* =========================================================
   ADMIN ANALYTICS
========================================================= */

app.get(
  "/admin/analytics",
  adminAuth,
  async (req, res) => {

    const queries = {

      pageViews: `
        SELECT COUNT(*) AS n
        FROM analytics_views
      `,

      uniqueVisitors: `
        SELECT COUNT(DISTINCT visitor_id) AS n
        FROM analytics_views
      `,

      students: `
        SELECT COUNT(*) AS n
        FROM students
      `,

      enrollments: `
        SELECT COUNT(*) AS n
        FROM event_enrollments
      `,

      staff: `
        SELECT COUNT(*) AS n
        FROM staff
      `,

      council: `
        SELECT COUNT(*) AS n
        FROM council_members
      `,

      events: `
        SELECT COUNT(*) AS n
        FROM club_events
      `,

      feedback: `
        SELECT COUNT(*) AS n
        FROM feedback
      `
    };

    try {

      const result = {};

      for (const key of Object.keys(queries)) {

        const [rows] =
          await db.promise().query(
            queries[key]
          );

        result[key] = rows[0].n;
      }


      const [dailyRows] =
        await db.promise().query(`
          SELECT
            DATE(created_at) AS day,
            COUNT(*) AS views
          FROM analytics_views
          WHERE created_at >=
            DATE_SUB(
              CURDATE(),
              INTERVAL 6 DAY
            )
          GROUP BY DATE(created_at)
          ORDER BY day
        `);


      const map = {};

      dailyRows.forEach((row) => {

        const key = String(
          row.day
        ).slice(0, 10);

        map[key] = row.views;
      });


      const daily = [];

      for (let i = 6; i >= 0; i--) {

        const date = new Date();

        date.setDate(
          date.getDate() - i
        );

        const key =
          date.toISOString().slice(0, 10);

        daily.push({
          day: key.slice(5),
          views: map[key] || 0
        });
      }


      res.json({
        ...result,
        daily
      });

    } catch (err) {

      console.error(
        "Analytics error:",
        err
      );

      res.status(500).json({
        message: "Analytics error"
      });
    }
  }
);


/* =========================================================
   ADMIN - STAFF
========================================================= */

app.get(
  "/admin/staff",
  adminAuth,
  async (req, res) => {

    try {

      const [rows] =
        await db.promise().query(`
          SELECT
            id,
            name,
            designation,
            qualification,
            description,
            image,
            created_at
          FROM staff
          ORDER BY id ASC
        `);

      res.json(rows);

    } catch (err) {

      console.error(
        "Get staff error:",
        err
      );

      res.status(500).json({
        message: "Could not load staff"
      });
    }
  }
);


app.post(
  "/admin/staff",
  adminAuth,
  async (req, res) => {

    const {
      name,
      designation,
      qualification,
      description,
      image
    } = req.body;

    if (!name || !designation || !image) {
      return res.status(400).json({
        message:
          "Name, designation and image are required"
      });
    }

    try {

      await db.promise().query(
        `
        INSERT INTO staff
        (
          name,
          designation,
          qualification,
          description,
          image
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          name.trim(),
          designation.trim(),
          qualification || "",
          description || "",
          image.trim()
        ]
      );

      res.json({
        message: "Staff added successfully"
      });

    } catch (err) {

      console.error(
        "Add staff error:",
        err
      );

      res.status(500).json({
        message: "Could not add staff"
      });
    }
  }
);


app.put(
  "/admin/staff/:id",
  adminAuth,
  async (req, res) => {

    const {
      name,
      designation,
      qualification,
      description,
      image
    } = req.body;

    try {

      const [result] =
        await db.promise().query(
          `
          UPDATE staff
          SET
            name = ?,
            designation = ?,
            qualification = ?,
            description = ?,
            image = ?
          WHERE id = ?
          `,
          [
            name,
            designation,
            qualification || "",
            description || "",
            image,
            req.params.id
          ]
        );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Staff not found"
        });
      }

      res.json({
        message: "Staff updated successfully"
      });

    } catch (err) {

      console.error(
        "Update staff error:",
        err
      );

      res.status(500).json({
        message: "Could not update staff"
      });
    }
  }
);


app.delete(
  "/admin/staff/:id",
  adminAuth,
  async (req, res) => {

    try {

      const [result] =
        await db.promise().query(
          `
          DELETE FROM staff
          WHERE id = ?
          `,
          [req.params.id]
        );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Staff not found"
        });
      }

      res.json({
        message: "Staff deleted successfully"
      });

    } catch (err) {

      console.error(
        "Delete staff error:",
        err
      );

      res.status(500).json({
        message: "Could not delete staff"
      });
    }
  }
);


/* =========================================================
   ADMIN - COUNCIL
========================================================= */

app.get(
  "/admin/council",
  adminAuth,
  async (req, res) => {

    try {

      const [rows] =
        await db.promise().query(`
          SELECT
            id,
            name,
            designation,
            description,
            image,
            created_at
          FROM council_members
          ORDER BY id ASC
        `);

      res.json(rows);

    } catch (err) {

      console.error(
        "Get council error:",
        err
      );

      res.status(500).json({
        message: "Could not load council members"
      });
    }
  }
);


app.post(
  "/admin/council",
  adminAuth,
  async (req, res) => {

    const {
      name,
      designation,
      description,
      image
    } = req.body;

    if (!name || !designation || !image) {
      return res.status(400).json({
        message:
          "Name, designation and image are required"
      });
    }

    try {

      await db.promise().query(
        `
        INSERT INTO council_members
        (
          name,
          designation,
          description,
          image
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          name.trim(),
          designation.trim(),
          description || "",
          image.trim()
        ]
      );

      res.json({
        message:
          "Council member added successfully"
      });

    } catch (err) {

      console.error(
        "Add council error:",
        err
      );

      res.status(500).json({
        message:
          "Could not add council member"
      });
    }
  }
);


app.put(
  "/admin/council/:id",
  adminAuth,
  async (req, res) => {

    const {
      name,
      designation,
      description,
      image
    } = req.body;

    try {

      const [result] =
        await db.promise().query(
          `
          UPDATE council_members
          SET
            name = ?,
            designation = ?,
            description = ?,
            image = ?
          WHERE id = ?
          `,
          [
            name,
            designation,
            description || "",
            image,
            req.params.id
          ]
        );

      if (!result.affectedRows) {
        return res.status(404).json({
          message:
            "Council member not found"
        });
      }

      res.json({
        message:
          "Council member updated successfully"
      });

    } catch (err) {

      console.error(
        "Update council error:",
        err
      );

      res.status(500).json({
        message:
          "Could not update council member"
      });
    }
  }
);


app.delete(
  "/admin/council/:id",
  adminAuth,
  async (req, res) => {

    try {

      const [result] =
        await db.promise().query(
          `
          DELETE FROM council_members
          WHERE id = ?
          `,
          [req.params.id]
        );

      if (!result.affectedRows) {
        return res.status(404).json({
          message:
            "Council member not found"
        });
      }

      res.json({
        message:
          "Council member deleted successfully"
      });

    } catch (err) {

      console.error(
        "Delete council error:",
        err
      );

      res.status(500).json({
        message:
          "Could not delete council member"
      });
    }
  }
);


/* =========================================================
   ADMIN - EVENTS
========================================================= */

app.get(
  "/admin/events",
  adminAuth,
  async (req, res) => {

    try {

      const [rows] =
        await db.promise().query(`
          SELECT
            id,
            name,
            DATE_FORMAT(
              event_date,
              '%Y-%m-%d'
            ) AS event_date,
            venue,
            event_time,
            team_info,
            details_url,
            description,
            image,
            created_at
          FROM club_events
          ORDER BY id ASC
        `);

      res.json(rows);

    } catch (err) {

      console.error(
        "Get events error:",
        err
      );

      res.status(500).json({
        message: "Could not load events"
      });
    }
  }
);


app.post(
  "/admin/events",
  adminAuth,
  async (req, res) => {

    const {
      name,
      event_date,
      venue,
      event_time,
      team_info,
      details_url,
      description,
      image
    } = req.body;

    if (!name || !venue || !image) {
      return res.status(400).json({
        message:
          "Event name, venue and image are required"
      });
    }

    try {

      await db.promise().query(
        `
        INSERT INTO club_events
        (
          name,
          event_date,
          venue,
          event_time,
          team_info,
          details_url,
          description,
          image
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          name.trim(),
          event_date || null,
          venue.trim(),
          event_time || "",
          team_info || "",
          details_url || "",
          description || "",
          image.trim()
        ]
      );

      res.json({
        message: "Event added successfully"
      });

    } catch (err) {

      console.error(
        "Add event error:",
        err
      );

      res.status(500).json({
        message: "Could not add event"
      });
    }
  }
);


app.put(
  "/admin/events/:id",
  adminAuth,
  async (req, res) => {

    const {
      name,
      event_date,
      venue,
      event_time,
      team_info,
      details_url,
      description,
      image
    } = req.body;

    try {

      const [result] =
        await db.promise().query(
          `
          UPDATE club_events
          SET
            name = ?,
            event_date = ?,
            venue = ?,
            event_time = ?,
            team_info = ?,
            details_url = ?,
            description = ?,
            image = ?
          WHERE id = ?
          `,
          [
            name,
            event_date || null,
            venue,
            event_time || "",
            team_info || "",
            details_url || "",
            description || "",
            image,
            req.params.id
          ]
        );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Event not found"
        });
      }

      res.json({
        message: "Event updated successfully"
      });

    } catch (err) {

      console.error(
        "Update event error:",
        err
      );

      res.status(500).json({
        message: "Could not update event"
      });
    }
  }
);


app.delete(
  "/admin/events/:id",
  adminAuth,
  async (req, res) => {

    try {

      const [result] =
        await db.promise().query(
          `
          DELETE FROM club_events
          WHERE id = ?
          `,
          [req.params.id]
        );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Event not found"
        });
      }

      res.json({
        message: "Event deleted successfully"
      });

    } catch (err) {

      console.error(
        "Delete event error:",
        err
      );

      res.status(500).json({
        message: "Could not delete event"
      });
    }
  }
);


/* =========================================================
   ADMIN - FEEDBACK
========================================================= */

app.get(
  "/admin/feedback",
  adminAuth,
  async (req, res) => {

    try {

      const [rows] =
        await db.promise().query(`
          SELECT
            id,
            name,
            register_number,
            message,
            created_at
          FROM feedback
          ORDER BY id DESC
        `);

      res.json(rows);

    } catch (err) {

      console.error(
        "Get feedback error:",
        err
      );

      res.status(500).json({
        message: "Could not load feedback"
      });
    }
  }
);


app.delete(
  "/admin/feedback/:id",
  adminAuth,
  async (req, res) => {

    try {

      const [result] =
        await db.promise().query(
          `
          DELETE FROM feedback
          WHERE id = ?
          `,
          [req.params.id]
        );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Feedback not found"
        });
      }

      res.json({
        message: "Feedback deleted successfully"
      });

    } catch (err) {

      console.error(
        "Delete feedback error:",
        err
      );

      res.status(500).json({
        message: "Could not delete feedback"
      });
    }
  }
);


/* =========================================================
   ADMIN - STUDENTS
========================================================= */

app.get(
  "/admin/students",
  adminAuth,
  async (req, res) => {

    try {

      const [rows] =
        await db.promise().query(`
          SELECT
            id,
            name,
            register_number,
            batch,
            domain,
            created_at
          FROM students
          ORDER BY id DESC
        `);

      res.json(rows);

    } catch (err) {

      console.error(
        "Get students error:",
        err
      );

      res.status(500).json({
        message: "Could not load students"
      });
    }
  }
);


/* =========================================================
   PUBLIC STAFF API
========================================================= */

app.get(
  "/api/public/staff",
  async (req, res) => {

    try {

      const [rows] =
        await db.promise().query(`
          SELECT
            id,
            name,
            designation,
            qualification,
            description,
            image
          FROM staff
          ORDER BY id ASC
        `);

      res.json(rows);

    } catch (err) {

      console.error(
        "Public staff error:",
        err
      );

      res.status(500).json({
        message: "Could not load staff"
      });
    }
  }
);


/* =========================================================
   PUBLIC COUNCIL API
========================================================= */

app.get(
  "/api/public/council",
  async (req, res) => {

    try {

      const [rows] =
        await db.promise().query(`
          SELECT
            id,
            name,
            designation,
            description,
            image
          FROM council_members
          ORDER BY id ASC
        `);

      res.json(rows);

    } catch (err) {

      console.error(
        "Public council error:",
        err
      );

      res.status(500).json({
        message:
          "Could not load council members"
      });
    }
  }
);


/* =========================================================
   PUBLIC EVENTS API
========================================================= */

app.get(
  "/api/public/events",
  async (req, res) => {

    try {

      const [rows] =
        await db.promise().query(`
          SELECT
            id,
            name,
            DATE_FORMAT(
              event_date,
              '%Y-%m-%d'
            ) AS event_date,
            venue,
            event_time,
            team_info,
            details_url,
            description,
            image
          FROM club_events
          ORDER BY id ASC
        `);

      res.json(rows);

    } catch (err) {

      console.error(
        "Public events error:",
        err
      );

      res.status(500).json({
        message: "Could not load events"
      });
    }
  }
);


/* =========================================================
   FEEDBACK FROM WEBSITE
========================================================= */

app.post(
  "/feedback",
  async (req, res) => {

    const {
      name,
      registerNumber,
      message
    } = req.body;

    if (!name || !message) {
      return res.status(400).json({
        message:
          "Name and message are required"
      });
    }

    try {

      await db.promise().query(
        `
        INSERT INTO feedback
        (
          name,
          register_number,
          message
        )
        VALUES (?, ?, ?)
        `,
        [
          name.trim(),
          registerNumber || "",
          message.trim()
        ]
      );

      res.json({
        message:
          "Feedback submitted successfully"
      });

    } catch (err) {

      console.error(
        "Feedback error:",
        err
      );

      res.status(500).json({
        message:
          "Feedback submission failed"
      });
    }
  }
);


/* =========================================================
   ANALYTICS TRACKING
========================================================= */

app.post(
  "/api/analytics/track",
  async (req, res) => {

    const visitorId =
      String(
        req.body.visitorId || ""
      ).trim();

    const page =
      String(
        req.body.page || "/"
      ).trim();

    if (!visitorId) {
      return res.status(400).json({
        message: "Visitor ID is required"
      });
    }

    try {

      await db.promise().query(
        `
        INSERT INTO analytics_views
        (
          visitor_id,
          page
        )
        VALUES (?, ?)
        `,
        [
          visitorId,
          page
        ]
      );

      res.json({
        message: "Tracked"
      });

    } catch (err) {

      console.error(
        "Analytics tracking error:",
        err
      );

      res.status(500).json({
        message:
          "Analytics tracking failed"
      });
    }
  }
);


/* =========================================================
   STUDENT BATCH HELPER
========================================================= */

function isBatchExpired(batch) {

  const expiry =
    new Date(
      EXPIRY_DATE[batch] +
      "T23:59:59"
    );

  return new Date() > expiry;
}

// ==========================================
// FEEDBACK
// Save contact page feedback
// ==========================================

app.post("/feedback", (req, res) => {

    const name = String(req.body.name || "").trim();

    const registerNumber =
        String(req.body.registerNumber || "").trim();

    const message =
        String(req.body.message || "").trim();

    // REQUIRED FIELD CHECK
    if (!name || !registerNumber || !message) {

        return res.status(400).json({
            success: false,
            message: "Name, Register Number and Message are required"
        });
    }

    const sql = `
        INSERT INTO feedback
        (
            name,
            register_number,
            message
        )
        VALUES (?, ?, ?)
    `;

    db.query(
        sql,
        [
            name,
            registerNumber,
            message
        ],
        (err, result) => {

            if (err) {

                console.error(
                    "❌ Feedback save error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not save feedback"
                });
            }

            console.log(
                "✅ Feedback saved:",
                result.insertId
            );

            res.status(201).json({
                success: true,
                message: "Feedback submitted successfully",
                id: result.insertId
            });
        }
    );
});
/* =========================================================
   REGISTER STUDENT
========================================================= */

app.post(
  "/register",
  (req, res) => {

    let {
      name = "",
      batch = "",
      domain = "",
      registerNumber = ""
    } = req.body;

    name = name.trim();
    batch = batch.trim();
    domain = domain.trim().toUpperCase();
    registerNumber =
      registerNumber.trim();


    if (
      !name ||
      !batch ||
      !domain ||
      !registerNumber
    ) {
      return res.status(400).json({
        message:
          "All student details are required"
      });
    }


    if (!BATCHES.includes(batch)) {
      return res.status(400).json({
        message: "Invalid batch"
      });
    }


    if (!PREFIX[domain]) {
      return res.status(400).json({
        message: "Invalid domain"
      });
    }


    const requiredPrefix =
      PREFIX[domain];


    if (
      !registerNumber
        .toLowerCase()
        .startsWith(
          requiredPrefix.toLowerCase()
        )
    ) {
      return res.status(400).json({
        message:
          `Register number must start with ${requiredPrefix}`
      });
    }


    const checkSql = `
      SELECT *
      FROM students
      WHERE LOWER(register_number)
        = LOWER(?)
        AND batch = ?
      LIMIT 1
    `;


    db.query(
      checkSql,
      [
        registerNumber,
        batch
      ],
      (err, results) => {

        if (err) {

          console.error(
            "Registration check error:",
            err
          );

          return res.status(500).json({
            message:
              "Database error"
          });
        }


        if (results.length > 0) {

          const student =
            results[0];


          if (
            student.name
              .trim()
              .toLowerCase() ===
              name.toLowerCase() &&
            student.domain
              .toUpperCase() ===
              domain
          ) {

            return res.json({
              message:
                "Student already registered. You can login now."
            });
          }


          return res.status(409).json({
            message:
              "This register number already belongs to another student in this batch."
          });
        }


        const qrToken =
          crypto
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
            qrToken
          ],
          (insertErr) => {

            if (insertErr) {

              console.error(
                "Student registration error:",
                insertErr
              );

              return res.status(500).json({
                message:
                  "Registration failed"
              });
            }


            return res.json({
              message:
                "Registration submitted successfully"
            });
          }
        );
      }
    );
  }
);


/* =========================================================
   STUDENT LOGIN
========================================================= */

app.post(
  "/login",
  (req, res) => {

    let {
      name = "",
      batch = "",
      registerNumber = ""
    } = req.body;

    name = name.trim();
    batch = batch.trim();
    registerNumber =
      registerNumber.trim();


    if (
      !name ||
      !batch ||
      !registerNumber
    ) {
      return res.status(400).json({
        message:
          "Name, Batch and Register Number are required"
      });
    }


    if (!BATCHES.includes(batch)) {
      return res.status(400).json({
        message:
          "Invalid batch selected"
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
      WHERE LOWER(register_number)
        = LOWER(?)
        AND batch = ?
      LIMIT 1
    `;


    db.query(
      sql,
      [
        registerNumber,
        batch
      ],
      (err, results) => {

        if (err) {

          console.error(
            "Login error:",
            err
          );

          return res.status(500).json({
            message:
              "Login failed"
          });
        }


        if (results.length === 0) {

          return res.status(401).json({
            message:
              "Invalid Name, Batch or Register Number"
          });
        }


        const student =
          results[0];


        if (
          student.name
            .trim()
            .toLowerCase() !==
          name.toLowerCase()
        ) {

          return res.status(401).json({
            message:
              "Invalid Name, Batch or Register Number"
          });
        }


        if (
          isBatchExpired(batch)
        ) {

          return res.status(403).json({
            expired: true,
            message:
              `Your batch (${batch}) login validity has expired.`
          });
        }


        return res.json({

          message:
            "Login successful",

          participant: {

            name:
              student.name,

            registerNumber:
              student.register_number,

            batch:
              student.batch,

            domain:
              student.domain,

            qrToken:
              student.qr_token
          }
        });
      }
    );
  }
);


/* =========================================================
   EVENT ENROLLMENT
========================================================= */

app.post(
  "/event-enroll",
  (req, res) => {

    const {
      qrToken,
      eventType,
      venue,
      participantEvent,
      status,
      eventDate
    } = req.body;


    if (
      !qrToken ||
      !eventType ||
      !venue ||
      !participantEvent ||
      !status ||
      !eventDate
    ) {
      return res.status(400).json({
        message:
          "All event details are required"
      });
    }


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
            message:
              "Database error"
          });
        }


        if (results.length === 0) {

          return res.status(401).json({
            message:
              "Invalid student session"
          });
        }


        const studentId =
          results[0].id;


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
            eventDate
          ],
          (insertErr) => {

            if (insertErr) {

              console.error(
                "Event enrollment error:",
                insertErr
              );

              return res.status(500).json({
                message:
                  "Event enrollment failed"
              });
            }


            return res.json({
              message:
                "Event enrollment submitted successfully"
            });
          }
        );
      }
    );
  }
);


/* =========================================================
   STUDENT PROFILE + EVENT HISTORY
========================================================= */

app.get(
  "/api/student/:token",
  (req, res) => {

    const qrToken =
      req.params.token;


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
            message:
              "Database error"
          });
        }


        if (results.length === 0) {

          return res.status(404).json({
            message:
              "Student not found"
          });
        }


        const student =
          results[0];


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
                  "Could not load event history"
              });
            }


            return res.json({
              student,
              events
            });
          }
        );
      }
    );
  }
);


/* =========================================================
   SERVER START
========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `🚀 Server running on http://localhost:${PORT}`
    );

  }
);