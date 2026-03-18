/**
 * Cake Distribution System - Standalone Version
 * SuperTeacher | Georg-Simon-Ohm Berufskolleg
 *
 * GDPR-compliant booking system with Supabase backend
 */

// =====================================================
// CONFIGURATION
// =====================================================

const CONFIG = {
    weeksAhead: 12,
    autoDeleteDays: 7
};

// Schedule - English classes only (day: 0=Sun, 1=Mon, 2=Tue, etc.)
// Upper Level classes have a lastDate (letzter Schultag Oberstufe)
const SCHEDULE = [
    { day: 2, start: '11:25', end: '12:55', class: 'IAF53', level: 'Lower Level', room: 'B117' },
    { day: 1, start: '09:35', end: '11:05', class: 'IAF32', level: 'Upper Level', room: 'B117', lastDate: '2026-05-13' },
    { day: 3, start: '09:35', end: '11:05', class: 'IAF32', level: 'Upper Level', room: 'B117', lastDate: '2026-05-13' },
    { day: 1, start: '11:25', end: '12:55', class: 'IAF31', level: 'Upper Level', room: 'B117', lastDate: '2026-05-13' },
    { day: 3, start: '11:25', end: '12:55', class: 'IAF31', level: 'Upper Level', room: 'B117', lastDate: '2026-05-13' },
    { day: 4, start: '11:25', end: '12:55', class: 'IAF52', level: 'Lower Level', room: 'B119' },
    { day: 4, start: '13:15', end: '14:45', class: 'IAF51', level: 'Lower Level', room: 'B119' }
];

// Penalty types with limits per session
const PENALTY_TYPES = [
    { id: 'cake', label: 'Cake', icon: '🎂', maxPerSession: 2 },
    { id: 'essay', label: 'Essay', icon: '✍️', maxPerSession: 5 },
    { id: 'pushups', label: 'Push-ups', icon: '💪', maxPerSession: 99 }
];

// NRW Holidays 2025 & 2026
const HOLIDAYS_NRW = [
    '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-05-29',
    '2025-06-09','2025-06-19','2025-10-03','2025-11-01','2025-12-25','2025-12-26',
    '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-05-14',
    '2026-05-25','2026-06-04','2026-10-03','2026-11-01','2026-12-25','2026-12-26'
];

const SCHOOL_HOLIDAYS_NRW = [
    { start: '2025-01-01', end: '2025-01-06' },
    { start: '2025-04-14', end: '2025-04-26' },
    { start: '2025-06-10', end: '2025-06-10' },
    { start: '2025-07-14', end: '2025-08-26' },
    { start: '2025-10-13', end: '2025-10-25' },
    { start: '2025-12-22', end: '2026-01-06' },
    { start: '2026-03-30', end: '2026-04-12' },
    { start: '2026-05-26', end: '2026-05-26' },
    { start: '2026-06-29', end: '2026-08-11' }
];

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// =====================================================
// STATE
// =====================================================

const state = {
    bookings: [],
    currentStep: 1,
    selectedClass: null,
    studentName: '',
    selectedPenalty: null,
    selectedDate: null,
    studentEmail: '',
    wantsReminder: false,
    dataConsent: false,
    createdBooking: null,
    adminUnlocked: false,
    activeFilter: 'All',
    loading: false
};

// =====================================================
// API FUNCTIONS
// =====================================================

async function fetchBookings() {
    try {
        const res = await fetch('/api/bookings');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        // Map from snake_case DB fields to camelCase
        state.bookings = data.map(b => ({
            id: b.id,
            studentName: b.student_name,
            studentEmail: b.student_email,
            class: b.class,
            date: b.date,
            time: b.time,
            penaltyType: b.penalty_type,
            completed: b.completed,
            deleted: b.deleted,
            emailConsent: b.email_consent,
            createdAt: b.created_at
        }));
    } catch (e) {
        console.error('Failed to load bookings:', e);
        state.bookings = [];
    }
}

async function saveBookingToServer(booking) {
    const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
    });
    if (!res.ok) throw new Error('Failed to save booking');
    return await res.json();
}

