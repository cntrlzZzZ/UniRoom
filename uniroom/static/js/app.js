// ===== Day view calendar =====

const START_HOUR = 8;   // 08:00
const END_HOUR = 20;    // 20:00
const STEP_MIN = 30;    // 30-min slots
const SLOT_HEIGHT = 34; // px per slot

const state = {
  rooms: [],
  dateStr: null,
  user: null,
  selected: {
    roomId: null,
    startTime: null, // "HH:MM"
    endTime: null,   // "HH:MM"
  }
};

function $(id) { return document.getElementById(id); }

function pad2(n) { return String(n).padStart(2, "0"); }

function showAlert(msg) {
  const el = $("bookingAlert");
  el.textContent = msg;
  el.classList.remove("d-none");
}

function hideAlert() {
  const el = $("bookingAlert");
  el.classList.add("d-none");
  el.textContent = "";
}

function timeFromMinutes(totalMins) {
  const hh = Math.floor(totalMins / 60);
  const mm = totalMins % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function combineDateTime(dateStr, hhmm) {
  // returns ISO string without timezone; backend will make it aware
  return `${dateStr}T${hhmm}:00`;
}

async function apiPost(url, bodyObj) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(bodyObj),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ===== Session helpers and login UI helpers =====
async function apiSessionMe() {
  return apiGet("/api/session/me");
}

async function apiSessionLogin(email, studentId) {
  return apiPost("/api/session/login", { email: email, student_id: studentId });
}

async function apiSessionLogout() {
  return apiPost("/api/session/logout", {});
}

function setAuthUI(user) {
  state.user = user;

  const status = $("authStatus");
  const btnLogin = $("btnOpenLogin");
  const btnLogout = $("btnLogout");

  if (!user) {
    if (status) status.textContent = "Not logged in";
    if (btnLogin) btnLogin.classList.remove("d-none");
    if (btnLogout) btnLogout.classList.add("d-none");

    // Unlock inputs (backend will still block actions)
    if ($("ownerEmail")) $("ownerEmail").readOnly = false;
    if ($("ownerStudentId")) $("ownerStudentId").readOnly = false;
    if ($("myEmail")) $("myEmail").readOnly = false;
    return;
  }

  if (status) status.textContent = user.email;
  if (btnLogin) btnLogin.classList.add("d-none");
  if (btnLogout) btnLogout.classList.remove("d-none");

  // Fill + lock identity fields (prevents spoofing in UI; backend enforces session)
  if ($("ownerEmail")) { $("ownerEmail").value = user.email; $("ownerEmail").readOnly = true; }
  if ($("ownerStudentId")) { $("ownerStudentId").value = user.student_id; $("ownerStudentId").readOnly = true; }
  if ($("myEmail")) { $("myEmail").value = user.email; $("myEmail").readOnly = true; }
}

function showLoginAlert(msg) {
  const el = $("loginAlert");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("d-none");
}

function hideLoginAlert() {
  const el = $("loginAlert");
  if (!el) return;
  el.classList.add("d-none");
  el.textContent = "";
}

async function apiDelete(url) {
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Accept": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function showMyBookingsAlert(msg) {
  const el = $("myBookingsAlert");
  el.textContent = msg;
  el.classList.remove("d-none");
}

function hideMyBookingsAlert() {
  const el = $("myBookingsAlert");
  el.classList.add("d-none");
  el.textContent = "";
}

// ===== Helpers =====

function showFiltersAlert(msg) {
  const el = $("filtersAlert");
  el.textContent = msg;
  el.classList.remove("d-none");
}

function hideFiltersAlert() {
  const el = $("filtersAlert");
  el.classList.add("d-none");
  el.textContent = "";
}

function setSearchStatus(msg) {
  const el = $("searchStatus");
  if (el) el.textContent = msg;
}

function parseTimeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h * 60) + m;
}

function addDays(dateStr, delta) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

