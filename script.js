var currentFilter = 'all';
var searchTerm = '';
var entries = JSON.parse(localStorage.getItem('tnn-entries') || '[]');
var lastCleared = null;
var reminder = JSON.parse(localStorage.getItem('tnn-reminder') || 'null');
var reminderFired = false;

function saveEntries() {
  localStorage.setItem('tnn-entries', JSON.stringify(entries));
}

function saveReminder() {
  localStorage.setItem('tnn-reminder', JSON.stringify(reminder));
}

function updateMonthlyReview() {
  var now = new Date();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  var monthEntries = entries.filter(function (e) {
    var ts = e.dateMs || Date.parse(e.timestamp);
    return ts >= monthStart.getTime();
  });

  var total = monthEntries.length;
  var completed = monthEntries.filter(function (e) { return e.completed && !e.deleted; }).length;
  var active = monthEntries.filter(function (e) { return !e.completed && !e.deleted; }).length;
  var deleted = monthEntries.filter(function (e) { return e.deleted; }).length;

  document.getElementById('month-total').textContent = total;
  document.getElementById('month-completed').textContent = completed;
  document.getElementById('month-active').textContent = active;
  document.getElementById('month-deleted').textContent = deleted;

  function pct(n) { return total > 0 ? (n / total * 100) + '%' : '0%'; }
  document.getElementById('bar-month-completed').style.width = pct(completed);
  document.getElementById('bar-month-active').style.width = pct(active);
  document.getElementById('bar-month-deleted').style.width = pct(deleted);
}

function updateWeeklyReview() {
  var now = new Date();
  var day = now.getDay();
  var diff = day === 0 ? -6 : 1 - day;
  var weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  var weekEntries = entries.filter(function (e) {
    var ts = e.dateMs || Date.parse(e.timestamp);
    return ts >= weekStart.getTime();
  });

  var total = weekEntries.length;
  var completed = weekEntries.filter(function (e) { return e.completed && !e.deleted; }).length;
  var active = weekEntries.filter(function (e) { return !e.completed && !e.deleted; }).length;
  var deleted = weekEntries.filter(function (e) { return e.deleted; }).length;

  document.getElementById('week-total').textContent = total;
  document.getElementById('week-completed').textContent = completed;
  document.getElementById('week-active').textContent = active;
  document.getElementById('week-deleted').textContent = deleted;

  function pct(n) { return total > 0 ? (n / total * 100) + '%' : '0%'; }
  document.getElementById('bar-completed').style.width = pct(completed);
  document.getElementById('bar-active').style.width = pct(active);
  document.getElementById('bar-deleted').style.width = pct(deleted);

  var messages = [];

  if (active >= 3 && active > completed) {
    messages.push('You have several active items with few completions this week. Try finishing one before starting another.');
  }
  if (deleted >= 2 && total > 0 && deleted / total >= 0.3) {
    messages.push('Several entries were deleted this week. It may be worth checking whether your focus areas are realistic.');
  }

  var activeEntries = weekEntries.filter(function (e) { return !e.completed && !e.deleted; });
  var seen = {};
  var hasDuplicates = false;
  activeEntries.forEach(function (e) {
    var key = e.focus.trim().toLowerCase();
    if (seen[key]) { hasDuplicates = true; }
    seen[key] = true;
  });
  if (hasDuplicates) {
    messages.push('Some entries appear more than once and are still active. Consider breaking them into smaller steps.');
  }

  var list = document.getElementById('obstacle-list');
  list.innerHTML = '';
  if (messages.length === 0) {
    var li = document.createElement('li');
    li.className = 'obstacle-clear';
    li.textContent = 'No obstacles detected this week. Keep it up.';
    list.appendChild(li);
  } else {
    messages.forEach(function (msg) {
      var li = document.createElement('li');
      li.className = 'obstacle-item';
      li.textContent = msg;
      list.appendChild(li);
    });
  }

  var signals = [];

  if (completed >= 3) {
    signals.push('Outstanding — you have completed ' + completed + ' items this week!');
  } else if (completed >= 2) {
    signals.push('You have completed ' + completed + ' items this week. Keep the momentum going!');
  }

  var daySet = {};
  weekEntries.filter(function (e) { return !e.deleted; }).forEach(function (e) {
    var d = new Date(e.dateMs || Date.parse(e.timestamp));
    daySet[d.toDateString()] = true;
  });
  var distinctDays = Object.keys(daySet).length;
  if (distinctDays >= 3) {
    signals.push('You have been active on ' + distinctDays + ' different days this week. Great consistency!');
  }

  var nonDeleted = weekEntries.filter(function (e) { return !e.deleted; }).length;
  if (nonDeleted >= 3 && completed >= Math.ceil(nonDeleted / 2)) {
    signals.push('You are completing more than half your focus items this week. Strong follow-through!');
  }

  var signalsList = document.getElementById('signals-list');
  signalsList.innerHTML = '';
  signals.forEach(function (msg) {
    var li = document.createElement('li');
    li.className = 'signal-item';
    li.textContent = msg;
    signalsList.appendChild(li);
  });
}

