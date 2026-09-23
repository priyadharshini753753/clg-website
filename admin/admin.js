const API = "http://localhost:5000";

let token = localStorage.getItem("miAdminToken");
let section = "dashboard";

const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));


/* =========================
   API
========================= */

async function api(path, opt = {}) {
  opt.headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {})
  };

  const r = await fetch(API + path, opt);

  const d = await r.json().catch(() => ({
    message: "Server error"
  }));

  if (r.status === 401) {
    logout();
    throw Error(d.message);
  }

  if (!r.ok) {
    throw Error(d.message || "Request failed");
  }

  return d;
}


/* =========================
   LOGOUT
========================= */

function logout() {
  localStorage.removeItem("miAdminToken");

  token = null;

  $("app").classList.add("hidden");
  $("login").classList.remove("hidden");
}


/* =========================
   LOGIN
========================= */

async function login(e) {
  e.preventDefault();

  try {
    const d = await api("/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("u").value.trim(),
        password: $("p").value
      })
    });

    token = d.token;

    localStorage.setItem("miAdminToken", token);

    openApp();

  } catch (x) {
    $("lm").textContent = "❌ " + x.message;
  }
}

$("loginForm").onsubmit = login;

$("logout").onclick = logout;


/* =========================
   SIDEBAR NAVIGATION
========================= */

document
  .querySelectorAll("aside button[data-s]")
  .forEach((b) => {
    b.onclick = () => load(b.dataset.s);
  });


/* =========================
   OPEN ADMIN APP
========================= */

function openApp() {
  if (!token) return;

  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");

  load("dashboard");
}


/* =========================
   LOAD SECTION
========================= */

async function load(s) {
  section = s;

  document
    .querySelectorAll("aside button[data-s]")
    .forEach((b) => {
      b.classList.toggle(
        "active",
        b.dataset.s === s
      );
    });

  $("title").textContent = {
    dashboard: "Dashboard",
    staff: "Faculties",
    council: "Council Members",
    events: "Events",
    feedback: "Queries & Feedback",
    students: "Students"
  }[s];

  try {
    await {
      dashboard,
      staff,
      council,
      events,
      feedback,
      students
    }[s]();

  } catch (e) {
    $("content").innerHTML =
      `<div class="panel">❌ ${esc(e.message)}</div>`;
  }
}


/* =========================
   DASHBOARD
========================= */

async function dashboard() {
  const d = await api("/admin/analytics");

  $("content").innerHTML = `
    <div class="stats">

      <div class="stat">
        <span>Unique Visitors</span>
        <strong>${d.uniqueVisitors}</strong>
      </div>

      <div class="stat">
        <span>Page Views</span>
        <strong>${d.pageViews}</strong>
      </div>

      <div class="stat">
        <span>Student Registrations</span>
        <strong>${d.students}</strong>
      </div>

      <div class="stat">
        <span>Event Enrollments</span>
        <strong>${d.enrollments}</strong>
      </div>

      <div class="stat">
        <span>Faculties</span>
        <strong>${d.staff}</strong>
      </div>

      <div class="stat">
        <span>Council Members</span>
        <strong>${d.council}</strong>
      </div>

      <div class="stat">
        <span>Events</span>
        <strong>${d.events}</strong>
      </div>

      <div class="stat">
        <span>Queries / Feedback</span>
        <strong>${d.feedback}</strong>
      </div>

    </div>

    <div class="panel" style="margin-top:20px">

      <div class="panelhead">
        <h3>Website Views — Last 7 Days</h3>
      </div>

      <div class="chart">

        ${d.daily.map((x) => `
          <div class="barwrap">

            <b>${x.views}</b>

            <div
              class="bar"
              style="height:${Math.max(
                3,
                Math.min(100, x.views * 8)
              )}%"
            ></div>

            <small>${x.day}</small>

          </div>
        `).join("")}

      </div>

    </div>
  `;
}


/* =========================
   MODAL
========================= */

function modal(title, body, save) {

  const m = document.createElement("div");

  m.className = "modal";

  m.innerHTML = `
    <div class="modalbox">

      <div class="modalhead">

        <h3>${title}</h3>

        <button class="close">×</button>

      </div>

      ${body}

    </div>
  `;

  document.body.appendChild(m);

  m.querySelector(".close").onclick = () => m.remove();

  m.querySelector("form").onsubmit = async (e) => {

    e.preventDefault();

    try {

      await save(
        Object.fromEntries(
          new FormData(e.target)
        )
      );

      m.remove();

      load(section);

    } catch (x) {

      alert("❌ " + x.message);

    }
  };

  m.querySelector(".cancel").onclick = () => m.remove();
}


/* =========================
   STAFF
========================= */

