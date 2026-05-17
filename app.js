(function () {
  const pad = (value) => String(value).padStart(2, "0");
  const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

  const defaults = {
    focusMinutes: 25,
    records: {}
  };

  const state = {
    ...defaults,
    remaining: defaults.focusMinutes * 60,
    total: defaults.focusMinutes * 60,
    running: false,
    startedAt: 0,
    selectedDate: new Date(),
    visibleMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    tickId: null
  };

  const els = {
    time: document.getElementById("timeReadout"),
    hand: document.getElementById("hand"),
    knob: document.getElementById("knob"),
    dial: document.getElementById("dial"),
    startPause: document.getElementById("startPauseButton"),
    icon: document.getElementById("controlIcon"),
    reset: document.getElementById("resetButton"),
    punch: document.getElementById("punchButton"),
    calendar: document.getElementById("calendar"),
    monthTitle: document.getElementById("monthTitle"),
    monthSummary: document.getElementById("monthSummary"),
    selectedDate: document.getElementById("selectedDate"),
    dailySummary: document.getElementById("dailySummary"),
    prev: document.getElementById("prevMonth"),
    next: document.getElementById("nextMonth"),
    settingsButton: document.getElementById("settingsButton"),
    settingsDialog: document.getElementById("settingsDialog"),
    focusMinutes: document.getElementById("focusMinutes"),
    saveSettings: document.getElementById("saveSettings")
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem("pomodoro-month-app") || "{}");
      state.focusMinutes = Number(saved.focusMinutes) || defaults.focusMinutes;
      state.records = saved.records || {};
    } catch (_) {
      state.records = {};
    }
    resetTimer();
  }

  function save() {
    localStorage.setItem("pomodoro-month-app", JSON.stringify({
      focusMinutes: state.focusMinutes,
      records: state.records
    }));
  }

  function currentMinutes() {
    return state.focusMinutes;
  }

  function renderTimer() {
    const minutes = Math.floor(state.remaining / 60);
    const seconds = state.remaining % 60;
    els.time.textContent = `${pad(minutes)}:${pad(seconds)}`;
    els.icon.textContent = state.running ? "Ⅱ" : "▶";
    els.startPause.setAttribute("aria-label", state.running ? "暂停" : "开始");

    const elapsed = Math.max(0, state.total - state.remaining);
    const minutesAroundDial = (elapsed / 60) % 60;
    const angle = minutesAroundDial * 6;
    const radius = els.dial.clientWidth * 0.32;
    const center = els.dial.clientWidth / 2;
    const radians = angle * Math.PI / 180;
    els.hand.style.transform = `rotate(${angle}deg)`;
    els.knob.style.left = `${center + Math.sin(radians) * radius}px`;
    els.knob.style.top = `${center - Math.cos(radians) * radius}px`;
  }

  function tick() {
    if (!state.running) return;
    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    state.remaining = Math.max(0, state.remaining - elapsed);
    state.startedAt = Date.now();
    if (state.remaining === 0) {
      state.running = false;
      addRecord(1, new Date(), true);
      resetTimer(false);
    }
    renderTimer();
  }

  function startPause() {
    state.running = !state.running;
    state.startedAt = Date.now();
    renderTimer();
  }

  function resetTimer(shouldRender = true) {
    state.running = false;
    state.total = currentMinutes() * 60;
    state.remaining = state.total;
    if (shouldRender) renderTimer();
  }

  function addRecord(count, date = state.selectedDate, jumpToDate = false) {
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const key = isoDate(targetDate);
    const item = state.records[key] || { count: 0, minutes: 0 };
    item.count += count;
    item.minutes += state.focusMinutes * count;
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
        button.textContent = dayNum;
        button.dataset.date = key;
        if (key === todayKey) button.classList.add("is-today");
        if (key === selectedKey) button.classList.add("is-selected");
        if (record && record.count) {
          button.classList.add("has-record");
          button.dataset.count = record.count;
          button.title = `${record.count} 个番茄 · ${(record.minutes / 60).toFixed(1)}h`;
        }
        button.addEventListener("click", () => {
          state.selectedDate = date;
          renderCalendar();
        });
      }
      els.calendar.appendChild(button);
    }

    const entries = monthRecords(state.visibleMonth);
    const monthCount = entries.reduce((sum, [, item]) => sum + item.count, 0);
    const monthMinutes = entries.reduce((sum, [, item]) => sum + item.minutes, 0);
    const selected = state.records[selectedKey] || { count: 0, minutes: 0 };

    els.monthTitle.textContent = `${year} 年 ${month + 1} 月`;
    els.monthSummary.textContent = `本月 ${monthCount} 个 · ${(monthMinutes / 60).toFixed(1)}h`;
    els.selectedDate.textContent = selectedKey;
    els.dailySummary.textContent = `当日：${selected.count} 个 · ${(selected.minutes / 60).toFixed(1)}h`;
  }

  els.startPause.addEventListener("click", startPause);
  els.reset.addEventListener("click", resetTimer);
  els.punch.addEventListener("click", () => addRecord(1));
  els.prev.addEventListener("click", () => {
    state.visibleMonth = new Date(state.visibleMonth.getFullYear(), state.visibleMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  els.next.addEventListener("click", () => {
    state.visibleMonth = new Date(state.visibleMonth.getFullYear(), state.visibleMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  els.settingsButton.addEventListener("click", () => {
    els.focusMinutes.value = state.focusMinutes;
    els.settingsDialog.showModal();
  });

  els.saveSettings.addEventListener("click", () => {
    state.focusMinutes = Math.min(120, Math.max(1, Number(els.focusMinutes.value) || 25));
    save();
    resetTimer();
  });

  load();
  renderCalendar();
  window.addEventListener("resize", renderTimer);
  window.setInterval(tick, 1000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