function updateReviews() {
  updateWeeklyReview();
  updateMonthlyReview();
}

function applyFilter() {
  var items = document.querySelectorAll('#entries-list li');
  items.forEach(function (li) {
    var isCompleted = li.classList.contains('completed');
    var isDeleted = li.classList.contains('deleted');
    var text = li.querySelector('.entry-content').textContent.toLowerCase();
    var matchesSearch = searchTerm === '' || text.includes(searchTerm);

    var matchesFilter;
    if (currentFilter === 'all') {
      matchesFilter = !isDeleted;
    } else if (currentFilter === 'active') {
      matchesFilter = !isCompleted && !isDeleted;
    } else if (currentFilter === 'completed') {
      matchesFilter = isCompleted && !isDeleted;
    } else if (currentFilter === 'deleted') {
      matchesFilter = isDeleted;
    }

    li.style.display = (matchesFilter && matchesSearch) ? '' : 'none';
  });
}

function renderEntry(entry) {
  var li = document.createElement('li');
  if (entry.completed) li.classList.add('completed');
  if (entry.deleted) li.classList.add('deleted');

  var content = document.createElement('div');
  content.className = 'entry-content';

  var span = document.createElement('span');
  span.textContent = entry.focus + ' — ' + entry.timestamp;
  content.appendChild(span);

  if (entry.note) {
    var note = document.createElement('small');
    note.className = 'entry-note';
    note.textContent = entry.note;
    content.appendChild(note);
  }

  var completeBtn = document.createElement('button');
  completeBtn.textContent = entry.completed ? 'Undo Complete' : 'Mark Complete';
  completeBtn.className = 'complete-btn';
  completeBtn.addEventListener('click', function () {
    entry.completed = !entry.completed;
    li.classList.toggle('completed');
    completeBtn.textContent = entry.completed ? 'Undo Complete' : 'Mark Complete';
    saveEntries();
    applyFilter();
    updateReviews();
  });

  var deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.className = 'delete-btn';
  deleteBtn.addEventListener('click', function () {
    entry.deleted = true;
    li.classList.add('deleted');
    saveEntries();
    applyFilter();
    updateReviews();
  });

  var restoreBtn = document.createElement('button');
  restoreBtn.textContent = 'Restore';
  restoreBtn.className = 'restore-btn';
  restoreBtn.addEventListener('click', function () {
    entry.deleted = false;
    li.classList.remove('deleted');
    saveEntries();
    applyFilter();
    updateReviews();
  });

  var permDeleteBtn = document.createElement('button');
  permDeleteBtn.textContent = 'Permanently Delete';
  permDeleteBtn.className = 'perm-delete-btn';

  var cancelPermBtn = document.createElement('button');
  cancelPermBtn.textContent = 'Cancel';
  cancelPermBtn.className = 'cancel-btn';

  permDeleteBtn.addEventListener('click', function () {
    if (permDeleteBtn.dataset.confirming) {
      entries = entries.filter(function (e) { return e !== entry; });
      saveEntries();
      li.remove();
      updateReviews();
    } else {
      permDeleteBtn.dataset.confirming = 'true';
      permDeleteBtn.textContent = 'Confirm Delete?';
      cancelPermBtn.style.display = 'inline';
    }
  });

  cancelPermBtn.addEventListener('click', function () {
    delete permDeleteBtn.dataset.confirming;
    permDeleteBtn.textContent = 'Permanently Delete';
    cancelPermBtn.style.display = 'none';
  });

  li.appendChild(content);
  li.appendChild(completeBtn);
  li.appendChild(deleteBtn);
  li.appendChild(restoreBtn);
  li.appendChild(permDeleteBtn);
  li.appendChild(cancelPermBtn);
  document.getElementById('entries-list').appendChild(li);
}

function renderReminderSection() {
  var currentEl = document.getElementById('reminder-current');
  var clearBtn = document.getElementById('reminder-clear-btn');
  if (reminder) {
    currentEl.textContent = 'Set: "' + reminder.message + '" at ' + reminder.time;
    currentEl.style.display = 'block';
    clearBtn.style.display = 'block';
  } else {
    currentEl.style.display = 'none';
    clearBtn.style.display = 'none';
  }
}

function fireReminder() {
  reminderFired = true;
  document.getElementById('reminder-banner-text').textContent = reminder.message;
  document.getElementById('reminder-banner').style.display = 'flex';
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('TNN Tracker Reminder', { body: reminder.message });
  }
}

function checkReminder() {
  if (!reminder || reminderFired) return;
  var now = Date.now();
  if (now >= reminder.targetMs && now - reminder.targetMs <= 5 * 60 * 1000) {
    fireReminder();
  }
}