async function updateBookingOnServer(id, updates) {
    const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update booking');
    return await res.json();
}

async function verifyAdminPassword(hash) {
    const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordHash: hash })
    });
    return res.ok;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

async function hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function isHolidayOrVacation(date) {
    const dateStr = date.toISOString().split('T')[0];
    if (HOLIDAYS_NRW.includes(dateStr)) return true;
    for (const vac of SCHOOL_HOLIDAYS_NRW) {
        const start = new Date(vac.start);
        const end = new Date(vac.end);
        if (date >= start && date <= end) return true;
    }
    return false;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
}

function getAvailableDates(className, penaltyType) {
    // Find ALL schedule entries for this class (may have multiple days)
    const classSchedules = SCHEDULE.filter(s => s.class === className);
    if (classSchedules.length === 0) return [];

    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const current = new Date(today);
    current.setDate(current.getDate() + 1);

    const defaultEnd = new Date(today);
    defaultEnd.setDate(defaultEnd.getDate() + CONFIG.weeksAhead * 7);

    while (current <= defaultEnd) {
        // Check each schedule entry for this class
        for (const schedule of classSchedules) {
            // Respect lastDate if set (e.g. letzter Schultag Oberstufe)
            if (schedule.lastDate && current > new Date(schedule.lastDate)) continue;

            if (current.getDay() === schedule.day && !isHolidayOrVacation(current)) {
                const dateStr = current.toISOString().split('T')[0];
                const existingBookings = state.bookings.filter(
                    b => b.date === dateStr && b.class === className &&
                         b.penaltyType === penaltyType && !b.deleted
                );
                const penaltyConfig = PENALTY_TYPES.find(p => p.id === penaltyType);
                const spotsLeft = penaltyConfig.maxPerSession - existingBookings.length;

                if (spotsLeft > 0) {
                    dates.push({ date: new Date(current), dateStr, spotsLeft, schedule });
                }
            }
        }
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function generateICS(booking) {
    const classSchedule = SCHEDULE.find(s => s.class === booking.class && s.start === booking.time) || SCHEDULE.find(s => s.class === booking.class);
    const penaltyInfo = PENALTY_TYPES.find(p => p.id === booking.penaltyType);
    const startDate = new Date(booking.date + 'T' + classSchedule.start + ':00');
    const endDate = new Date(booking.date + 'T' + classSchedule.end + ':00');

    const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const alarms = [3, 1, 0].map(days =>
        `\nBEGIN:VALARM\nTRIGGER:-P${days}D\nACTION:DISPLAY\nDESCRIPTION:Reminder: Bring ${penaltyInfo.label} for English class!\nEND:VALARM`
    ).join('');

    return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Cake Distribution System//SuperTeacher//EN\nBEGIN:VEVENT\nUID:${booking.id}@cake-booking\nDTSTAMP:${fmt(new Date())}\nDTSTART:${fmt(startDate)}\nDTEND:${fmt(endDate)}\nSUMMARY:${penaltyInfo.icon} ${penaltyInfo.label} - English ${booking.class}\nDESCRIPTION:Don't forget: Bring ${penaltyInfo.label}!\\n\\nClass: ${booking.class}\\nRoom: ${classSchedule.room}\\nTime: ${classSchedule.start} - ${classSchedule.end}\nLOCATION:${classSchedule.room}${alarms}\nEND:VEVENT\nEND:VCALENDAR`;
}

function downloadICS(booking) {
    const ics = generateICS(booking);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reminder-${booking.penaltyType}-${booking.date}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportCSV() {
    const futureBookings = state.bookings.filter(
        b => new Date(b.date) >= new Date() && !b.deleted
    );
    const csv = [
        ['Name','Email','Class','Date','Time','Type','Completed'].join(';'),
        ...futureBookings.map(b =>
            [b.studentName, b.studentEmail || '', b.class, b.date, b.time, b.penaltyType, b.completed ? 'Yes' : 'No'].join(';')
        )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cake-bookings-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =====================================================
// UI RENDERING
// =====================================================

function renderClassSelection() {
    const container = document.getElementById('classSelection');
    // Deduplicate classes (some have multiple days)
    const uniqueClasses = [];
    const seen = new Set();
    for (const s of SCHEDULE) {
        if (!seen.has(s.class)) {
            seen.add(s.class);
            const allDays = SCHEDULE.filter(x => x.class === s.class)
                .map(x => DAY_NAMES[x.day]).join(' & ');
            uniqueClasses.push({ ...s, displayDays: allDays });
        }
    }
    container.innerHTML = uniqueClasses.map(s => `
        <div class="cake-class-card" data-class="${s.class}">
            <div class="cake-class-card__name">${s.class}</div>
            <div class="cake-class-card__level">${s.level}</div>
            <div class="cake-class-card__time">${s.displayDays} ${s.start}</div>
        </div>
    `).join('');

    container.querySelectorAll('.cake-class-card').forEach(card => {
        card.addEventListener('click', () => {
            container.querySelectorAll('.cake-class-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.selectedClass = card.dataset.class;
            updateStep1Button();
            const nameInput = document.getElementById('studentName');
            if (nameInput.value.trim()) {
                goToStep(2);
                renderPenaltyOptions();
            }
        });
    });
}

function renderPenaltyOptions() {
    const container = document.getElementById('penaltySelection');
    container.innerHTML = PENALTY_TYPES.map(p => `
        <div class="cake-penalty-card" data-penalty="${p.id}">
            <div class="cake-penalty-card__icon">${p.icon}</div>
            <div class="cake-penalty-card__info">
                <div class="cake-penalty-card__name">${p.label}</div>
                <div class="cake-penalty-card__limit">Max. ${p.maxPerSession} per class session</div>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.cake-penalty-card').forEach(card => {
        card.addEventListener('click', () => {
            state.selectedPenalty = card.dataset.penalty;
            goToStep(3);
            renderDateSelection();
        });
    });
}

function renderDateSelection() {
    const container = document.getElementById('dateSelection');
    const dates = getAvailableDates(state.selectedClass, state.selectedPenalty);

    if (dates.length === 0) {
        container.innerHTML = '<p class="cake-empty-state">No available dates.</p>';
        return;
    }

    container.innerHTML = dates.slice(0, 12).map((slot, i) => `
        <div class="cake-date-card ${i === 0 ? 'cake-date-card--next' : ''}" data-index="${i}">
            <div>
                <div class="cake-date-card__date">${formatDate(slot.dateStr)}</div>
                <div class="cake-date-card__time">${slot.schedule.start} - ${slot.schedule.end}, Room ${slot.schedule.room}</div>
            </div>
            <div>
                ${i === 0 ? '<span class="cake-date-card__badge">Next Date</span>' : ''}
                <div class="cake-date-card__spots">${slot.spotsLeft} ${slot.spotsLeft === 1 ? 'spot' : 'spots'} available</div>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.cake-date-card').forEach((card, i) => {
        card.addEventListener('click', () => {
            state.selectedDate = dates[i];
            goToStep(4);
            renderSummary();
        });
    });
}

function renderSummary() {
    const container = document.getElementById('bookingSummary');
    const penalty = PENALTY_TYPES.find(p => p.id === state.selectedPenalty);
    container.innerHTML = `
        <div class="cake-summary__row"><span class="cake-summary__label">Name:</span><span class="cake-summary__value">${state.studentName}</span></div>
        <div class="cake-summary__row"><span class="cake-summary__label">Class:</span><span class="cake-summary__value">${state.selectedClass}</span></div>
        <div class="cake-summary__row"><span class="cake-summary__label">What:</span><span class="cake-summary__value">${penalty.icon} ${penalty.label}</span></div>
        <div class="cake-summary__row"><span class="cake-summary__label">When:</span><span class="cake-summary__value">${formatDate(state.selectedDate.dateStr)}</span></div>
        <div class="cake-summary__row"><span class="cake-summary__label">Time:</span><span class="cake-summary__value">${state.selectedDate.schedule.start}</span></div>
    `;
}

function renderSuccess() {
    const booking = state.createdBooking;
    const penalty = PENALTY_TYPES.find(p => p.id === booking.penaltyType);
    document.getElementById('successMessage').textContent =
        `${booking.studentName}, your appointment for ${penalty.label} has been recorded.`;
    document.getElementById('successSummary').innerHTML = `
        <div class="cake-success__summary-date">${formatDate(booking.date)}</div>
        <div class="cake-success__summary-time">${booking.time} - ${booking.class}</div>
    `;
}

function renderAdminDashboard() {
    renderAdminStats();
    renderAdminFilter();
    renderBookingsList();
}

function renderAdminStats() {
    const container = document.getElementById('adminStats');
    const classes = [...new Set(SCHEDULE.map(s => s.class))];
    container.innerHTML = classes.map(cls => {
        const count = state.bookings.filter(b => b.class === cls && !b.completed && !b.deleted).length;
        return `
            <div class="cake-stat-card">
                <div class="cake-stat-card__class">${cls}</div>
                <div class="cake-stat-card__count">${count}</div>
                <div class="cake-stat-card__label">pending</div>
            </div>
        `;
    }).join('');
}

function renderAdminFilter() {
    const container = document.getElementById('classFilter');
    const classes = ['All', ...new Set(SCHEDULE.map(s => s.class))];
    container.innerHTML = '<span>Filter:</span>' + classes.map(cls => `
        <button class="cake-filter-btn ${state.activeFilter === cls ? 'active' : ''}" data-filter="${cls}">${cls}</button>
    `).join('');

    container.querySelectorAll('.cake-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.activeFilter = btn.dataset.filter;
            renderAdminFilter();
            renderBookingsList();
        });
    });
}

function renderBookingsList() {
    const container = document.getElementById('bookingsList');
    let filtered = state.bookings.filter(b => !b.deleted);
    if (state.activeFilter !== 'All') {
        filtered = filtered.filter(b => b.class === state.activeFilter);
    }

    const future = filtered.filter(b => new Date(b.date) >= new Date(new Date().setHours(0,0,0,0)));
    const grouped = {};
    future.forEach(b => {
        if (!grouped[b.date]) grouped[b.date] = [];
        grouped[b.date].push(b);
    });

    const sortedDates = Object.keys(grouped).sort();
    if (sortedDates.length === 0) {
        container.innerHTML = '<div class="cake-empty-state">No bookings available</div>';
        return;
    }

    container.innerHTML = sortedDates.map(date => {
        const bookings = grouped[date];
        return `
            <div class="cake-booking-day">
                <div class="cake-booking-day__header">${formatDate(date)}</div>
                ${bookings.map(b => {
                    const penalty = PENALTY_TYPES.find(p => p.id === b.penaltyType);
                    return `
                        <div class="cake-booking-item ${b.completed ? 'cake-booking-item--completed' : ''}" data-id="${b.id}">
                            <div class="cake-booking-item__info">
                                <span class="cake-booking-item__icon">${penalty.icon}</span>
                                <div>
                                    <div class="cake-booking-item__name">${b.studentName}</div>
                                    <div class="cake-booking-item__details">${b.class} &bull; ${b.time}${b.studentEmail ? ` &bull; ${b.studentEmail}` : ''}</div>
                                </div>
                            </div>
                            <div class="cake-booking-item__actions">
                                ${b.completed
                                    ? '<span class="cake-completed-badge">&#10003; Completed</span>'
                                    : '<button class="cake-booking-item__btn cake-booking-item__btn--complete" data-action="complete">&#10003; Complete</button>'
                                }
                                <button class="cake-booking-item__btn cake-booking-item__btn--delete" data-action="delete">&#128465;&#65039;</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');

    container.querySelectorAll('.cake-booking-item__btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const bookingId = btn.closest('.cake-booking-item').dataset.id;
            const action = btn.dataset.action;
            if (action === 'complete') {
                await markBookingComplete(bookingId);
            } else if (action === 'delete') {
                if (confirm('Really delete this booking?')) {
                    await deleteBooking(bookingId);
                }
            }
        });
    });
}

// =====================================================
// STEP NAVIGATION
// =====================================================

function goToStep(step) {
    state.currentStep = step;
    document.querySelectorAll('.cake-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');
}

function goToSuccess() {
    document.querySelectorAll('.cake-step').forEach(s => s.classList.remove('active'));
    document.getElementById('stepSuccess').classList.add('active');
}

function updateStep1Button() {
    const btn = document.getElementById('toStep2');
    const nameInput = document.getElementById('studentName');
    btn.disabled = !state.selectedClass || !nameInput.value.trim();
}

function resetStudentFlow() {
    state.currentStep = 1;
    state.selectedClass = null;
    state.studentName = '';
    state.selectedPenalty = null;
    state.selectedDate = null;
    state.studentEmail = '';
    state.wantsReminder = false;
    state.dataConsent = false;
    state.createdBooking = null;

    document.getElementById('studentName').value = '';
    document.getElementById('studentEmail').value = '';
    document.getElementById('wantsReminder').checked = false;
    document.getElementById('dataConsent').checked = false;
    document.getElementById('emailFields').style.display = 'none';
    document.querySelectorAll('.cake-class-card').forEach(c => c.classList.remove('selected'));

    goToStep(1);
    updateStep1Button();
}

// =====================================================
// BOOKING ACTIONS
// =====================================================

async function createBooking() {
    const confirmBtn = document.getElementById('confirmBooking');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Saving...';

    try {
        const bookingData = {
            studentName: state.studentName,
            studentEmail: (state.wantsReminder && state.dataConsent) ? state.studentEmail : '',
            class: state.selectedClass,
            date: state.selectedDate.dateStr,
            time: state.selectedDate.schedule.start,
            penaltyType: state.selectedPenalty,
            emailConsent: state.wantsReminder && state.dataConsent,
            consentTimestamp: state.dataConsent ? new Date().toISOString() : null
        };

        const saved = await saveBookingToServer(bookingData);

        // Map response to local format
        state.createdBooking = {
            id: saved.id,
            studentName: saved.student_name,
            studentEmail: saved.student_email,
            class: saved.class,
            date: saved.date,
            time: saved.time,
            penaltyType: saved.penalty_type,
            completed: saved.completed
        };

        // Refresh bookings from server
        await fetchBookings();

        renderSuccess();
        goToSuccess();
    } catch (e) {
        console.error('Failed to create booking:', e);
        alert('Failed to save booking. Please try again.');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '✓ Book Appointment';
    }
}

async function markBookingComplete(bookingId) {
    try {
        await updateBookingOnServer(bookingId, { completed: true });
        await fetchBookings();
        renderAdminDashboard();
    } catch (e) {
        console.error('Failed to complete booking:', e);
        alert('Failed to update booking.');
    }
}

async function deleteBooking(bookingId) {
    try {
        await updateBookingOnServer(bookingId, { deleted: true });
        await fetchBookings();
        renderAdminDashboard();
    } catch (e) {
        console.error('Failed to delete booking:', e);
        alert('Failed to delete booking.');
    }
}

// =====================================================
// FORM ERRORS
// =====================================================

function showFormError(input, errorId, message) {
    input.setAttribute('aria-invalid', 'true');
    const errorEl = document.getElementById(errorId);
    if (errorEl) errorEl.textContent = message;
    input.focus();
}

function clearFormErrors() {
    document.querySelectorAll('.cake-error').forEach(el => el.textContent = '');
    document.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function initEventListeners() {
    // Navigation
    document.querySelectorAll('.cake-nav-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const view = btn.dataset.view;
            document.querySelectorAll('.cake-nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.cake-view').forEach(v => v.classList.remove('active'));
            document.getElementById(`${view}View`).classList.add('active');

            if (view === 'student') {
                resetStudentFlow();
            } else if (view === 'admin' && state.adminUnlocked) {
                await fetchBookings();
                renderAdminDashboard();
            }
        });
    });

    // Step 1
    const nameInput = document.getElementById('studentName');
    nameInput.addEventListener('input', () => {
        state.studentName = nameInput.value.trim();
        updateStep1Button();
    });

    document.getElementById('toStep2').addEventListener('click', () => {
        goToStep(2);
        renderPenaltyOptions();
    });

    // Back buttons
    document.querySelectorAll('.cake-back-btn').forEach(btn => {
        btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.to)));
    });

    // Email reminder
    document.getElementById('wantsReminder').addEventListener('change', e => {
        state.wantsReminder = e.target.checked;
        document.getElementById('emailFields').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('studentEmail').addEventListener('input', e => {
        state.studentEmail = e.target.value;
        e.target.removeAttribute('aria-invalid');
        document.getElementById('emailError').textContent = '';
    });

    document.getElementById('dataConsent').addEventListener('change', e => {
        state.dataConsent = e.target.checked;
        e.target.removeAttribute('aria-invalid');
        document.getElementById('consentError').textContent = '';
    });

    // Privacy modal
    document.getElementById('showPrivacyInfo').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('privacyModal').classList.add('active');
    });
    document.getElementById('closePrivacyModal').addEventListener('click', () => {
        document.getElementById('privacyModal').classList.remove('active');
    });
    document.getElementById('acceptPrivacy').addEventListener('click', () => {
        document.getElementById('privacyModal').classList.remove('active');
    });
    document.getElementById('privacyModal').addEventListener('click', e => {
        if (e.target.id === 'privacyModal') {
            document.getElementById('privacyModal').classList.remove('active');
        }
    });

    // Confirm booking
    document.getElementById('confirmBooking').addEventListener('click', () => {
        clearFormErrors();
        if (state.wantsReminder) {
            const emailInput = document.getElementById('studentEmail');
            const consentInput = document.getElementById('dataConsent');
            if (!emailInput.value.trim()) {
                showFormError(emailInput, 'emailError', 'Please enter an email or disable the reminder.');
                return;
            }
            if (!consentInput.checked) {
                showFormError(consentInput, 'consentError', 'Please confirm consent to data processing.');
                return;
            }
        }
        createBooking();
    });

    // Calendar download
    document.getElementById('downloadCalendar').addEventListener('click', () => {
        if (state.createdBooking) downloadICS(state.createdBooking);
    });

    // New booking
    document.getElementById('newBooking').addEventListener('click', () => resetStudentFlow());

    // Admin login
    document.getElementById('adminLoginBtn').addEventListener('click', async () => {
        const passwordInput = document.getElementById('adminPassword');
        clearFormErrors();
        const inputHash = await hashPassword(passwordInput.value);
        const success = await verifyAdminPassword(inputHash);

        if (success) {
            state.adminUnlocked = true;
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            await fetchBookings();
            renderAdminDashboard();
        } else {
            showFormError(passwordInput, 'adminError', 'Wrong password.');
        }
    });

    document.getElementById('adminPassword').addEventListener('keypress', e => {
        if (e.key === 'Enter') document.getElementById('adminLoginBtn').click();
    });

    document.getElementById('adminPassword').addEventListener('input', () => {
        document.getElementById('adminPassword').removeAttribute('aria-invalid');
        document.getElementById('adminError').textContent = '';
    });

    // Admin actions
    document.getElementById('exportCSV').addEventListener('click', exportCSV);
    document.getElementById('refreshData').addEventListener('click', async () => {
        await fetchBookings();
        renderAdminDashboard();
    });

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('cake-theme', next);
        updateThemeIcon();
    });
}

function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const lightIcon = document.querySelector('.theme-icon-light');
    const darkIcon = document.querySelector('.theme-icon-dark');
    if (lightIcon) lightIcon.style.display = isDark ? 'none' : 'inline';
    if (darkIcon) darkIcon.style.display = isDark ? 'inline' : 'none';
}

// =====================================================
// INITIALIZATION
// =====================================================

async function init() {
    await fetchBookings();
    renderClassSelection();
    initEventListeners();
    updateStep1Button();
    updateThemeIcon();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
