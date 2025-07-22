document.addEventListener("DOMContentLoaded", function () {

// ===== Core Utility Functions =====

function getCurrentUser() {
  return localStorage.getItem('currentUser');
}

function saveMeds(user, meds) {
  localStorage.setItem(user + '_medications', JSON.stringify(meds));
}
function stockColor(stock) {
  if (stock > 10) return 'stock-green';
  if (stock > 3) return 'stock-orange';
  return 'stock-red';
}
function hideAllSections() {
  document.getElementById('medListSection').style.display = 'none';
  document.getElementById('stockManagerSection').style.display = 'none';
  document.getElementById('calendarSection').style.display = 'none';
  document.getElementById('weeklyViewSection').style.display = 'none';
  document.getElementById('chartSection').style.display = 'none';
  document.getElementById('historySection').style.display = 'none';
  document.getElementById('addMedSection').style.display = 'none';
  document.getElementById('medChangeHistorySection').style.display = 'none';
}
function showToast(msg, duration = 2000) {
  let toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, duration);
}

// ===== Add/Edit Medication Section Logic =====

let editMedicationIndex = null;

window.showAddMedication = function(index = null) {
  hideAllSections();
  document.getElementById('addMedSection').style.display = 'block';
  document.getElementById('addMedForm').reset();
  document.getElementById('addTimeInputs').innerHTML = '';
  addTimeInputToAddForm();
  document.getElementById('addRecurrencePeriod').style.display = 'none';
  document.getElementById('addRecursDaily').checked = true;
  attachAddRecurrenceEventHandlers();

  editMedicationIndex = index;

  if (index === null) {
    document.getElementById('addMedSectionTitle').textContent = "Add Medication";
    document.getElementById('addMedSubmitBtn').textContent = "Add Medication";
    document.getElementById('addMedCancelBtn').style.display = "none";
  } else {
    document.getElementById('addMedSectionTitle').textContent = "Edit Medication";
    document.getElementById('addMedSubmitBtn').textContent = "Update Medication";
    document.getElementById('addMedCancelBtn').style.display = "";
    const user = getCurrentUser();
    let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
    const med = meds[index];
    document.getElementById('addMedName').value = med.name;
    document.getElementById('addQty').value = med.dosage;
    document.getElementById('addMedNotes').value = med.notes || '';
    document.getElementById('addTimeInputs').innerHTML = '';
    (med.times || []).forEach((t, i) => {
      addTimeInputToAddForm(t, med.reminders && med.reminders[i]);
    });
    if (med.recurrence?.type === "period") {
      document.getElementById('addRecursDaily').checked = false;
      document.getElementById('addRecurrencePeriod').style.display = '';
      document.getElementById('addRecStart').value = med.recurrence.start || '';
      document.getElementById('addRecEnd').value = med.recurrence.end || '';
    } else {
      document.getElementById('addRecursDaily').checked = true;
      document.getElementById('addRecurrencePeriod').style.display = 'none';
      document.getElementById('addRecStart').value = '';
      document.getElementById('addRecEnd').value = '';
    }
    attachAddRecurrenceEventHandlers();
  }
};

window.addTimeInputToAddForm = function(value = "", reminder = false) {
  const div = document.createElement("div");
  div.className = "time-input-row";
  div.innerHTML = `
    <input type="time" class="dose-time-input" value="${value}">
    <label><input type="checkbox" class="reminder-checkbox" ${reminder ? "checked" : ""}> Reminder</label>
    <button type="button" onclick="this.parentNode.remove()">×</button>
  `;
  document.getElementById('addTimeInputs').appendChild(div);
};

function attachAddRecurrenceEventHandlers() {
  const recursDaily = document.getElementById('addRecursDaily');
  const periodDiv = document.getElementById('addRecurrencePeriod');
  if (recursDaily && periodDiv) {
    recursDaily.onchange = function() {
      periodDiv.style.display = this.checked ? 'none' : '';
    };
  }
}
attachAddRecurrenceEventHandlers();

window.cancelEditMedication = function() {
  editMedicationIndex = null;
  showAddMedication();
  document.getElementById('addMedSection').style.display = 'none';
  renderMedsGrouped();
};

document.getElementById('addMedForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const user = getCurrentUser();
  const name = document.getElementById('addMedName').value.trim();
  const qty = document.getElementById('addQty').value;
  const notes = document.getElementById('addMedNotes').value;
  const times = Array.from(document.querySelectorAll('#addTimeInputs .dose-time-input')).map(i => i.value);
  const reminders = Array.from(document.querySelectorAll('#addTimeInputs .reminder-checkbox')).map(i => i.checked);
  let recurrence = null;
  if (!document.getElementById('addRecursDaily').checked) {
    const start = document.getElementById('addRecStart').value;
    const end = document.getElementById('addRecEnd').value;
    recurrence = { type: "period", start, end };
  }
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  let reason = "";
  if (editMedicationIndex === null) {
    meds.push({
      name, dosage: `${qty}`, times, reminders, notes, stock: 0, recurrence
    });
    showToast("Medication added!");
    reason = `Added ${name}`;
  } else {
    reason = `Edited ${meds[editMedicationIndex].name}`;
    meds[editMedicationIndex] = {
      ...meds[editMedicationIndex],
      name, dosage: `${qty}`, times, reminders, notes, recurrence
    };
    showToast("Medication updated!");
    editMedicationIndex = null;
  }
  saveMeds(user, meds);
  saveMedChangeSnapshot(reason);
  document.getElementById('addMedForm').reset();
  document.getElementById('addTimeInputs').innerHTML = '';
  addTimeInputToAddForm();
  document.getElementById('addRecurrencePeriod').style.display = 'none';
  document.getElementById('addRecursDaily').checked = true;
  attachAddRecurrenceEventHandlers();
  document.getElementById('addMedSection').style.display = 'none';
  renderMedsGrouped();
});