function roomMatchesFilters(room, minCapacity, equipmentTerms) {
  if (minCapacity && room.capacity < minCapacity) return false;

  if (equipmentTerms.length) {
    const hay = (room.equipment || []).join(" ").toLowerCase();
    for (const term of equipmentTerms) {
      if (!hay.includes(term)) return false;
    }
  }
  return true;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateStr(s) {
  // YYYY-MM-DD -> Date in local time
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtTime(dateObj) {
  return `${pad2(dateObj.getHours())}:${pad2(dateObj.getMinutes())}`;
}

function openBookingDrawer(room, startTime, endTime) {
  state.selected.roomId = room.id;
  state.selected.startTime = startTime;
  state.selected.endTime = endTime;

  hideAlert();

  $("drawerRoomName").textContent = room.name;
  $("drawerRoomMeta").textContent = `${room.capacity} seats • ${room.location || "No location"} • ${room.equipment.join(", ") || "No equipment info"}`;

  $("startTime").value = startTime;
  $("endTime").value = endTime;

  // open bootstrap offcanvas
  const el = $("bookingDrawer");
  const drawer = bootstrap.Offcanvas.getOrCreateInstance(el);
  drawer.show();
}

async function apiGet(url) {
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function setStatus(msg) {
  $("statusText").textContent = msg;
}

function buildTimeColumn(totalSlots) {
  const timeCol = document.createElement("div");
  timeCol.className = "time-col";

  // spacer to align with room headers
  const spacer = document.createElement("div");
  spacer.style.height = "54px";
  timeCol.appendChild(spacer);

  for (let i = 0; i < totalSlots; i++) {
    const minutesFromStart = i * STEP_MIN;
    const hour = START_HOUR + Math.floor(minutesFromStart / 60);
    const min = minutesFromStart % 60;

    const label = document.createElement("div");
    label.className = "time-label";
    label.style.setProperty("--slot-height", `${SLOT_HEIGHT}px`);

    // show label on full hours only
    label.textContent = (min === 0) ? `${pad2(hour)}:00` : "";
    timeCol.appendChild(label);
  }

  return timeCol;
}

function buildRoomColumn(room, totalSlots) {
  const col = document.createElement("div");
  col.className = "room-col";

  const header = document.createElement("div");
  header.className = "room-header";
  header.innerHTML = `
    <div class="d-flex justify-content-between align-items-start">
      <div>
        <div class="fw-semibold">${room.name}</div>
        <div class="text-muted small">${room.capacity} seats</div>
      </div>
    </div>
  `;
  col.appendChild(header);

  const timeline = document.createElement("div");
  timeline.className = "timeline";
  timeline.dataset.roomId = String(room.id);

  // set a CSS var so slot-row & labels use same height
  timeline.style.setProperty("--slot-height", `${SLOT_HEIGHT}px`);

  for (let i = 0; i < totalSlots; i++) {
    const row = document.createElement("div");
    row.className = "slot-row";
    row.addEventListener("click", (e) => {
      const rect = timeline.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const slotIndex = Math.floor(y / SLOT_HEIGHT);
      const mins = slotIndex * STEP_MIN;

      const startTotal = START_HOUR * 60 + mins;
      const endTotal = startTotal + 60; // default 1 hour

      const startTime = timeFromMinutes(startTotal);
      const endTime = timeFromMinutes(Math.min(endTotal, END_HOUR * 60));

      openBookingDrawer(room, startTime, endTime);
    });
    timeline.appendChild(row);
  }

  col.appendChild(timeline);
  return col;
}

function minutesSinceStartOfGrid(dateObj) {
  const mins = dateObj.getHours() * 60 + dateObj.getMinutes();
  return mins - START_HOUR * 60;
}

function drawBusyBlocks(bookingsByRoom) {
  // bookingsByRoom keys are strings (room_id) from backend
  for (const room of state.rooms) {
    const timeline = document.querySelector(`.timeline[data-room-id="${room.id}"]`);
    if (!timeline) continue;

    // Remove old blocks
    timeline.querySelectorAll(".busy-block").forEach(n => n.remove());

    const bookings = bookingsByRoom[String(room.id)] || [];
    for (const b of bookings) {
      const start = new Date(b.start);
      const end = new Date(b.end);

      const startMin = minutesSinceStartOfGrid(start);
      const endMin = minutesSinceStartOfGrid(end);

      // clamp to visible day range
      const clampStart = Math.max(0, startMin);
      const clampEnd = Math.min((END_HOUR - START_HOUR) * 60, endMin);

      const topPx = (clampStart / STEP_MIN) * SLOT_HEIGHT;
      const heightPx = Math.max(10, ((clampEnd - clampStart) / STEP_MIN) * SLOT_HEIGHT);

      const block = document.createElement("div");
      block.className = "busy-block";
      block.style.top = `${topPx}px`;
      block.style.height = `${heightPx}px`;

      block.innerHTML = `
        <div class="busy-title">Booked</div>
        <div class="busy-time">${fmtTime(start)}–${fmtTime(end)}</div>
      `;

      timeline.appendChild(block);
    }
  }
}

function renderGrid() {
  const grid = $("calendarGrid");
  grid.innerHTML = "";

  const totalSlots = ((END_HOUR - START_HOUR) * 60) / STEP_MIN;

  grid.appendChild(buildTimeColumn(totalSlots));
  for (const room of state.rooms) {
    grid.appendChild(buildRoomColumn(room, totalSlots));
  }
}

async function refresh() {
  try {
    setStatus("Loading…");

    const roomsJson = await apiGet("/api/rooms");
    state.rooms = roomsJson.rooms;

    renderGrid();

    const availJson = await apiGet(`/api/availability?date=${encodeURIComponent(state.dateStr)}`);
    drawBusyBlocks(availJson.bookings_by_room);

    setStatus(`Showing ${state.dateStr}`);
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  }
}

function shiftDay(delta) {
  const d = parseDateStr(state.dateStr);
  d.setDate(d.getDate() + delta);
  state.dateStr = toDateStr(d);
  $("datePicker").value = state.dateStr;
  refresh();
}

function renderMyBookings(bookings) {
  const list = $("myBookingsList");
  list.innerHTML = "";

  if (!bookings.length) {
    list.innerHTML = `<div class="list-group-item text-muted">No bookings found.</div>`;
    return;
  }

  for (const b of bookings) {
    const start = new Date(b.start);
    const end = new Date(b.end);

    const attendeesText = (b.attendees && b.attendees.length)
      ? b.attendees.join(", ")
      : "—";

    const item = document.createElement("div");
    item.className = "list-group-item";

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div class="flex-grow-1">
          <div class="fw-semibold">${b.room.name}</div>
          <div class="small text-muted">${start.toLocaleString()} – ${end.toLocaleTimeString()}</div>
          <div class="small"><span class="text-muted">Attendees:</span> ${attendeesText}</div>
        </div>
        <button class="btn btn-outline-danger btn-sm btn-cancel-booking" data-booking-id="${b.id}">
          Cancel
        </button>
      </div>
    `;

    list.appendChild(item);
  }
}

async function refreshMyBookings() {
  hideMyBookingsAlert();

  if (!state.user) {
    renderMyBookings([]);
    return;
  }

  try {
    const data = await apiGet(`/api/my-bookings`);
    renderMyBookings(data.bookings || []);
  } catch (err) {
    console.error(err);
    showMyBookingsAlert(err.message || "Failed to load bookings.");
  }
}

async function handleCancelClick(e) {
  const btn = e.target.closest(".btn-cancel-booking");
  if (!btn) return;

  const bookingId = btn.dataset.bookingId;

  if (!bookingId) return;
  if (!state.user) {
    showMyBookingsAlert("Please log in first.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Cancelling…";

  try {
    await apiDelete(`/api/bookings/${bookingId}`);

    // Refresh both list + calendar
    await refreshMyBookings();
    await refresh();
  } catch (err) {
    console.error(err);
    showMyBookingsAlert(err.message || "Failed to cancel booking.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Cancel";
  }
}

// ===== Result rendering + search =====

function renderAvailabilityResults(results) {
  const wrap = $("availabilityResultsWrap");
  const list = $("availabilityResults");
  list.innerHTML = "";

  if (!results.length) {
    wrap.classList.remove("d-none");
    list.innerHTML = `<div class="list-group-item text-muted">No matches found.</div>`;
    return;
  }

  wrap.classList.remove("d-none");

  for (const r of results) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "list-group-item list-group-item-action";

    item.dataset.date = r.date;
    item.dataset.roomId = String(r.roomId);
    item.dataset.start = r.start;
    item.dataset.end = r.end;

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div class="fw-semibold">${r.roomName}</div>
          <div class="small text-muted">${r.date} • ${r.start}–${r.end}</div>
          <div class="small text-muted">Capacity: ${r.capacity}</div>
        </div>
        <div class="text-muted small">Tap to book</div>
      </div>
    `;

    list.appendChild(item);
  }
}

async function findAvailability() {
  hideFiltersAlert();
  setSearchStatus("");

  const days = Number($("filterDays").value || 7);
  const startStr = $("filterStart").value || "16:00";
  const endStr = $("filterEnd").value || "18:00";
  const minCap = Number($("filterCapacity").value || 0);

  const equipmentTerms = ($("filterEquipment").value || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  const wStart = parseTimeToMinutes(startStr);
  const wEnd = parseTimeToMinutes(endStr);

  if (wEnd <= wStart) {
    showFiltersAlert("End time must be after start time.");
    return;
  }
  if (days < 1 || days > 30) {
    showFiltersAlert("Next days must be between 1 and 30.");
    return;
  }

  // Ensure rooms loaded
  if (!state.rooms.length) {
    const roomsJson = await apiGet("/api/rooms");
    state.rooms = roomsJson.rooms;
  }

  const rooms = state.rooms.filter(r => roomMatchesFilters(r, minCap, equipmentTerms));

  if (!rooms.length) {
    renderAvailabilityResults([]);
    setSearchStatus("0 option(s) found");
    return;
  }

  const results = [];
  setSearchStatus("Searching…");

  for (let i = 0; i < days; i++) {
    const dateStr = addDays(state.dateStr, i);
    setSearchStatus(`Checking ${dateStr}…`);

    const avail = await apiGet(`/api/availability?date=${encodeURIComponent(dateStr)}`);
    const bookingsByRoom = avail.bookings_by_room || {};

    // Day start reference for robust overlap maths
    const dayStart = parseDateStr(dateStr);
    dayStart.setHours(0, 0, 0, 0);

    for (const room of rooms) {
      const bookings = bookingsByRoom[String(room.id)] || [];

      let conflict = false;
      for (const b of bookings) {
        const bs = new Date(b.start);
        const be = new Date(b.end);

        const bsMin = Math.floor((bs - dayStart) / 60000);
        const beMin = Math.floor((be - dayStart) / 60000);

        if (overlaps(bsMin, beMin, wStart, wEnd)) {
          conflict = true;
          break;
        }
      }

      if (!conflict) {
        results.push({
          date: dateStr,
          roomId: room.id,
          roomName: room.name,
          capacity: room.capacity,
          start: startStr,
          end: endStr,
        });
      }
    }
  }

  setSearchStatus(`${results.length} option(s) found`);
  renderAvailabilityResults(results);
}

async function init() {
  // Default to today
  const today = new Date();
  state.dateStr = toDateStr(today);

  $("datePicker").value = state.dateStr;

  $("btnPrev").addEventListener("click", () => shiftDay(-1));
  $("btnNext").addEventListener("click", () => shiftDay(1));
  $("btnToday").addEventListener("click", () => {
    state.dateStr = toDateStr(new Date());
    $("datePicker").value = state.dateStr;
    refresh();
  });

  // Refresh button
  $("btnLoadMyBookings").addEventListener("click", refreshMyBookings);

  // Handle cancel buttons
  $("myBookingsList").addEventListener("click", handleCancelClick);

  // ===== Session auth =====
  $("btnLoginSubmit").addEventListener("click", async () => {
    hideLoginAlert();
    const email = $("loginEmail").value.trim();
    const sid = $("loginStudentId").value.trim();

    if (!email || !sid) {
      showLoginAlert("Please enter email and student ID.");
      return;
    }

    try {
      const res = await apiSessionLogin(email, sid);
      setAuthUI(res.user);
      bootstrap.Modal.getOrCreateInstance($("loginModal")).hide();
      await refreshMyBookings();
    } catch (err) {
      showLoginAlert(err.message || "Login failed.");
    }
  });

  $("btnLogout").addEventListener("click", async () => {
    await apiSessionLogout();
    setAuthUI(null);
    renderMyBookings([]);
  });

  // Initialise auth state
  try {
    const me = await apiSessionMe();
    setAuthUI(me.user);
  } catch (e) {
    setAuthUI(null);
  }

  $("datePicker").addEventListener("change", (e) => {
    state.dateStr = e.target.value;
    refresh();
  });

  // ===== UI listeners =====

  $("btnFindAvailability").addEventListener("click", findAvailability);

  $("btnClearResults").addEventListener("click", () => {
    $("availabilityResultsWrap").classList.add("d-none");
    $("availabilityResults").innerHTML = "";
    setSearchStatus("");
    hideFiltersAlert();
  });

  // Tap a result -> jump to date and open booking drawer
  $("availabilityResults").addEventListener("click", async (e) => {
    const item = e.target.closest(".list-group-item");
    if (!item) return;

    const dateStr = item.dataset.date;
    const roomId = Number(item.dataset.roomId);
    const start = item.dataset.start;
    const end = item.dataset.end;

    state.dateStr = dateStr;
    $("datePicker").value = dateStr;

    await refresh();

    const room = state.rooms.find(r => r.id === roomId);
    if (room) openBookingDrawer(room, start, end);
  });

  $("btnConfirmBooking").addEventListener("click", async () => {
    hideAlert();

    const roomId = state.selected.roomId;
    const startTime = $("startTime").value;
    const endTime = $("endTime").value;

    if (!state.user) {
      showAlert("Please log in first.");
      bootstrap.Modal.getOrCreateInstance($("loginModal")).show();
      return;
    }

    const attendeesRaw = $("attendees").value.trim();
    const attendees = attendeesRaw
      ? attendeesRaw.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    if (!roomId) return showAlert("No room selected.");
    if (!startTime || !endTime) return showAlert("Please select start and end time.");

    try {
      await apiPost("/api/bookings", {
        room_id: roomId,
        start: combineDateTime(state.dateStr, startTime),
        end: combineDateTime(state.dateStr, endTime),
        attendees: attendees,
      });

      // close drawer
      bootstrap.Offcanvas.getOrCreateInstance($("bookingDrawer")).hide();

      // refresh calendar so busy block appears
      await refresh();
    } catch (err) {
      if (err.status === 409 && err.data && err.data.code === "CONFLICT") {
        showAlert("That slot just got booked. Pick another time.");
      } else {
        showAlert(err.message || "Something went wrong.");
      }
    }
  });

  // PWA: service worker
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js");
      console.log("Service worker registered");
    } catch (e) {
      console.log("Service worker registration failed", e);
    }
  }

  refresh();
  if (state.user) refreshMyBookings();
}

document.addEventListener("DOMContentLoaded", init);