document.getElementById('search-input').addEventListener('input', function () {
  searchTerm = this.value.trim().toLowerCase();
  applyFilter();
});

document.querySelectorAll('.filter-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(function (b) {
      b.classList.remove('active-filter');
    });
    btn.classList.add('active-filter');
    applyFilter();
  });
});

document.getElementById('clear-btn').addEventListener('click', function () {
  var confirm = document.getElementById('clear-confirm');
  confirm.style.display = confirm.style.display === 'block' ? 'none' : 'block';
  document.getElementById('undo-clear-btn').style.display = 'none';
});

document.getElementById('clear-yes-btn').addEventListener('click', function () {
  lastCleared = entries.slice();
  entries = [];
  saveEntries();
  document.getElementById('entries-list').innerHTML = '';
  document.getElementById('clear-confirm').style.display = 'none';
  document.getElementById('undo-clear-btn').style.display = 'block';
  updateReviews();
});

document.getElementById('clear-cancel-btn').addEventListener('click', function () {
  document.getElementById('clear-confirm').style.display = 'none';
});

document.getElementById('undo-clear-btn').addEventListener('click', function () {
  entries = lastCleared;
  lastCleared = null;
  saveEntries();
  document.getElementById('entries-list').innerHTML = '';
  entries.forEach(function (entry) { renderEntry(entry); });
  applyFilter();
  updateReviews();
  document.getElementById('undo-clear-btn').style.display = 'none';
});

document.getElementById('export-btn').addEventListener('click', function () {
  function csvField(val) {
    return '"' + (val || '').toString().replace(/"/g, '""') + '"';
  }
  function getStatus(entry) {
    if (entry.deleted) return 'Deleted';
    if (entry.completed) return 'Completed';
    return 'Active';
  }
  var rows = [['Focus', 'Note', 'Timestamp', 'Status'].map(csvField).join(',')];
  entries.forEach(function (entry) {
    rows.push([
      csvField(entry.focus),
      csvField(entry.note || ''),
      csvField(entry.timestamp),
      csvField(getStatus(entry))
    ].join(','));
  });
  var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'tnn-tracker-entries.csv';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('reminder-set-btn').addEventListener('click', function () {
  var msg = document.getElementById('reminder-msg-input').value.trim();
  var time = document.getElementById('reminder-time-input').value;
  if (msg && time) {
    var parts = time.split(':').map(Number);
    var target = new Date();
    target.setHours(parts[0], parts[1], 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    reminder = { message: msg, time: time, targetMs: target.getTime() };
    reminderFired = false;
    saveReminder();
    renderReminderSection();
    document.getElementById('reminder-msg-input').value = '';
    document.getElementById('reminder-time-input').value = '';
    document.getElementById('reminder-banner').style.display = 'none';
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
});

document.getElementById('reminder-clear-btn').addEventListener('click', function () {
  reminder = null;
  reminderFired = false;
  saveReminder();
  renderReminderSection();
  document.getElementById('reminder-banner').style.display = 'none';
});

document.getElementById('reminder-dismiss-btn').addEventListener('click', function () {
  document.getElementById('reminder-banner').style.display = 'none';
});

document.getElementById('start-btn').addEventListener('click', function () {
  var input = document.getElementById('focus-input');
  var noteInput = document.getElementById('note-input');
  var focus = input.value.trim();
  if (focus) {
    document.getElementById('status').textContent = 'Tracking started: ' + focus;
    input.value = '';
    var entry = {
      focus: focus,
      note: noteInput.value.trim(),
      timestamp: new Date().toLocaleString(),
      dateMs: Date.now(),
      completed: false,
      deleted: false
    };
    noteInput.value = '';
    entries.push(entry);
    saveEntries();
    renderEntry(entry);
    applyFilter();
    updateReviews();
  } else {
    document.getElementById('status').textContent = 'Please enter today\'s focus.';
  }
});

entries.forEach(function (entry) { renderEntry(entry); });
applyFilter();
updateReviews();
renderReminderSection();
checkReminder();
setInterval(checkReminder, 30000);

var timerSeconds = 0;
var timerRunning = false;
var timerInterval = null;

function formatTime(s) {
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
}

document.getElementById('timer-toggle').addEventListener('click', function () {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timer-toggle').textContent = 'Start';
  } else {
    timerInterval = setInterval(function () {
      timerSeconds++;
      document.getElementById('timer-display').textContent = formatTime(timerSeconds);
    }, 1000);
    timerRunning = true;
    document.getElementById('timer-toggle').textContent = 'Stop';
  }
});

document.getElementById('timer-reset').addEventListener('click', function () {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = 0;
  document.getElementById('timer-display').textContent = '00:00';
  document.getElementById('timer-toggle').textContent = 'Start';
});