// ===== Medication List Logic =====

window.renderMedsGrouped = function() {
  hideAllSections();
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const medList = document.getElementById('medList');
  document.getElementById('medListSection').style.display = 'block';
  medList.innerHTML = '';
  const grouped = {};
  meds.forEach((med, i) => {
    if (!grouped[med.name]) grouped[med.name] = [];
    grouped[med.name].push({ ...med, index: i });
  });

  Object.entries(grouped).forEach(([name, group]) => {
    const details = document.createElement('details');
    details.className = 'med-card';
    const summary = document.createElement('summary');
    summary.innerHTML = `<span>${name}</span> <span class="stock-badge ${stockColor(group[0].stock)}">${group[0].stock || 0} pills</span>`;
    details.appendChild(summary);

    group.forEach(item => {
      const div = document.createElement('div');
      div.style.margin = '10px 0';
      let timesHtml = '';
      const today = new Date().toISOString().split('T')[0];
      const takenLog = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
      item.times.forEach((time, idx) => {
        const hasReminder = item.reminders && item.reminders[idx];
        const isTaken = takenLog[today]?.some(e => e.name === item.name && e.time === time);
        timesHtml += `<div>
          <span>${time}</span>
          ${hasReminder ? '<span style="color:#007bff;">🔔</span>' : ''}
          ${isTaken ? '<span style="color:green;">✔️</span>' : ''}
          <button onclick="markTaken(${item.index},'${time}')">Mark Taken</button>
        </div>`;
      });
      let recText = "";
      if (item.recurrence?.type === "period") {
        recText = `<div><b>Period:</b> ${item.recurrence.start} to ${item.recurrence.end}</div>`;
      } else {
        recText = `<div><b>Repeats daily</b></div>`;
      }
      let runOutHTML = "";
      const runOutDate = getRunOutDate(item);
      if (runOutDate) {
        const soon = ((item.stock || 0) < 5);
        runOutHTML = `<div style="color:${soon?'red':'orange'};">
          Expected to run out: <b>${runOutDate}</b>
        </div>`;
        if (soon) runOutHTML += `<div style="color:red;font-weight:bold;">⚠️ Low stock soon!</div>`;
      }
      div.innerHTML = `
        <strong>Dose:</strong> ${item.dosage}<br>
        <strong>Notes:</strong> ${item.notes ? item.notes : ''}<br>
        <strong>Times:</strong><br>
        ${timesHtml}
        ${recText}
        ${runOutHTML}
        <br>
        <button class="mark-all-btn" onclick="markAllTaken(${item.index})">Mark All Taken</button>
        <button onclick="editMed(${item.index})">Edit</button>
        <button onclick="deleteMed(${item.index})">Delete</button>
      `;
      details.appendChild(div);
    });
    medList.appendChild(details);
  });
  attachAddRecurrenceEventHandlers();
};

