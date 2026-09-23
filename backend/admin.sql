USE mi_club;


/* =====================================================
   1. ADMIN USERS
===================================================== */

CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


/* =====================================================
   2. STAFF / FACULTIES
===================================================== */

CREATE TABLE IF NOT EXISTS staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    designation VARCHAR(255) NOT NULL,
    qualification VARCHAR(500),
    description TEXT,
    image VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);


/* =====================================================
   3. COUNCIL MEMBERS
===================================================== */

CREATE TABLE IF NOT EXISTS council_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    designation VARCHAR(255) NOT NULL,
    description TEXT,
    image VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);


/* =====================================================
   4. CLUB EVENTS
===================================================== */

CREATE TABLE IF NOT EXISTS club_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    event_date DATE,
    venue VARCHAR(255),
    event_time VARCHAR(100),
    team_info VARCHAR(255),
    details_url VARCHAR(500),
    description TEXT,
    image VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);


/* =====================================================
   5. FEEDBACK / QUERIES
===================================================== */

CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    register_number VARCHAR(100),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


/* =====================================================
   6. WEBSITE ANALYTICS
===================================================== */

CREATE TABLE IF NOT EXISTS analytics_views (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    visitor_id VARCHAR(100) NOT NULL,
    page VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_visitor_id (visitor_id),
    INDEX idx_created_at (created_at)
);


/* =====================================================
   7. ADMIN LOGIN
===================================================== */

INSERT INTO admin_users (
    username,
    password_hash
)
SELECT
    'admin',
    '20a9af7f4ff2ac9da1349772ab76f9d3360a531c38024a81ee72e5ba38ee037f'
WHERE NOT EXISTS (
    SELECT 1
    FROM admin_users
    WHERE username = 'admin'
);


/* =====================================================
   8. EXISTING STAFF
===================================================== */

INSERT INTO staff (
    name,
    designation,
    qualification,
    description,
    image
)
SELECT
    'DR.M.PUNITHA M.C.A., M.PHIL., PHD.',
    'Head & Associate Professor',
    'M.C.A., M.PHIL., PHD.',
    'Head & Associate Professor',
    'images/logo3.png'
WHERE NOT EXISTS (
    SELECT 1
    FROM staff
    WHERE name = 'DR.M.PUNITHA M.C.A., M.PHIL., PHD.'
);


/* =====================================================
   9. EXISTING COUNCIL MEMBERS
===================================================== */

INSERT INTO council_members (
    name,
    designation,
    description,
    image
)
SELECT
    'S.Lathifa',
    'Department-Chairman',
    '',
    'images/member1 (2).png'
WHERE NOT EXISTS (
    SELECT 1
    FROM council_members
    WHERE name = 'S.Lathifa'
);


INSERT INTO council_members (
    name,
    designation,
    description,
    image
)
SELECT
    'P. Priya dharshini',
    'Department-Vice Chairman',
    '',
    'images/member2 (2).png'
WHERE NOT EXISTS (
    SELECT 1
    FROM council_members
    WHERE name = 'P. Priya dharshini'
);


INSERT INTO council_members (
    name,
    designation,
    description,
    image
)
SELECT
    'P. Jaya shree',
    'Department-Secretary',
    '',
    'images/member3 (2).png'
WHERE NOT EXISTS (
    SELECT 1
    FROM council_members
    WHERE name = 'P. Jaya shree'
);


INSERT INTO council_members (
    name,
    designation,
    description,
    image
)
SELECT
    'J. Kalpana',
    'Department-Join Secretary',
    '',
    'images/member4 (2).png'
WHERE NOT EXISTS (
    SELECT 1
    FROM council_members
    WHERE name = 'J. Kalpana'
);


/* =====================================================
   10. EXISTING EVENTS
===================================================== */

INSERT INTO club_events (
    name,
    event_date,
    venue,
    event_time,
    team_info,
    details_url,
    description,
    image
)
SELECT
    'QUIZ',
    NULL,
    'Seminar Hall',
    '10:30 AM - 12:30 PM',
    'Max 2 Participants',
    'Quiz.html',
    '',
    'images/Quiz.png.png'
WHERE NOT EXISTS (
    SELECT 1
    FROM club_events
    WHERE name = 'QUIZ'
);


INSERT INTO club_events (
    name,
    event_date,
    venue,
    event_time,
    team_info,
    details_url,
    description,
    image
)
SELECT
    'DEBUGGING',
    NULL,
    'Computer Lab',
    '10:30 AM - 12:30 PM',
    'Max 2 Participants',
    'debugging.html',
    '',
    'images/Debugging.png.png'
WHERE NOT EXISTS (
    SELECT 1
    FROM club_events
    WHERE name = 'DEBUGGING'
);


INSERT INTO club_events (
    name,
    event_date,
    venue,
    event_time,
    team_info,
    details_url,
    description,
    image
)
SELECT
    'PAPER PRESENTATION',
    NULL,
    'Auditorium',
    '01:00 PM - 03:00 PM',
    'Max 2 Participants',
    'ppt.html',
    '',
    'images/Paper Presentation.png.png'
WHERE NOT EXISTS (
    SELECT 1
    FROM club_events
    WHERE name = 'PAPER PRESENTATION'
);


INSERT INTO club_events (
    name,
    event_date,
    venue,
    event_time,
    team_info,
    details_url,
    description,
    image
)
SELECT
    'CODE RELAY',
    NULL,
    'Computer Lab',
    '01:00 PM - 03:00 PM',
    'Max 3 Participants',
    'code relay.html',
    '',
    'images/Code Relay.png.png'
WHERE NOT EXISTS (
    SELECT 1
    FROM club_events
    WHERE name = 'CODE RELAY'
);


INSERT INTO club_events (
    name,
    event_date,
    venue,
    event_time,
    team_info,
    details_url,
    description,
    image
)
SELECT
    'WEB DEVELOPMENT & LOGO DESIGNING',
    NULL,
    'Computer Lab',
    '10:30 AM - 12:30 PM',
    'Max 2 Participants',
    'webdesign.html',
    '',
    'images/web&logo designing.png.png'
WHERE NOT EXISTS (
    SELECT 1
    FROM club_events
    WHERE name = 'WEB DEVELOPMENT & LOGO DESIGNING'
);


/* =====================================================
   11. CHECK
===================================================== */

SELECT * FROM admin_users;

SELECT * FROM staff;

SELECT * FROM council_members;

SELECT * FROM club_events;

SELECT * FROM feedback;

SELECT * FROM analytics_views;