async function staff() {

  const rows = await api("/admin/staff");

  $("content").innerHTML = `

    <div class="panel">

      <div class="panelhead">

        <h3>Faculties / Staff</h3>

        <button
          class="add"
          onclick="staffForm()"
        >
          + Add Staff
        </button>

      </div>

      <div class="cards">

        ${rows.map((r) => `

          <div class="card">

            <img
              src="../${esc(
                r.image || "images/logo3.png"
              )}"
              onerror="this.src='../images/logo3.png'"
            >

            <div class="cardbody">

              <h3>${esc(r.name)}</h3>

              <h4>${esc(r.designation)}</h4>

              <p>
                ${esc(r.description || "")}
              </p>

              <div class="actions">

                <button
                  class="btn edit"
                  onclick='staffForm(${JSON.stringify(r)})'
                >
                  Edit
                </button>

                <button
                  class="btn del"
                  onclick="del('staff',${r.id})"
                >
                  Delete
                </button>

              </div>

            </div>

          </div>

        `).join("")}

      </div>

    </div>

  `;
}


/* =========================
   STAFF FORM
========================= */

function staffForm(r) {

  r = r || {};

  modal(
    r.id ? "Edit Staff" : "Add Staff",

    `
      <form class="form">

        <label>
          Name
          <input
            name="name"
            value="${esc(r.name)}"
            required
          >
        </label>

        <label>
          Designation
          <input
            name="designation"
            value="${esc(r.designation)}"
            required
          >
        </label>

        <label class="full">
          Qualification
          <input
            name="qualification"
            value="${esc(r.qualification)}"
          >
        </label>

        <label class="full">
          Description
          <textarea
            name="description"
            rows="4"
          >${esc(r.description)}</textarea>
        </label>

        <label class="full">
          Photo Path
          <input
            name="image"
            value="${esc(
              r.image || "images/staff1.png"
            )}"
            required
          >
        </label>

        <div class="formactions">

          <button
            type="button"
            class="cancel"
          >
            Cancel
          </button>

          <button class="add">
            ${r.id ? "Update Staff" : "Add Staff"}
          </button>

        </div>

      </form>
    `,

    (d) =>
      api(
        r.id
          ? "/admin/staff/" + r.id
          : "/admin/staff",
        {
          method: r.id ? "PUT" : "POST",
          body: JSON.stringify(d)
        }
      )
  );
}


/* =========================
   COUNCIL
========================= */

async function council() {

  const rows = await api("/admin/council");

  $("content").innerHTML = `

    <div class="panel">

      <div class="panelhead">

        <h3>Council Members</h3>

        <button
          class="add"
          onclick="councilForm()"
        >
          + Add Council Member
        </button>

      </div>

      <div class="cards">

        ${rows.map((r) => `

          <div class="card">

            <img
              src="../${esc(
                r.image || "images/logo3.png"
              )}"
              onerror="this.src='../images/logo3.png'"
            >

            <div class="cardbody">

              <h3>${esc(r.name)}</h3>

              <h4>${esc(r.designation)}</h4>

              <p>
                ${esc(r.description)}
              </p>

              <div class="actions">

                <button
                  class="btn edit"
                  onclick='councilForm(${JSON.stringify(r)})'
                >
                  Edit
                </button>

                <button
                  class="btn del"
                  onclick="del('council',${r.id})"
                >
                  Delete
                </button>

              </div>

            </div>

          </div>

        `).join("")}

      </div>

    </div>

  `;
}


/* =========================
   COUNCIL FORM
========================= */

function councilForm(r) {

  r = r || {};

  modal(
    r.id
      ? "Edit Council Member"
      : "Add Council Member",

    `
      <form class="form">

        <label>
          Name
          <input
            name="name"
            value="${esc(r.name)}"
            required
          >
        </label>

        <label>
          Designation
          <input
            name="designation"
            value="${esc(r.designation)}"
            required
          >
        </label>

        <label class="full">
          Description
          <textarea
            name="description"
            rows="4"
          >${esc(r.description)}</textarea>
        </label>

        <label class="full">
          Photo Path
          <input
            name="image"
            value="${esc(
              r.image || "images/member1 (2).png"
            )}"
            required
          >
        </label>

        <div class="formactions">

          <button
            type="button"
            class="cancel"
          >
            Cancel
          </button>

          <button class="add">
            ${r.id ? "Update" : "Add Member"}
          </button>

        </div>

      </form>
    `,

    (d) =>
      api(
        r.id
          ? "/admin/council/" + r.id
          : "/admin/council",
        {
          method: r.id ? "PUT" : "POST",
          body: JSON.stringify(d)
        }
      )
  );
}


/* =========================
   EVENTS
========================= */