window.editMed = function(index) {
  showAddMedication(index);
};

window.markAllTaken = function(index) {
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const med = meds[index];
  const today = new Date().toISOString().split('T')[0];
  const log = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
  if (!log[today]) log[today] = [];
  let dosesMarked = 0;
  med.times.forEach(time => {
    const doseKey = `${med.name}-${time}-${today}`;
    if (!log[today].some(entry => entry.doseKey === doseKey)) {
      log[today].push({ ...med, time, doseKey });
      dosesMarked++;
    }
  });
  if (dosesMarked > 0) {
    med.stock = Math.max(0, (med.stock || 0) - dosesMarked * parseInt(med.dosage));
    saveMeds(user, meds);
    localStorage.setItem(user + '_medLogs', JSON.stringify(log));
    saveMedChangeSnapshot(`Marked all doses taken for ${med.name}`);
    showToast(`Marked ${dosesMarked} dose(s) as taken.`);
    renderMedsGrouped();
  } else {
    showToast('All doses already marked as taken!');
  }
};

window.markTaken = function(index, time) {
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const med = meds[index];
  const today = new Date().toISOString().split('T')[0];
  const log = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
  const doseKey = `${med.name}-${time}-${today}`;
  if (!log[today]) log[today] = [];
  if (log[today].some(entry => entry.doseKey === doseKey)) {
    showToast('Dose already marked as taken.');
    return;
  }
  log[today].push({ ...med, time, doseKey });
  med.stock = Math.max(0, (med.stock || 0) - parseInt(med.dosage));
  saveMeds(user, meds);
  localStorage.setItem(user + '_medLogs', JSON.stringify(log));
  saveMedChangeSnapshot(`Marked dose taken for ${med.name} at ${time}`);
  showToast('Dose marked as taken.');
  renderMedsGrouped();
};

window.deleteMed = function(index) {
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  if (confirm("Delete this medication schedule?")) {
    let medName = meds[index].name;
    meds.splice(index, 1);
    saveMeds(user, meds);
    saveMedChangeSnapshot(`Deleted ${medName}`);
    renderMedsGrouped();
  }
};

// ===== Medication Change History (Sidebar/Collapsible/Export) =====

window.showMedChangeHistory = function() {
  hideAllSections();
  document.getElementById("medChangeHistorySection").style.display = "block";
  renderMedChangeHistorySidebar();
};

function renderMedChangeHistorySidebar() {
  const history = getMedChangeHistory();
  const outer = document.getElementById('medChangeHistorySection');
  outer.innerHTML = `
    <h2 class="section-title">Medication Change History</h2>
    <div style="display:flex; gap:24px;">
      <div style="min-width:170px;">
        <ul id="changeDatesList" style="list-style:none;padding:0;margin:0;"></ul>
      </div>
      <div style="flex:1;">
        <div id="changeHistoryDetail"></div>
      </div>
    </div>
  `;
  renderSidebar(history);
  if (history.length > 1) renderChangeDetail(history, history.length - 1);
}

function renderSidebar(history) {
  const list = document.getElementById('changeDatesList');
  list.innerHTML = '';
  history.slice(1).forEach((entry, idx) => {
    const li = document.createElement('li');
    li.textContent = new Date(entry.date).toLocaleDateString();
    li.style.cursor = 'pointer';
    li.style.padding = "7px 10px";
    li.style.marginBottom = "4px";
    li.onclick = () => renderChangeDetail(history, idx+1);
    li.id = `change-date-li-${idx+1}`;
    list.appendChild(li);
  });
}

function getMedChangeHistoryKey() {
  return getCurrentUser() + '_medChangeHistory';
}

function saveMedChangeSnapshot(reason = "") {
  const user = getCurrentUser();
  const meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const historyKey = getMedChangeHistoryKey();
  let history = JSON.parse(localStorage.getItem(historyKey)) || [];
  const now = new Date();
  history.push({
    date: now.toISOString(),
    meds: JSON.parse(JSON.stringify(meds)),
    reason: reason
  });
  localStorage.setItem(historyKey, JSON.stringify(history));
}

function getMedChangeHistory() {
  return JSON.parse(localStorage.getItem(getMedChangeHistoryKey())) || [];
}

