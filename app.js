(function () {
  const STORAGE_KEY = "pomodoro-month-app";
  const QUICK_PUNCH_MINUTES = 15;
  const pad = (value) => String(value).padStart(2, "0");
  const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  const formatHours = (minutes) => {
    if (!minutes) return "0H";
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(2)}H`;
  };

  const state = {
    selectedMinutes: 0,
    sessionMinutes: 0,
    remaining: 0,
    total: 0,
    running: false,
    startedAt: 0,
    selectedDate: new Date(),
    visibleMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    records: {},
    dragging: false
  };

  const els = {
    time: document.getElementById("timeReadout"),
    dial: document.getElementById("dial"),
    ticks: document.getElementById("ticks"),
    labels: document.getElementById("tickLabels"),
    hand: document.getElementById("hand"),
    knob: document.getElementById("knob"),
    startPause: document.getElementById("startPauseButton"),
    icon: document.getElementById("controlIcon"),
    punch: document.getElementById("punchButton"),
    calendar: document.getElementById("calendar"),
    monthTitle: document.getElementById("monthTitle"),
    monthSummary: document.getElementById("monthSummary"),
    selectedDate: document.getElementById("selectedDate"),
    dailySummary: document.getElementById("dailySummary"),
    prev: document.getElementById("prevMonth"),
    next: document.getElementById("nextMonth"),
    settingsButton: document.getElementById("settingsButton")
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state.records = saved.records || {};
      state.selectedMinutes = Number(saved.selectedMinutes) || 0;
    } catch (_) {
      state.records = {};
    }
    setSelectedMinutes(state.selectedMinutes, false);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      selectedMinutes: state.selectedMinutes,
      records: state.records
    }));
  }

  function buildDial() {
    els.ticks.innerHTML = "";
    els.labels.innerHTML = "";

    for (let minute = 0; minute < 60; minute += 1) {
      const tick = document.createElement("i");
      tick.className = minute % 5 === 0 ? "tick tick-major" : "tick";
      tick.style.setProperty("--angle", `${minute * 6}deg`);
      els.ticks.appendChild(tick);
    }

    for (let minute = 0; minute < 60; minute += 5) {
      const label = document.createElement("span");
      label.className = "tick-label";
      label.textContent = minute;
      label.style.setProperty("--angle", `${minute * 6}deg`);
      label.style.setProperty("--angle-neg", `${minute * -6}deg`);
      els.labels.appendChild(label);
    }
  }

  function setSelectedMinutes(minutes, shouldSave = true) {
    const normalized = ((Math.round(minutes) % 60) + 60) % 60;
    state.selectedMinutes = normalized;
    if (!state.running) {
      state.sessionMinutes = normalized;
      state.total = normalized * 60;
      state.remaining = state.total;
    }
    if (shouldSave) save();
    renderTimer();
  }

  function renderTimer() {
    const minutes = Math.floor(state.remaining / 60);
    const seconds = state.remaining % 60;
    els.time.textContent = `${pad(minutes)}:${pad(seconds)}`;
    els.icon.textContent = state.running ? "Ⅱ" : "▶";
    els.startPause.disabled = !state.running && state.selectedMinutes === 0;
    els.startPause.setAttribute("aria-label", state.running ? "暂停" : "开始");

    const angle = state.running && state.total
      ? ((state.total - state.remaining) / 60) * 6
      : state.selectedMinutes * 6;
    const radius = els.dial.clientWidth * 0.41;
    const center = els.dial.clientWidth / 2;
    const radians = angle * Math.PI / 180;
    els.hand.style.transform = `rotate(${angle}deg)`;
    els.knob.style.left = `${center + Math.sin(radians) * radius}px`;
    els.knob.style.top = `${center - Math.cos(radians) * radius}px`;
  }

  function minuteFromPoint(clientX, clientY) {
    const rect = els.dial.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radians = Math.atan2(clientX - centerX, centerY - clientY);
    const degrees = (radians * 180 / Math.PI + 360) % 360;
    return Math.round(degrees / 6) % 60;
  }

  function startDrag(event) {
    if (state.running) return;
    state.dragging = true;
    els.knob.setPointerCapture(event.pointerId);
    setSelectedMinutes(minuteFromPoint(event.clientX, event.clientY));
  }

  function continueDrag(event) {
    if (!state.dragging || state.running) return;
    setSelectedMinutes(minuteFromPoint(event.clientX, event.clientY));
  }

  function stopDrag() {
    state.dragging = false;
  }

  function startPause() {
    if (!state.running && state.selectedMinutes === 0) return;
    if (!state.running) {
      state.sessionMinutes = state.selectedMinutes;
      state.total = state.sessionMinutes * 60;
      state.remaining = state.total;
    }
    state.running = !state.running;
    state.startedAt = Date.now();
    renderTimer();
  }

  function resetTimer() {
    state.running = false;
    setSelectedMinutes(0);
  }

  function tick() {
    if (!state.running) return;
    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    if (!elapsed) return;
    state.remaining = Math.max(0, state.remaining - elapsed);
    state.startedAt = Date.now();
    if (state.remaining === 0) {
      state.running = false;
      if (state.sessionMinutes > 0) addRecordMinutes(state.sessionMinutes, new Date(), true);
      setSelectedMinutes(0);
    } else {
      renderTimer();
    }
  }

  function addRecordMinutes(minutes, date = state.selectedDate, jumpToDate = false) {
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const key = isoDate(targetDate);
    const item = state.records[key] || { count: 0, minutes: 0 };
    item.count += 1;
    item.minutes += minutes;
    state.records[key] = item;
    state.selectedDate = targetDate;
    if (jumpToDate) {
      state.visibleMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    }
    save();
    renderCalendar();
  }

  function monthRecords(date) {
    const key = monthKey(date);
    return Object.entries(state.records).filter(([day]) => day.startsWith(key));
  }

  function renderCalendar() {
    const year = state.visibleMonth.getFullYear();
    const month = state.visibleMonth.getMonth();
    const todayKey = isoDate(new Date());
    const selectedKey = isoDate(state.selectedDate);
    const first = new Date(year, month, 1);
    const firstDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

    els.calendar.innerHTML = "";
    weekdays.forEach((label) => {
      const node = document.createElement("div");
      node.className = "weekday";
      node.textContent = label;
      els.calendar.appendChild(node);
    });

    const weekRows = Math.ceil((firstDay + daysInMonth) / 7);
    const slotCount = weekRows * 7;
    els.calendar.style.setProperty("--week-rows", weekRows);

    for (let slot = 0; slot < slotCount; slot += 1) {
      const dayNum = slot - firstDay + 1;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "day";
      if (dayNum < 1 || dayNum > daysInMonth) {
        button.classList.add("is-empty");
        button.tabIndex = -1;
      } else {
        const date = new Date(year, month, dayNum);
        const key = isoDate(date);
        const record = state.records[key];
        button.dataset.date = key;
        button.innerHTML = `<span class="day-number">${dayNum}</span><span class="day-record">${record ? formatHours(record.minutes) : ""}</span>`;
        if (key === todayKey) button.classList.add("is-today");
        if (key === selectedKey) button.classList.add("is-selected");
        if (record && record.minutes) {
          button.classList.add("has-record");
          button.title = `当日番茄钟：${formatHours(record.minutes)}`;
        }
        button.addEventListener("click", () => {
          state.selectedDate = date;
          renderCalendar();
        });
      }
      els.calendar.appendChild(button);
    }

    const entries = monthRecords(state.visibleMonth);
    const monthMinutes = entries.reduce((sum, [, item]) => sum + item.minutes, 0);
    const selected = state.records[selectedKey] || { minutes: 0 };

    els.monthTitle.textContent = `${year}年${month + 1}月`;
    els.monthSummary.textContent = `本月番茄钟：${formatHours(monthMinutes)}`;
    els.selectedDate.textContent = selectedKey;
    els.dailySummary.textContent = `当日番茄钟：${formatHours(selected.minutes)}`;
  }

  els.knob.addEventListener("pointerdown", startDrag);
  els.knob.addEventListener("pointermove", continueDrag);
  els.knob.addEventListener("pointerup", stopDrag);
  els.knob.addEventListener("pointercancel", stopDrag);
  els.dial.addEventListener("pointerdown", (event) => {
    if (event.target === els.knob || state.running) return;
    setSelectedMinutes(minuteFromPoint(event.clientX, event.clientY));
  });
  els.startPause.addEventListener("click", startPause);
  els.punch.addEventListener("click", () => addRecordMinutes(QUICK_PUNCH_MINUTES));
  els.prev.addEventListener("click", () => {
    state.visibleMonth = new Date(state.visibleMonth.getFullYear(), state.visibleMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  els.next.addEventListener("click", () => {
    state.visibleMonth = new Date(state.visibleMonth.getFullYear(), state.visibleMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  buildDial();
  load();
  renderCalendar();
  window.addEventListener("resize", renderTimer);
  window.setInterval(tick, 1000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
