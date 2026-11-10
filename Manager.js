(function (root) {
  'use strict';

  var handle = null;
  var sessionToken = '';
  var queue = Promise.resolve();
  var defaults = {
    version: 1,
    settings: {
      schoolName: 'S.B. Public School Chhitauna', schoolWebsite: 'yourschool.cm', address: 'Chhitauna, Nichlaul, Maharajganj, UP',
      principalName: '', principalContact: '', logo: '', principalSignature: '', academicYear: '2026-27', currency: 'INR',
      classes: ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
      subjects: ['English', 'Hindi', 'Mathematics', 'Science', 'Social Studies'], exams: ['Mid Term', 'Annual Examination'],
      sidRanges: { Nursery: [1, 500], LKG: [501, 1001], UKG: [1002, 1501], 'Class 1': [1502, 2001], 'Class 2': [2002, 2501], 'Class 3': [2502, 3001], 'Class 4': [3002, 3501], 'Class 5': [3502, 4001], 'Class 6': [4002, 4501], 'Class 7': [4502, 5001], 'Class 8': [5002, 5501], 'Class 9': [5502, 6001], 'Class 10': [6002, 6501], 'Class 11': [6502, 7001], 'Class 12': [7002, 7501] },
      noticeTemplate: '', admitCardTemplate: '', marksheetTemplate: ''
    },
    students: [], teachers: [], fees: [], exams: [], marks: [], notices: [], attendance: [], salaryRecords: []
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function toHex(buffer) { return Array.prototype.map.call(new Uint8Array(buffer), function (byte) { return byte.toString(16).padStart(2, '0'); }).join(''); }

  function hash(password, salt) {
    if (!root.crypto || !root.crypto.subtle) return Promise.reject(new Error('Use Chrome or Edge over localhost to enable password hashing.'));
    return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(password) + ':' + String(salt || ''))).then(toHex);
  }

  function newToken() {
    return root.crypto.randomUUID ? root.crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
  }

  function makeDefaultDatabase() {
    var salt = newToken();
    return hash('admin123', salt).then(function (passwordHash) {
      var db = clone(defaults);
      db.admin = { id: 'ADM-001', username: 'admin', name: 'School Administrator', passwordSalt: salt, passwordHash: passwordHash };
      return db;
    });
  }

  function normalizeDatabase(db) {
    var changed = false;
    if (!db || typeof db !== 'object' || Array.isArray(db)) db = {};
    if (!db.settings || typeof db.settings !== 'object') { db.settings = clone(defaults.settings); changed = true; }
    else {
      Object.keys(defaults.settings).forEach(function (key) {
        if (db.settings[key] === undefined || db.settings[key] === null) { db.settings[key] = clone(defaults.settings[key]); changed = true; }
      });
      if (/^Bluebell/i.test(String(db.settings.schoolName || ''))) { db.settings.schoolName = defaults.settings.schoolName; changed = true; }
      if (!db.settings.address) { db.settings.address = defaults.settings.address; changed = true; }
    }
    if (!db.admin || !db.admin.passwordSalt || !db.admin.passwordHash) changed = true;
    ['students', 'teachers', 'fees', 'exams', 'marks', 'notices', 'attendance', 'salaryRecords'].forEach(function (key) {
      if (!Array.isArray(db[key])) { db[key] = []; changed = true; }
    });
    db.version = 1;
    return { db: db, changed: changed };
  }

  function requireHandle() {
    if (!handle) throw new Error('Select a database.json file before signing in.');
  }

  function readDatabase() {
    requireHandle();
    return handle.getFile().then(function (file) { return file.text(); }).then(function (text) {
      var parsed;
      try { parsed = JSON.parse(text || '{}'); } catch (error) { throw new Error('The selected file is not valid JSON. Choose or create a valid database.json file.'); }
      var normalized = normalizeDatabase(parsed);
      var db = normalized.db;
      if (!db.admin || !db.admin.passwordSalt || !db.admin.passwordHash) {
        return makeDefaultDatabase().then(function (fresh) {
          fresh.settings = db.settings;
          ['students', 'teachers', 'fees', 'exams', 'marks', 'notices', 'attendance', 'salaryRecords'].forEach(function (key) { fresh[key] = db[key]; });
          return writeDatabase(fresh).then(function () { return fresh; });
        });
      }
      return normalized.changed ? writeDatabase(db).then(function () { return db; }) : db;
    });
  }

  function writeDatabase(db) {
    requireHandle();
    return handle.createWritable().then(function (writer) {
      return writer.write(JSON.stringify(db, null, 2)).then(function () { return writer.close(); });
    }).catch(function (error) {
      throw new Error('Could not write the selected database file. Grant read/write permission and close it in other programs. ' + error.message);
    });
  }

  function verifyFileAccess(fileHandle) {
    return fileHandle.createWritable({ keepExistingData: true }).then(function (writer) {
      return writer.abort().then(function () { return 'granted'; });
    }).catch(function () {
      throw new Error('The selected database file must allow read/write access. Re-select it and approve the browser permission prompt.');
    });
  }

  function openHandleStore() {
    return new Promise(function (resolve, reject) {
      var request = root.indexedDB.open('sbps-database-handle', 1);
      request.onupgradeneeded = function () { request.result.createObjectStore('selected'); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('Could not remember the selected database file.')); };
    });
  }

  function rememberHandle(fileHandle) {
    if (!root.indexedDB) return Promise.resolve();
    return openHandleStore().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction('selected', 'readwrite');
        transaction.objectStore('selected').put(fileHandle, 'active');
        transaction.oncomplete = function () { database.close(); resolve(); };
        transaction.onerror = function () { database.close(); reject(transaction.error || new Error('Could not remember the database file.')); };
      });
    });
  }

  function getRememberedHandle() {
    if (!root.indexedDB) return Promise.resolve(null);
    return openHandleStore().then(function (database) {
      return new Promise(function (resolve, reject) {
        var request = database.transaction('selected', 'readonly').objectStore('selected').get('active');
        request.onsuccess = function () { var value = request.result || null; database.close(); resolve(value); };
        request.onerror = function () { database.close(); reject(request.error || new Error('Could not read the selected database file handle.')); };
      });
    });
  }

  function restoreDatabase() {
    return getRememberedHandle().then(function (fileHandle) {
      if (!fileHandle || !fileHandle.queryPermission) return null;
      return fileHandle.queryPermission({ mode: 'readwrite' }).then(function (permission) {
        return permission === 'granted' ? selectDatabase(fileHandle) : null;
      });
    }).catch(function () { return null; });
  }

  function selectDatabase(fileHandle) {
    return verifyFileAccess(fileHandle).then(function () {
      handle = fileHandle;
      return readDatabase().then(function () { sessionToken = ''; return rememberHandle(fileHandle).catch(function () {}); }).then(function () { return { name: handle.name }; });
    }).catch(function (error) { handle = null; throw error; });
  }

  function createDatabase(fileHandle) {
    return verifyFileAccess(fileHandle).then(function () {
      handle = fileHandle;
      return makeDefaultDatabase().then(function (db) { return writeDatabase(db).then(function () { sessionToken = ''; return rememberHandle(fileHandle).catch(function () {}); }).then(function () { return { name: handle.name }; }); });
    }).catch(function (error) { handle = null; throw error; });
  }

  function nextId(db, collection) {
    var prefixes = { students: 'STU', teachers: 'TCH', fees: 'FEE', exams: 'EXM', marks: 'MRK', notices: 'NTC', attendance: 'ATT', salaryRecords: 'SAL' };
    var highest = (db[collection] || []).reduce(function (max, item) {
      var match = String(item.id || '').match(/(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return (prefixes[collection] || 'REC') + '-' + String(highest + 1).padStart(4, '0');
  }

  function nextSid(db, className) {
    var range = db.settings.sidRanges[className];
    if (!range) throw new Error('Add an SID range for this class in School Settings.');
    var used = db.students.map(function (student) { return Number(student.sid); });
    for (var sid = Number(range[0]); sid <= Number(range[1]); sid += 1) if (used.indexOf(sid) < 0) return String(sid).padStart(3, '0');
    throw new Error('SID range is full for ' + className + '.');
  }

  function sanitize(collection, record) {
    var clean = Object.assign({}, record);
    delete clean.password;
    clean.updatedAt = new Date().toISOString();
    if (collection === 'fees') {
      clean.amount = Number(clean.amount || 0);
      clean.paidAmount = Number(clean.paidAmount || 0);
      clean.dueAmount = Math.max(0, clean.amount - clean.paidAmount);
    }
    if (collection === 'marks') {
      clean.totalScore = (clean.subjectMarks || []).reduce(function (sum, item) { return sum + Number(item.marks || 0); }, 0);
      clean.totalPossible = (clean.subjectMarks || []).reduce(function (sum, item) { return sum + Number(item.total || 0); }, 0);
      clean.percentage = clean.totalPossible ? Math.round(clean.totalScore / clean.totalPossible * 10000) / 100 : 0;
    }
    return clean;
  }

  function markEntries(record) {
    if (record.examResults && typeof record.examResults === 'object') return record.examResults;
    if (!record.examName) return {};
    var key = String(record.examId || record.examName), results = {};
    results[key] = Object.assign({}, record);
    return results;
  }

  function summarizeMarks(record) {
    var entries = Object.keys(record.examResults).map(function (key) { return record.examResults[key]; });
    record.examNames = entries.map(function (item) { return item.examName; });
    record.examName = record.examNames.join(', ');
    record.totalScore = entries.reduce(function (sum, item) { return sum + Number(item.totalScore || 0); }, 0);
    record.totalPossible = entries.reduce(function (sum, item) { return sum + Number(item.totalPossible || 0); }, 0);
    record.percentage = record.totalPossible ? Math.round(record.totalScore / record.totalPossible * 10000) / 100 : 0;
    if (entries.length) record.subjectMarks = entries[0].subjectMarks || [];
    record.updatedAt = new Date().toISOString();
  }

  function dispatch(action, payload, token) {
    payload = payload || {};
    if (action === 'connection') return Promise.resolve({ connected: Boolean(handle), mode: 'offline' });
    if (action === 'login') return readDatabase().then(function (db) {
      return hash(payload.password || '', db.admin.passwordSalt).then(function (passwordHash) {
        if (payload.username !== db.admin.username || passwordHash !== db.admin.passwordHash) throw new Error('Incorrect admin username or password.');
        sessionToken = newToken();
        return { token: sessionToken, user: { id: db.admin.id, username: db.admin.username, name: db.admin.name, role: 'admin' } };
      });
    });
    if (action === 'logout') { sessionToken = ''; return Promise.resolve({ ok: true }); }
    if (!sessionToken || token !== sessionToken) return Promise.reject(new Error('Please sign in again.'));

    return readDatabase().then(function (db) {
      if (action === 'getData') {
        var data = clone(db); delete data.admin;
        return { user: { id: db.admin.id, username: db.admin.username, name: db.admin.name, role: 'admin' }, data: data };
      }
      if (action === 'save') {
        var collection = payload.collection;
        if (!Array.isArray(db[collection])) throw new Error('Invalid record type.');
        var record = payload.record || {}, clean = sanitize(collection, record);
        if (collection === 'marks') {
          var examKey = String(record.examId || record.examName || '');
          if (!record.studentSid || !examKey) throw new Error('Select a student and an exam first.');
          var index = record.id ? db.marks.findIndex(function (item) { return item.id === record.id; }) : db.marks.findIndex(function (item) { return String(item.studentSid) === String(record.studentSid); });
          var sheet = index >= 0 ? db.marks[index] : { id: nextId(db, 'marks'), studentSid: String(record.studentSid), studentName: record.studentName || '', className: record.className || '', examResults: {}, code: record.code || 'MS-' + Date.now().toString(36).toUpperCase() };
          sheet.examResults = markEntries(sheet);
          clean.examId = examKey; clean.examName = record.examName || ''; clean.code = record.code || 'EX-' + Date.now().toString(36).toUpperCase();
          sheet.examResults[examKey] = clean; sheet.studentName = record.studentName || sheet.studentName; sheet.className = record.className || sheet.className; summarizeMarks(sheet);
          if (index >= 0) db.marks[index] = sheet; else db.marks.push(sheet);
          return writeDatabase(db).then(function () { return { record: sheet }; });
        }
        var index = record.id ? db[collection].findIndex(function (item) { return item.id === record.id; }) : -1;
        if (index >= 0) db[collection][index] = Object.assign({}, db[collection][index], clean);
        else {
          clean.id = clean.id || nextId(db, collection);
          if (collection === 'students') {
            clean.sid = clean.sid || nextSid(db, clean.className);
            if (db.students.some(function (item) { return String(item.sid) === String(clean.sid); })) throw new Error('SID already exists.');
          }
          db[collection].push(clean);
          if (collection === 'students' && Number(clean.feeAmount || 0) > 0) db.fees.push({ id: nextId(db, 'fees'), studentSid: clean.sid, studentName: clean.name, className: clean.className, date: new Date().toISOString().slice(0, 10), month: 'Annual fee', amount: Number(clean.feeAmount), paidAmount: 0, dueAmount: Number(clean.feeAmount), updatedAt: new Date().toISOString() });
        }
        return writeDatabase(db).then(function () { return { record: index >= 0 ? db[collection][index] : clean }; });
      }
      if (action === 'remove') {
        var rows = db[payload.collection];
        if (!Array.isArray(rows)) throw new Error('Invalid record type.');
        var id = String(payload.id || ''), index = rows.findIndex(function (item) { return item.id === id; });
        if (index < 0) throw new Error('Record not found.');
        var removed = rows.splice(index, 1)[0];
        return writeDatabase(db).then(function () { return { removed: removed.id }; });
      }
      if (action === 'updateSettings') {
        db.settings = Object.assign({}, db.settings, payload.settings || {});
        return writeDatabase(db).then(function () { return { settings: db.settings }; });
      }
      if (action === 'changeUsername') return hash(payload.currentPassword || '', db.admin.passwordSalt).then(function (currentHash) {
        var username = String(payload.username || '').trim();
        if (currentHash !== db.admin.passwordHash) throw new Error('Current password is incorrect.');
        if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) throw new Error('Use 3 to 40 letters, numbers, dots, underscores or hyphens.');
        db.admin.username = username;
        return writeDatabase(db).then(function () { return { username: username }; });
      });
      if (action === 'changePassword') return hash(payload.currentPassword || '', db.admin.passwordSalt).then(function (currentHash) {
        if (currentHash !== db.admin.passwordHash) throw new Error('Current password is incorrect.');
        var password = String(payload.newPassword || '');
        if (password.length < 8) throw new Error('Use at least 8 characters for the new password.');
        db.admin.passwordSalt = newToken();
        return hash(password, db.admin.passwordSalt).then(function (passwordHash) {
          db.admin.passwordHash = passwordHash;
          return writeDatabase(db).then(function () { return { ok: true }; });
        });
      });
      return Promise.reject(new Error('Unknown action.'));
    });
  }

  function call(action, payload, token) {
    var result = queue.then(function () { return dispatch(action, payload, token); });
    queue = result.catch(function () {});
    return result;
  }

  root.Manager = {
    selectDatabase: selectDatabase,
    createDatabase: createDatabase,
    restoreDatabase: restoreDatabase,
    call: call,
    login: function (username, password) { return call('login', { username: username, password: password }); },
    getData: function (token) { return call('getData', {}, token); },
    save: function (token, collection, record) { return call('save', { collection: collection, record: record }, token); },
    remove: function (token, collection, id) { return call('remove', { collection: collection, id: id }, token); },
    updateSettings: function (token, settings) { return call('updateSettings', { settings: settings }, token); },
    changeUsername: function (token, username, currentPassword) { return call('changeUsername', { username: username, currentPassword: currentPassword }, token); },
    changePassword: function (token, currentPassword, newPassword) { return call('changePassword', { currentPassword: currentPassword, newPassword: newPassword }, token); },
    connection: function () { return call('connection'); }
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