function diffMedLists(before, after) {
  function medKey(med) { return med.name.toLowerCase(); }
  const beforeMap = Object.fromEntries(before.map(m => [medKey(m), m]));
  const afterMap = Object.fromEntries(after.map(m => [medKey(m), m]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const key in beforeMap) {
    if (!afterMap[key]) removed.push(beforeMap[key]);
    else {
      const o = beforeMap[key], n = afterMap[key];
      let diffs = [];
      if (o.dosage !== n.dosage) diffs.push('dosage');
      if (JSON.stringify(o.times) !== JSON.stringify(n.times)) diffs.push('times');
      if ((o.notes||"") !== (n.notes||"")) diffs.push('notes');
      if (diffs.length) changed.push({name: n.name, before: o, after: n, fields: diffs});
    }
  }
  for (const key in afterMap) {
    if (!beforeMap[key]) added.push(afterMap[key]);
  }
  return {added, removed, changed};
}

function renderChangeDetail(history, idx) {
  document.querySelectorAll('#changeDatesList li').forEach(li => li.classList.remove('active'));
  const activeLi = document.getElementById(`change-date-li-${idx}`);
  if (activeLi) activeLi.classList.add('active');
  const before = history[idx-1].meds;
  const after = history[idx].meds;
  const diff = diffMedLists(before, after);
  const container = document.getElementById('changeHistoryDetail');
  let html = `<div class="med-change-entry">
    <div class="med-change-title">${new Date(history[idx].date).toLocaleDateString()} &mdash;
      ${diff.added.length ? `<span style="color:green;">${diff.added.map(m=>m.name).join(', ')} was added</span>` : ""}
      ${diff.removed.length ? `<span style="color:red;">${diff.removed.map(m=>m.name).join(', ')} was removed</span>` : ""}
      ${diff.changed.length ? diff.changed.map(ch => `<span style="color:orange;">${ch.name}: ${ch.fields.map(f=>f.charAt(0).toUpperCase()+f.slice(1)).join(', ')}</span>`).join('') : ""}
    </div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;">
      <div>
        <b>Before</b>
        <div id="before-table"></div>
        <button class="export-btn" onclick="exportMedListTable('before-table')">Export Before (PDF)</button>
      </div>
      <div>
        <b>After</b>
        <div id="after-table"></div>
        <button class="export-btn" onclick="exportMedListTable('after-table')">Export After (PDF)</button>
      </div>
    </div>
  </div>`;
  container.innerHTML = html;
  renderMedListTable('before-table', before, diff, "before");
  renderMedListTable('after-table', after, diff, "after");
}

function renderMedListTable(containerId, meds, diff, side) {
  let html = `<table class="medlist-table"><tr><th>Name</th><th>Dosage</th><th>Times</th><th>Notes</th></tr>`;
  meds.forEach(m => {
    let trClass = '';
    if (side === "before" && diff.removed.some(x => x.name === m.name)) trClass = 'diff-removed';
    if (side === "after" && diff.added.some(x => x.name === m.name)) trClass = 'diff-added';
    let td1 = '', td2 = '', td3 = '';
    if (diff.changed.some(x => x.name === m.name)) {
      const ch = diff.changed.find(x => x.name === m.name);
      if (ch.fields.includes('dosage')) td1 = 'class="diff-highlight"';
      if (ch.fields.includes('times')) td2 = 'class="diff-highlight"';
      if (ch.fields.includes('notes')) td3 = 'class="diff-highlight"';
    }
    html += `<tr class="${trClass}"><td>${m.name}</td>
      <td ${td1}>${m.dosage}</td>
      <td ${td2}>${(m.times||[]).join(', ')}</td>
      <td ${td3}>${m.notes||''}</td></tr>`;
  });
  html += "</table>";
  document.getElementById(containerId).innerHTML = html;
}

window.exportMedListTable = function(divId) {
  const node = document.getElementById(divId);
  html2canvas(node).then(canvas => {
    const imgData = canvas.toDataURL("image/jpeg");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4"
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pageWidth;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("medication-list.pdf");
  });
};

// ===== Export Med List PDF/JPEG =====

window.exportMedListPDF = function() {
  const medListSection = document.getElementById("medListSection");
  html2canvas(medListSection).then(canvas => {
    const imgData = canvas.toDataURL("image/jpeg");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4"
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pageWidth;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("medication-list.pdf");
  });
};

window.exportMedListJPEG = function() {
  const medListSection = document.getElementById("medListSection");
  html2canvas(medListSection).then(canvas => {
    const link = document.createElement("a");
    link.download = "medication-list.jpg";
    link.href = canvas.toDataURL("image/jpeg");
    link.click();
  });
};

// ===== Stock Management =====

window.showStockManager = function() {
  hideAllSections();
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const stockSection = document.getElementById('stockManager');
  document.getElementById('stockManagerSection').style.display = 'block';
  stockSection.innerHTML = '';
  meds.forEach((med, i) => {
    const div = document.createElement('div');
    div.className = `stock-item ${stockColor(med.stock)}`;
    div.innerHTML = `
      <b>${med.name}</b> 
      <input type="number" id="stock-input-${i}" value="${med.stock || 0}" min="0">
      <button onclick="updateStock(${i})">Update</button>
      ${(med.stock || 0) < 5 ? "<span class='low-stock-warning' style='color:red;font-weight:bold;margin-left:8px;'>⚠️ Low</span>" : ""}
    `;
    stockSection.appendChild(div);
  });
};
window.updateStock = function(index) {
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const input = document.getElementById(`stock-input-${index}`);
  const value = parseInt(input.value);
  if (!isNaN(value)) {
    meds[index].stock = value;
    saveMeds(user, meds);
    showStockManager();
    showToast("Stock updated.");
    if (value < 5) showToast("⚠️ Low stock warning! Consider restocking soon.", 3000);
    saveMedChangeSnapshot(`Updated stock for ${meds[index].name}`);
  }
};

// ===== Weekly Timeline =====

window.viewWeeklyTimeline = function() {
  hideAllSections();
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const weeklyView = document.getElementById('weeklyView');
  document.getElementById('weeklyViewSection').style.display = 'block';
  weeklyView.innerHTML = '';
  const today = new Date();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  meds.forEach((med, medIndex) => {
    const details = document.createElement('details');
    details.className = 'weekly-card';
    const summary = document.createElement('summary');
    summary.innerHTML = `<span>${med.name}</span>`;
    details.appendChild(summary);
    let table = '<table><tr><th>Day</th>';
    med.times.forEach((t) => table += `<th>${t}</th>`);
    table += '</tr>';
    days.forEach(day => {
      table += `<tr><td>${day}</td>`;
      med.times.forEach((time, idx) => {
        const takenLog = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
        const taken = takenLog[day]?.some(entry => entry.name === med.name && entry.time === time);
        table += `<td>
          ${taken ? "✔️" : `<button onclick="markLate('${day}','${med.name}','${time}',${medIndex})">Mark</button>`}
        </td>`;
      });
      table += '</tr>';
    });
    table += '</table>';
    let takenThisMed = 0, missedThisMed = 0;
    days.forEach(day => {
      med.times.forEach(time => {
        const takenLog = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
        const taken = takenLog[day]?.some(entry => entry.name === med.name && entry.time === time);
        if (taken) takenThisMed++; else missedThisMed++;
      });
    });
    details.innerHTML += `<div style="margin:8px 0;">
      <span style="color:green;">✔️ Taken: ${takenThisMed}</span> &nbsp;
      <span style="color:red;">❌ Missed: ${missedThisMed}</span>
    </div>`;
    details.innerHTML += table;
    weeklyView.appendChild(details);
  });
};
window.markLate = function(date, name, time, medIndex) {
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const med = meds[medIndex];
  const logs = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
  const doseKey = `${name}-${time}-${date}`;
  if (!logs[date]) logs[date] = [];
  if (!logs[date].some(entry => entry.doseKey === doseKey)) {
    logs[date].push({ ...med, time, doseKey });
    med.stock = Math.max(0, (med.stock || 0) - parseInt(med.dosage));
    saveMeds(user, meds);
    localStorage.setItem(user + '_medLogs', JSON.stringify(logs));
    showToast('Dose marked as taken.');
    saveMedChangeSnapshot(`Marked dose taken for ${med.name} at ${time} on ${date}`);
    viewWeeklyTimeline();
  } else {
    showToast('Dose already marked as taken.');
  }
};

// ===== Adherence Chart =====

window.renderAdherenceChart = function() {
  hideAllSections();
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  document.getElementById('chartSection').style.display = 'block';

  const canvas = document.getElementById('adherenceChart');
  if (
    window.adherenceChart &&
    typeof window.adherenceChart.destroy === "function"
  ) {
    window.adherenceChart.destroy();
    window.adherenceChart = null;
  }

  const range = document.getElementById('chartRange')?.value || "7";
  const logs = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
  let allDates = Object.keys(logs).sort();
  if (range !== "all") {
    allDates = allDates.slice(-parseInt(range));
  }
  const days = allDates;

  // Calculate expected vs actual doses
  let labels = days;
  let expected = [];
  let actual = [];
  days.forEach(day => {
    let expectedForDay = 0;
    meds.forEach(med => { expectedForDay += med.times.length; });
    expected.push(expectedForDay);
    actual.push((logs[day] || []).length);
  });

  window.adherenceChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Expected', data: expected, backgroundColor: '#eee', borderColor: '#aaa', borderWidth: 1 },
        { label: 'Taken', data: actual, backgroundColor: '#007bff' }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        title: { display: false }
      },
      scales: {
        y: { beginAtZero: true, suggestedMax: Math.max(...expected, ...actual, 1) }
      }
    }
  });
};

