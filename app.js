document.addEventListener("DOMContentLoaded", function () {

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
  document.getElementById('weeklyViewSection').style.display = 'none';
  document.getElementById('chartSection').style.display = 'none';
  document.getElementById('historySection').style.display = 'none';
}

function showToast(msg, duration = 2000) {
  let toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, duration);
}

window.addTimeInput = function(value = "", reminder = false) {
  const div = document.createElement("div");
  div.className = "time-input-row";
  div.innerHTML = `
    <input type="time" class="dose-time-input" value="${value}">
    <label><input type="checkbox" class="reminder-checkbox" ${reminder ? "checked" : ""}> Reminder</label>
    <button type="button" onclick="this.parentNode.remove()">×</button>
  `;
  document.getElementById('timeInputs').appendChild(div);
};
if (!document.querySelector('.dose-time-input')) addTimeInput();

document.getElementById('recursDaily').addEventListener('change', function() {
  document.getElementById('recurrencePeriod').style.display = this.checked ? 'none' : '';
});

document.getElementById('medForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const user = getCurrentUser();
  const name = document.getElementById('medName').value.trim();
  const qty = parseInt(document.getElementById('qty').value);
  const notes = document.getElementById('medNotes').value.trim();
  let times = [], reminders = [];
  document.querySelectorAll('.dose-time-input').forEach((input, i) => {
    const time = input.value;
    if (time) {
      times.push(time);
      reminders.push(input.parentNode.querySelector('.reminder-checkbox').checked);
    }
  });
  if (!name || isNaN(qty) || times.length === 0) {
    showToast("Please fill out required fields.");
    return;
  }
  // Recurrence logic
  const recursDaily = document.getElementById('recursDaily').checked;
  let recurrence;
  if (recursDaily) {
    recurrence = { type: "daily" };
  } else {
    const start = document.getElementById('recStart').value;
    const end = document.getElementById('recEnd').value;
    if (!start || !end) {
      showToast("Please select start and end dates.");
      return;
    }
    recurrence = { type: "period", start, end };
  }
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  meds.push({
    name, dosage: `${qty}`, times, reminders, notes, stock: 0, recurrence
  });
  saveMeds(user, meds);
  renderMedsGrouped();
  document.getElementById('medForm').reset();
  document.getElementById('timeInputs').innerHTML = '';
  addTimeInput();
  document.getElementById('recurrencePeriod').style.display = 'none';
  document.getElementById('recursDaily').checked = true;
});

function getRunOutDate(med) {
  let dosesPerDay = med.times.length * (parseInt(med.dosage) || 1);
  if (dosesPerDay === 0) return null;
  const today = new Date();
  if (med.recurrence?.type === "period") {
    const start = new Date(med.recurrence.start);
    const end = new Date(med.recurrence.end);
    if (isNaN(start) || isNaN(end) || end < today) return null;
    // How many days left in period?
    let daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24)) + 1;
    let dosesLeft = daysLeft * dosesPerDay;
    let daysTillRunOut = Math.floor((med.stock || 0) / dosesPerDay);
    let runOut = new Date(today);
    runOut.setDate(today.getDate() + daysTillRunOut);
    // Never after the period ends
    if (runOut > end) runOut = end;
    return runOut.toISOString().split('T')[0];
  } else {
    // Recurring daily, just predict when stock runs out
    let daysTillRunOut = Math.floor((med.stock || 0) / dosesPerDay);
    let runOut = new Date(today);
    runOut.setDate(today.getDate() + daysTillRunOut);
    return runOut.toISOString().split('T')[0];
  }
}

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
        timesHtml += `
          <div style="margin:2px 0;">
            <strong>Time:</strong> ${time}
            ${hasReminder ? "⏰" : ""}
            <button onclick="markTaken(${item.index},'${time}')" ${isTaken ? "disabled" : ""}>
              Mark Taken
            </button>
            ${isTaken ? "<span style='color:green;'>✔️</span>" : ""}
          </div>
        `;
      });
      // Recurrence info
      let recText = "";
      if (item.recurrence?.type === "period") {
        recText = `<br><strong>Period:</strong> ${item.recurrence.start} to ${item.recurrence.end}`;
      } else {
        recText = "<br><strong>Recurring:</strong> Daily";
      }
      // Run-out prediction
      const runOutDate = getRunOutDate(item);
      let runOutHTML = "";
      if (runOutDate) {
        const soon = (new Date(runOutDate) - new Date()) / (1000*60*60*24) < 7;
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
  showToast('Dose marked as taken.');
  renderMedsGrouped();
};