async function events() {

  const rows = await api("/admin/events");

  $("content").innerHTML = `

    <div class="panel">

      <div class="panelhead">

        <h3>Events</h3>

        <button
          class="add"
          onclick="eventForm()"
        >
          + Add Event
        </button>

      </div>

      <div class="cards">

        ${rows.map((r) => `

          <div class="card">

            <img
              src="../${esc(
                r.image || "images/logo3.png"
              )}"
              onerror="this.src='../images/logo3.png'"
            >

            <div class="cardbody">

              <h3>${esc(r.name)}</h3>

              <p>

                <b>Venue:</b>
                ${esc(r.venue || "-")}
                <br>

                <b>Time:</b>
                ${esc(r.event_time || "-")}
                <br>

                <b>Team:</b>
                ${esc(r.team_info || "-")}

              </p>

              <div class="actions">

                <button
                  class="btn edit"
                  onclick='eventForm(${JSON.stringify(r)})'
                >
                  Edit
                </button>

                <button
                  class="btn del"
                  onclick="del('events',${r.id})"
                >
                  Delete
                </button>

              </div>

            </div>

          </div>

        `).join("")}

      </div>

    </div>

  `;
}


/* =========================
   EVENT FORM
========================= */

function eventForm(r) {

  r = r || {};

  modal(
    r.id ? "Edit Event" : "Add Event",

    `
      <form class="form">

        <label>
          Event Name
          <input
            name="name"
            value="${esc(r.name)}"
            required
          >
        </label>

        <label>
          Date
          <input
            type="date"
            name="event_date"
            value="${esc(r.event_date)}"
          >
        </label>

        <label>
          Venue
          <input
            name="venue"
            value="${esc(r.venue)}"
            required
          >
        </label>

        <label>
          Time
          <input
            name="event_time"
            value="${esc(r.event_time)}"
          >
        </label>

        <label>
          Team Info
          <input
            name="team_info"
            value="${esc(r.team_info)}"
          >
        </label>

        <label>
          Details Page
          <input
            name="details_url"
            value="${esc(r.details_url)}"
          >
        </label>

        <label class="full">
          Description
          <textarea
            name="description"
            rows="4"
          >${esc(r.description)}</textarea>
        </label>

        <label class="full">
          Image Path
          <input
            name="image"
            value="${esc(
              r.image || "images/Quiz.png.png"
            )}"
            required
          >
        </label>

        <div class="formactions">

          <button
            type="button"
            class="cancel"
          >
            Cancel
          </button>

          <button class="add">
            ${r.id ? "Update Event" : "Add Event"}
          </button>

        </div>

      </form>
    `,

    (d) =>
      api(
        r.id
          ? "/admin/events/" + r.id
          : "/admin/events",
        {
          method: r.id ? "PUT" : "POST",
          body: JSON.stringify(d)
        }
      )
  );
}


/* =========================
   FEEDBACK
========================= */

async function feedback() {

  const rows = await api("/admin/feedback");

  $("content").innerHTML = `

    <div class="panel">

      <div class="panelhead">
        <h3>Queries & Feedback</h3>
      </div>

      <table class="table">

        <tr>
          <th>Name</th>
          <th>Register Number</th>
          <th>Message</th>
          <th>Date</th>
          <th>Action</th>
        </tr>

        ${rows.map((r) => `

          <tr>

            <td>${esc(r.name)}</td>

            <td>
              ${esc(r.register_number || "-")}
            </td>

            <td>
              ${esc(r.message)}
            </td>

            <td>
              ${new Date(
                r.created_at
              ).toLocaleString()}
            </td>

            <td>

              <button
                class="btn del"
                onclick="del('feedback',${r.id})"
              >
                Delete
              </button>

            </td>

          </tr>

        `).join("")}

      </table>

    </div>

  `;
}


/* =========================
   STUDENTS
========================= */

async function students() {

  const rows = await api("/admin/students");

  $("content").innerHTML = `

    <div class="panel">

      <div class="panelhead">

        <h3>Students</h3>

        <span>
          ${rows.length} records
        </span>

      </div>

      <table class="table">

        <tr>
          <th>Name</th>
          <th>Register Number</th>
          <th>Batch</th>
          <th>Domain</th>
          <th>Date</th>
        </tr>

        ${rows.map((r) => `

          <tr>

            <td>${esc(r.name)}</td>

            <td>
              ${esc(r.register_number)}
            </td>

            <td>
              ${esc(r.batch)}
            </td>

            <td>
              ${esc(r.domain)}
            </td>

            <td>
              ${new Date(
                r.created_at
              ).toLocaleString()}
            </td>

          </tr>

        `).join("")}

      </table>

    </div>

  `;
}


/* =========================
   DELETE
========================= */

async function del(type, id) {

  if (
    !confirm(
      "Are you sure you want to delete this?"
    )
  ) {
    return;
  }

  await api(
    "/admin/" + type + "/" + id,
    {
      method: "DELETE"
    }
  );

  load(section);
}


/* =========================
   START APP
========================= */

openApp();