// ===== Calendar =====

 window.showCalendar = function(monthDelta = 0) {
  hideAllSections();
  document.getElementById('calendarSection').style.display = 'block';

  let today = new Date();
  if (!window._calendarMonth) window._calendarMonth = today.getMonth();
  if (!window._calendarYear) window._calendarYear = today.getFullYear();

  window._calendarMonth += monthDelta;
  if (window._calendarMonth < 0) {
    window._calendarMonth = 11;
    window._calendarYear--;
  }
  if (window._calendarMonth > 11) {
    window._calendarMonth = 0;
    window._calendarYear++;
  }

  const month = window._calendarMonth;
  const year = window._calendarYear;

  // Nav bar
  const navDiv = document.getElementById('calendarNav');
  navDiv.innerHTML = `
    <button onclick="showCalendar(-1)">&#8592; Prev</button>
    <b>${today.toLocaleString('default', { month: 'long' })} ${year}</b>
    <button onclick="showCalendar(1)">Next &#8594;</button>
  `;

  // Days grid
  const calendarDiv = document.getElementById('calendar');
  calendarDiv.innerHTML = '';
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const user = getCurrentUser();
  const meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const logs = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};

  // Weekday header
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  weekdays.forEach(d => {
    const wd = document.createElement('div');
    wd.textContent = d;
    wd.style.fontWeight = 'bold';
    calendarDiv.appendChild(wd);
  });

  // Blank days before 1st
  for (let i = 0; i < firstDay; i++) {
    calendarDiv.appendChild(document.createElement('div'));
  }

  // Days of month
  for (let date = 1; date <= daysInMonth; date++) {
    const iso = new Date(year, month, date).toISOString().split('T')[0];
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    if (iso === (new Date()).toISOString().split('T')[0]) dayDiv.classList.add('calendar-today');

    // Check if doses scheduled
    let totalDoses = 0, taken = 0, missed = 0, upcoming = 0;
    meds.forEach(med => {
      // Check recurrence
      let show = false;
      if (med.recurrence?.type === "period") {
        if (iso >= med.recurrence.start && iso <= med.recurrence.end) show = true;
      } else {
        show = true;
      }
      if (show) {
        totalDoses += med.times.length;
        med.times.forEach((t, idx) => {
          const isTaken = logs[iso]?.some(e => e.name === med.name && e.time === t);
          const now = new Date();
          const [hour, minute] = t.split(':').map(Number);
          const doseDateTime = new Date(iso);
          doseDateTime.setHours(hour, minute, 0, 0);
          if (isTaken) taken++;
          else if (doseDateTime < now) missed++;
          else upcoming++;
        });
      }
    });
    if (totalDoses > 0) {
      dayDiv.classList.add('has-dose');
      if (taken) dayDiv.innerHTML += `<span class="dose-badge">${taken} taken</span>`;
      if (missed) dayDiv.innerHTML += `<span class="dose-badge missed">${missed} missed</span>`;
      if (upcoming) dayDiv.innerHTML += `<span class="dose-badge upcoming">${upcoming} upcoming</span>`;
    }
    dayDiv.innerHTML = `<div>${date}</div>` + dayDiv.innerHTML;

    // Show detail on click
    dayDiv.onclick = () => showCalendarDayDetail(iso);

    calendarDiv.appendChild(dayDiv);
  }
  document.getElementById('calendarDayDetail').style.display = 'none';
};