window.deleteMed = function(index) {
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  if (confirm("Delete this medication schedule?")) {
    meds.splice(index, 1);
    saveMeds(user, meds);
    renderMedsGrouped();
  }
};
window.editMed = function(index) {
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const med = meds[index];
  document.getElementById('medName').value = med.name;
  document.getElementById('qty').value = med.dosage;
  document.getElementById('medNotes').value = med.notes || '';
  document.getElementById('timeInputs').innerHTML = '';
  med.times.forEach((t, i) => {
    addTimeInput(t, med.reminders && med.reminders[i]);
  });
  // recurrence
  if (med.recurrence?.type === "period") {
    document.getElementById('recursDaily').checked = false;
    document.getElementById('recurrencePeriod').style.display = '';
    document.getElementById('recStart').value = med.recurrence.start;
    document.getElementById('recEnd').value = med.recurrence.end;
  } else {
    document.getElementById('recursDaily').checked = true;
    document.getElementById('recurrencePeriod').style.display = 'none';
    document.getElementById('recStart').value = '';
    document.getElementById('recEnd').value = '';
  }
  deleteMed(index);
};

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
  }
};

window.viewWeeklyTimeline = function() {
  hideAllSections();
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const weeklyView = document.getElementById('weeklyView');
  document.getElementById('weeklyViewSection').style.display = 'block';
  weeklyView.innerHTML = '';
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - 6 + i);
    return d.toISOString().split('T')[0];
  });
  const logs = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};

  meds.forEach((med, i) => {
    const details = document.createElement('details');
    details.className = 'med-card';
    const summary = document.createElement('summary');
    summary.textContent = `${med.name} - Weekly Overview`;
    details.appendChild(summary);

    let missedThisMed = 0, takenThisMed = 0;
    let table = '<table class="weekly-table"><tr><th>Date</th>';
    med.times.forEach(t => table += `<th>${t}</th>`);
    table += '</tr>';

    days.forEach(date => {
      table += `<tr><td>${(new Date(date)).toLocaleDateString()}</td>`;
      med.times.forEach(t => {
        const now = new Date();
        const [hour, minute] = t.split(':').map(Number);
        const doseDateTime = new Date(date);
        doseDateTime.setHours(hour, minute, 0, 0);
        const isTaken = logs[date]?.some(e => e.name === med.name && e.time === t);
        let status = '';
        let cellClass = '';
        if (isTaken) {
          status = "✔️";
          cellClass = "weekly-taken";
          takenThisMed++;
        } else if (doseDateTime < now) {
          status = `<button class="mark-late-btn" onclick="markLate('${date}','${med.name}','${t}',${i})" title="Mark as taken late">❌</button>`;
          cellClass = "weekly-missed";
          missedThisMed++;
        } else {
          status = "⏳";
          cellClass = "weekly-upcoming";
        }
        table += `<td class="${cellClass}">${status}</td>`;
      });
      table += '</tr>';
    });
    table += '</table>';
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
    viewWeeklyTimeline();
  } else {
    showToast('Dose already marked as taken.');
  }
};

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
  const expectedPerDay = meds.reduce((sum, m) => sum + (m.times?.length || 0), 0);
  const takenCounts = days.map(date => logs[date]?.length || 0);

  if (days.length === 0) {
    canvas.style.display = "none";
    if (!document.getElementById("noChartMsg")) {
      const msg = document.createElement("div");
      msg.id = "noChartMsg";
      msg.textContent = "No data to display. Mark some doses as taken!";
      msg.style = "margin:20px;color:#666;text-align:center;";
      document.getElementById("chartSection").appendChild(msg);
    }
    return;
  }
  if (document.getElementById("noChartMsg")) {
    document.getElementById("noChartMsg").remove();
    canvas.style.display = "";
  }

  const ctx = canvas.getContext('2d');
  window.adherenceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Taken',
        data: takenCounts,
        backgroundColor: '#4caf50'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        title: { display: false }
      },
      scales: {
        y: { beginAtZero: true, suggestedMax: expectedPerDay }
      }
    }
  });
};

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

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
}
function scheduleDoseReminders() {
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  meds.forEach(med => {
    med.times.forEach((time, idx) => {
      if (med.reminders && med.reminders[idx]) {
        const now = new Date();
        const [hour, minute] = time.split(':').map(Number);
        const target = new Date();
        target.setHours(hour, minute, 0, 0);
        if (target > now) {
          const timeout = target.getTime() - now.getTime();
          setTimeout(() => {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Time to take ${med.name} (${med.dosage})`);
            }
          }, timeout);
        }
      }
    });
  });
}

function checkMissedDoses() {
  const user = getCurrentUser();
  let meds = JSON.parse(localStorage.getItem(user + '_medications')) || [];
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const logs = JSON.parse(localStorage.getItem(user + '_medLogs')) || {};
  let missed = [];

  meds.forEach(med => {
    med.times.forEach(time => {
      const [hour, minute] = time.split(':').map(Number);
      const doseTime = new Date();
      doseTime.setHours(hour, minute, 0, 0);
      if (doseTime < now) {
        const isTaken = logs[todayStr]?.some(e => e.name === med.name && e.time === time);
        if (!isTaken) {
          missed.push({ med: med.name, time });
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Missed dose: ${med.name} at ${time}`);
          }
        }
      }
    });
  });

  if (missed.length > 0) {
    showToast(`Missed ${missed.length} dose(s) today!`, 3500);
  }
}

function appStartup() {
  renderMedsGrouped();
  requestNotificationPermission();
  scheduleDoseReminders();
  checkMissedDoses();
  setInterval(checkMissedDoses, 60 * 1000);
};
appStartup();

});