window.showCalendarDayDetail = function(iso) {
  const user = getCurrentUser();
  const meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const logs = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
  let html = `<b>${iso}</b><br>`;
  let any = false;
  meds.forEach((med, mi) => {
    let show = false;
    if (med.recurrence?.type === "period") {
      if (iso >= med.recurrence.start && iso <= med.recurrence.end) show = true;
    } else {
      show = true;
    }
    if (show) {
      med.times.forEach((t, ti) => {
        any = true;
        const isTaken = logs[iso]?.some(e => e.name === med.name && e.time === t);
        html += `
          <div style="margin:5px 0;">
            <b>${med.name}</b> at <b>${t}</b> ${isTaken ? "<span style='color:green'>✔️</span>" : ""}
            ${!isTaken ? `<button onclick="markCalendarTaken('${iso}',${mi},'${t}')">Mark Taken</button>` : ""}
          </div>
        `;
      });
    }
  });
  if (!any) html += "No doses scheduled.";
  const detailDiv = document.getElementById('calendarDayDetail');
  detailDiv.innerHTML = html;
  detailDiv.style.display = 'block';
};

window.markCalendarTaken = function(iso, medIdx, t) {
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const med = meds[medIdx];
  const logs = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
  const doseKey = `${med.name}-${t}-${iso}`;
  if (!logs[iso]) logs[iso] = [];
  if (!logs[iso].some(entry => entry.doseKey === doseKey)) {
    logs[iso].push({ ...med, time: t, doseKey });
    med.stock = Math.max(0, (med.stock || 0) - parseInt(med.dosage));
    saveMeds(user, meds);
    localStorage.setItem(user + '_medLogs', JSON.stringify(logs));
    saveMedChangeSnapshot(`Marked dose taken for ${med.name} at ${t} on ${iso}`);
    showToast('Dose marked as taken.');
    showCalendar();
    showCalendarDayDetail(iso);
  } else {
    showToast('Dose already marked as taken.');
  }
};

// ===== Export Logs =====

window.exportLogs = function() {
  const user = getCurrentUser();
  const logs = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
  let csv = "Date,Medication,Time,Dose\n";
  Object.entries(logs).forEach(([date, entries]) => {
    entries.forEach(e => {
      csv += `${date},${e.name},${e.time},${e.dosage}\n`;
    });
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${user}_medication_log.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ===== Show History =====

window.showHistory = function() {
  hideAllSections();
  const user = getCurrentUser();
  const logs = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
  const historyDiv = document.getElementById('history');
  let html = '<table><tr><th>Date</th><th>Medication</th><th>Dose</th><th>Time</th></tr>';
  Object.entries(logs).forEach(([date, entries]) => {
    entries.forEach(e => {
      html += `<tr><td>${date}</td><td>${e.name}</td><td>${e.dosage}</td><td>${e.time}</td></tr>`;
    });
  });
  html += '</table>';
  historyDiv.innerHTML = html;
  document.getElementById('historySection').style.display = 'block';
};

// ===== Run Out Date Calculation =====

function getRunOutDate(med) {
  let dosesPerDay = med.times.length * (parseInt(med.dosage) || 1);
  if (dosesPerDay === 0) return null;
  const today = new Date();
  if (med.recurrence?.type === "period") {
    const start = new Date(med.recurrence.start);
    const end = new Date(med.recurrence.end);
    if (isNaN(start) || isNaN(end) || end < today) return null;
    let daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24)) + 1;
    let dosesLeft = daysLeft * dosesPerDay;
    let daysTillRunOut = Math.floor((med.stock || 0) / dosesPerDay);
    let runOut = new Date(today);
    runOut.setDate(today.getDate() + daysTillRunOut);
    if (runOut > end) runOut = end;
    return runOut.toISOString().split('T')[0];
  } else {
    let daysTillRunOut = Math.floor((med.stock || 0) / dosesPerDay);
    let runOut = new Date(today);
    runOut.setDate(today.getDate() + daysTillRunOut);
    return runOut.toISOString().split('T')[0];
  }
}

// ===== Notification Permission =====

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
}
requestNotificationPermission();

});
