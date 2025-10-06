import React, { useState } from 'react';

/*
  RegistrationPortal.jsx
  Paste this file into src/RegistrationPortal.jsx
  IMPORTANT: Set VITE_GOOGLE_SCRIPT_URL in .env (local) and in Vercel env vars for production.
*/

const TEAM_COUNT = 13;
const MAX_PARTICIPANTS_PER_TEAM = 50;

const SPORTS = [
  '100 m','200 m','400 m','800 m','1500 m','5000 m','4x100 m relay',
  'Long Jump','High Jump','Triple Jump','Discuss Throw','Shotput','Javelin throw',
  '400 m walking','800 m walking',
  'Squash','Chess','Carrom (Singles)','Carrom (Doubles)',
  'Table Tennis (Singles)','Table Tennis (Doubles)','Table Tennis (Mixed Doubles)',
  'Badminton (Singles)','Badminton (Doubles)','Badminton (Mixed Doubles)',
  'Volleyball (Men)','Kabaddi (Men)','Basketball (Men)','Tug of War','Football','Lawn Tennis','Quiz'
];

// demo credentials (replace with proper auth for production)
const TEAM_CREDENTIALS = Array.from({ length: TEAM_COUNT }, (_, i) => ({ username: `manager_team${i + 1}`, password: `Cham@Team${i + 1}` }));
const ADMIN_CREDENTIALS = [
  { username: 'admin1', password: 'Chamba@Admin1' },
  { username: 'admin2', password: 'Chamba@Admin2' },
  { username: 'admin3', password: 'Chamba@Admin3' },
];

// read Apps Script URL from env (Vite uses import.meta.env)
const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzTAhyGLmIeag2eOp2OfMP56meU4Y1OBo0ZHOptdEMvAOIk0xrdMZsjoXXDO83M4UARNw/exec';
const SAMPLE_SHEET_ID = import.meta.env.VITE_SAMPLE_SHEET_ID || '10L_ji8OziXIVSZ1ud8JZomL72NeuVpyRh06Qx1oicWM';

function getCategory(gender, age) {
  const g = (gender || '').toLowerCase();
  const a = Number(age) || 0;
  if (g === 'male') {
    if (a > 52) return 'Senior Veteran';
    if (a > 45) return 'Veteran';
    return 'Open';
  }
  if (g === 'female') {
    if (a > 40) return 'Veteran';
    return 'Open';
  }
  return 'Open';
}

export default function RegistrationPortal() {
  const [team, setTeam] = useState(1);
  const [participants, setParticipants] = useState([]);
  const [slotsToCreate, setSlotsToCreate] = useState(13);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedTeam, setLoggedTeam] = useState(null);
  const [adminUser, setAdminUser] = useState(null);

  const [allData, setAllData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  function createSlots(n) {
    if (!isLoggedIn || isAdmin) {
      setMessage({ type: 'error', text: 'Only logged-in team managers (not admins) can create participant slots. Please log in as a manager.' });
      return;
    }
    if (loggedTeam !== team) {
      setMessage({ type: 'error', text: `You are logged in as Team ${loggedTeam}. Switch to Team ${team} to create slots.` });
      return;
    }
    const count = Math.max(0, Math.min(Number(n) || 0, MAX_PARTICIPANTS_PER_TEAM));
    const slots = Array.from({ length: count }, () => ({ name: '', gender: '', age: '', designation: '', phone: '', sports: ['', '', '', '', ''] }));
    setParticipants(slots);
    setMessage({ type: 'info', text: `Created ${count} participant slots for Team ${team}.` });
  }

  function updateParticipant(i, field, value) {
    setParticipants((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  function updateParticipantSport(i, sportIndex, value) {
    setParticipants((prev) =>
      prev.map((row, idx) => {
        if (idx !== i) return row;
        const sports = Array.isArray(row.sports) ? [...row.sports] : ['', '', '', '', ''];
        sports[sportIndex] = value;
        return { ...row, sports };
      })
    );
  }

  function validate() {
    if (!isLoggedIn) { setMessage({ type: 'error', text: 'Only logged-in team managers can submit participants.' }); return false; }
    if (isAdmin) { setMessage({ type: 'error', text: 'Admins cannot submit team participants. Log in as a manager.' }); return false; }
    if (loggedTeam !== team) { setMessage({ type: 'error', text: `You are logged in as manager for Team ${loggedTeam}. Switch to Team ${team} to submit.` }); return false; }
    if (!participants || participants.length === 0) { setMessage({ type: 'error', text: 'No participant slots created.' }); return false; }

    const counts = {
      'Badminton (Singles)': 0, 'Badminton (Doubles)': 0, 'Badminton (Mixed Doubles)': 0,
      'Table Tennis (Singles)': 0, 'Table Tennis (Doubles)': 0, 'Table Tennis (Mixed Doubles)': 0,
      'Chess': { male: 0, female: 0 }, 'Carrom (Singles)': { male: 0, female: 0 },
    };

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i] || {};
      if (!p.name || !p.name.trim()) { setMessage({ type: 'error', text: `Participant ${i + 1}: name required.` }); return false; }
      if (!p.age || isNaN(Number(p.age)) || Number(p.age) <= 0) { setMessage({ type: 'error', text: `Participant ${i + 1}: enter a valid age.` }); return false; }
      if (!p.phone || !p.phone.trim()) { setMessage({ type: 'error', text: `Participant ${i + 1}: phone required.` }); return false; }
      if (!/^[0-9]{6,15}$/.test(p.phone.trim())) { setMessage({ type: 'error', text: `Participant ${i + 1}: enter a valid phone number (6-15 digits).` }); return false; }

      const gender = (p.gender || '').toLowerCase();
      const age = Number(p.age);
      p._category = getCategory(gender, age);

      const maxDropdowns = gender === 'female' ? 5 : 3;
      const sel = (Array.isArray(p.sports) ? p.sports.slice(0, maxDropdowns) : []).filter(Boolean);

      const uniqueSel = Array.from(new Set(sel));
      if (uniqueSel.length !== sel.length) { setMessage({ type: 'error', text: `Participant ${i + 1}: duplicate sports selected.` }); return false; }
      if (sel.length > maxDropdowns) { setMessage({ type: 'error', text: `Participant ${i + 1}: max ${maxDropdowns} sports allowed.` }); return false; }

      sel.forEach((s) => {
        if (s === 'Badminton (Singles)') counts['Badminton (Singles)']++;
        if (s === 'Badminton (Doubles)') counts['Badminton (Doubles)']++;
        if (s === 'Badminton (Mixed Doubles)') counts['Badminton (Mixed Doubles)']++;
        if (s === 'Table Tennis (Singles)') counts['Table Tennis (Singles)']++;
        if (s === 'Table Tennis (Doubles)') counts['Table Tennis (Doubles)']++;
        if (s === 'Table Tennis (Mixed Doubles)') counts['Table Tennis (Mixed Doubles)']++;
        if (s === 'Chess') { if (gender === 'female') counts['Chess'].female++; else counts['Chess'].male++; }
        if (s === 'Carrom (Singles)') { if (gender === 'female') counts['Carrom (Singles)'].female++; else counts['Carrom (Singles)'].male++; }
      });
    }

    if (counts['Badminton (Singles)'] > 2) { setMessage({ type: 'error', text: 'Badminton: max 2 singles players per team.' }); return false; }
    if (counts['Table Tennis (Singles)'] > 2) { setMessage({ type: 'error', text: 'Table Tennis: max 2 singles players per team.' }); return false; }

    const checkDoubles = (label, requireMixed) => {
      const c = counts[label];
      if (c === 0) return true;
      if (c !== 2) { setMessage({ type: 'error', text: `${label}: if selected, exactly 2 participants must be entered. Currently ${c} found.` }); return false; }
      if (requireMixed) {
        const genders = participants.filter((p) => (p.sports || []).includes(label)).map((p) => (p.gender || '').toLowerCase());
        const maleCount = genders.filter((g) => g === 'male').length;
        const femaleCount = genders.filter((g) => g === 'female').length;
        if (!(maleCount === 1 && femaleCount === 1)) { setMessage({ type: 'error', text: `${label}: mixed doubles require one male and one female.` }); return false; }
      }
      return true;
    };

    if (!checkDoubles('Badminton (Doubles)', false)) return false;
    if (!checkDoubles('Badminton (Mixed Doubles)', true)) return false;
    if (!checkDoubles('Table Tennis (Doubles)', false)) return false;
    if (!checkDoubles('Table Tennis (Mixed Doubles)', true)) return false;

    if (counts['Chess'].male > 1 || counts['Chess'].female > 1) { setMessage({ type: 'error', text: 'Chess: only one player per gender allowed per team.' }); return false; }
    if (counts['Carrom (Singles)'].male > 1 || counts['Carrom (Singles)'].female > 1) { setMessage({ type: 'error', text: 'Carrom (Singles): only one player per gender allowed per team.' }); return false; }

    return true;
  }

  async function submitWithDiagnostics(e) {
    e.preventDefault();
    setMessage(null);
    if (!validate()) return;
    setLoading(true);

    const payload = {
      team: `Team ${team}`,
      teamNumber: team,
      manager: username,
      timestamp: new Date().toISOString(),
      participants,
    };

    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
      });

      const text = await res.text();
      if (!res.ok) {
        console.error('submitWithDiagnostics bad status', res.status, text);
        setMessage({ type: 'error', text: `Submission failed: server returned ${res.status}. Check DevTools/network.` });
        setLoading(false);
        return;
      }

      let data;
      try { data = JSON.parse(text); } catch (err) {
        console.error('submitWithDiagnostics JSON parse error — body:', text);
        setMessage({ type: 'error', text: 'Submission failed: server returned invalid JSON. Check DevTools/network.' });
        setLoading(false);
        return;
      }

      setMessage({ type: 'success', text: data.message || 'Registration submitted successfully.' });
      setParticipants([]);
    } catch (err) {
      console.error('submitWithDiagnostics error', err);
      if (err && err.message && err.message.includes('Failed to fetch')) {
        setMessage({ type: 'error', text: 'Submission failed: network/CORS error (Failed to fetch). Ensure Apps Script is deployed and accessible.' });
      } else {
        setMessage({ type: 'error', text: `Submission failed: ${err.message}` });
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllDataDebug() {
    setLoadingData(true);
    setMessage(null);
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL + '?action=export', { method: 'GET', mode: 'cors' });
      const text = await res.text();
      if (!res.ok) {
        console.error('fetchAllDataDebug bad status', res.status, text);
        setMessage({ type: 'error', text: `Failed to fetch data: server returned ${res.status}. Check DevTools/network.` });
        setLoadingData(false);
        return;
      }
      let data;
      try { data = JSON.parse(text); } catch (err) {
        console.error('fetchAllDataDebug JSON parse error — body:', text);
        setMessage({ type: 'error', text: 'Failed to fetch data: server returned invalid JSON. Check Apps Script response.' });
        setLoadingData(false);
        return;
      }
      setAllData(data);
      setMessage({ type: 'success', text: 'Fetched all registration data.' });
    } catch (err) {
      console.error('fetchAllDataDebug error', err);
      if (err && err.message && err.message.includes('Failed to fetch')) {
        setMessage({ type: 'error', text: 'Failed to fetch data: network/CORS error (Failed to fetch). Ensure Apps Script web app is deployed and accessible.' });
      } else {
        setMessage({ type: 'error', text: `Failed to fetch data: ${err.message}` });
      }
    } finally {
      setLoadingData(false);
    }
  }

  function downloadAllCSV() {
    if (!allData || !Array.isArray(allData) || allData.length === 0) return;
    const header = Object.keys(allData[0]);
    const NEWLINE = String.fromCharCode(10);
    const csvRows = allData.map((r) => header.map((h) => '"' + ((r[h] || '').toString().replace(/"/g, '""')) + '"').join(','));
    const csv = [header.join(','), ...csvRows].join(NEWLINE);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLogin(e) {
    e.preventDefault();
    setMessage(null);

    const adminIdx = ADMIN_CREDENTIALS.findIndex((cred) => cred.username === username && cred.password === password);
    if (adminIdx !== -1) {
      setIsLoggedIn(true);
      setIsAdmin(true);
      setAdminUser(ADMIN_CREDENTIALS[adminIdx].username);
      setLoggedTeam(null);
      setMessage({ type: 'success', text: `Logged in as admin: ${ADMIN_CREDENTIALS[adminIdx].username}` });
      return;
    }

    const teamIndex = TEAM_CREDENTIALS.findIndex((cred) => cred.username === username && cred.password === password);
    if (teamIndex === -1) { setMessage({ type: 'error', text: 'Invalid username or password.' }); return; }

    setIsLoggedIn(true);
    setIsAdmin(false);
    setLoggedTeam(teamIndex + 1);
    setTeam(teamIndex + 1);
    setAdminUser(null);
    setMessage({ type: 'success', text: `Logged in as ${username} (Team ${teamIndex + 1}).` });
  }

  function handleLogout() {
    setIsLoggedIn(false); setIsAdmin(false); setLoggedTeam(null); setUsername(''); setPassword(''); setParticipants([]); setMessage({ type: 'info', text: 'Logged out.' });
  }

  function exportTeamSlotsCSV() {
    if (!participants || participants.length === 0) return;
    if (!isLoggedIn || isAdmin || loggedTeam !== team) { setMessage({ type: 'error', text: 'Only the logged-in team manager can export this team CSV.' }); return; }
    const rows = participants.map((p) => ({
      team: `Team ${team}`,
      name: p.name || '',
      gender: p.gender || '',
      age: p.age || '',
      designation: p.designation || '',
      phone: p.phone || '',
      sports: (Array.isArray(p.sports) ? p.sports.filter(Boolean).join('; ') : ''),
      category: getCategory(p.gender, p.age),
    }));
    const header = Object.keys(rows[0] || { team: '', name: '', gender: '', age: '', designation: '', phone: '', sports: '', category: '' });
    const NEWLINE = String.fromCharCode(10);
    const csvRows = rows.map((r) => header.map((h) => '"' + ((r[h] || '').toString().replace(/"/g, '""')) + '"').join(','));
    const csv = [header.join(','), ...csvRows].join(NEWLINE);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-${team}-participants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-6">
      <div className="max-w-6xl mx-auto bg-white shadow-lg rounded-2xl p-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">Chamba Sports Meet — Manager & Admin Portal</h1>
          <p className="text-sm text-gray-600">Managers (13) can log in to register participants for their teams. Admins (3) can view and download all registrations.</p>
        </header>

        <section className="mb-4 p-4 border rounded-lg">
          {!isLoggedIn ? (
            <form onSubmit={handleLogin} className="grid grid-cols-3 gap-3 items-end">
              <label className="flex flex-col">
                <span className="text-sm font-medium">Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="manager_team1 or admin1" className="mt-1 p-2 border rounded" />
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-medium">Password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Cham@Team1 or Chamba@Admin1" className="mt-1 p-2 border rounded" />
              </label>

              <div className="col-span-3 flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Login</button>
                <button type="button" onClick={() => { setUsername(''); setPassword(''); }} className="px-4 py-2 border rounded-lg">Clear</button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Logged in as: {isAdmin ? adminUser : username} {isAdmin ? '(Admin)' : `(Team ${loggedTeam})`}</div>
                <div className="text-xs text-gray-600">{isAdmin ? 'Admin dashboard available below.' : 'Use the controls below to create slots and register participants for your team.'}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleLogout} className="px-3 py-1 border rounded">Logout</button>
                <button onClick={() => { setParticipants([]); setMessage(null); }} className="px-3 py-1 border rounded">Clear slots</button>
              </div>
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="mb-6 p-4 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Admin Dashboard</h3>
            <div className="flex gap-2 mb-4">
              <button onClick={fetchAllDataDebug} className="px-4 py-2 bg-indigo-600 text-white rounded">Fetch all registrations</button>
              <button onClick={downloadAllCSV} className="px-4 py-2 border rounded">Download CSV (all)</button>
            </div>

            {loadingData && <div className="text-sm text-gray-600">Loading data...</div>}

            {allData && allData.length > 0 && (
              <div className="overflow-auto max-h-96 border rounded">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      {Object.keys(allData[0]).map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allData.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {Object.keys(allData[0]).map((h) => (
                          <td key={h} className="px-3 py-2 align-top">{(row[h] || '').toString()}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {allData && allData.length === 0 && <div className="text-sm text-gray-600">No registrations found.</div>}

            <div className="mt-4 text-xs text-gray-600">
              <strong>Apps Script export note:</strong> your Apps Script must implement `?action=export` and return JSON (see sample in Deployment section below).
            </div>
          </section>
        )}

        {/* Manager UI */}
        {!isAdmin && isLoggedIn && (
          <form onSubmit={submitWithDiagnostics}>
            <div className="grid grid-cols-3 gap-4 mb-4 items-end">
              <label className="flex flex-col">
                <span className="font-medium">Number of participants to create</span>
                <input type="number" min={1} max={MAX_PARTICIPANTS_PER_TEAM} value={slotsToCreate} onChange={(e) => setSlotsToCreate(Number(e.target.value))} className="mt-1 p-2 border rounded" />
              </label>

              <div className="flex gap-2">
                <button type="button" onClick={() => createSlots(slotsToCreate)} className="px-4 py-2 bg-green-600 text-white rounded-lg">Create slots</button>
                <button type="button" onClick={exportTeamSlotsCSV} className="px-4 py-2 border rounded-lg">Export CSV (current slots)</button>
              </div>
            </div>

            <div className="space-y-4">
              {participants.length === 0 && (
                <div className="p-4 border rounded-lg text-sm text-gray-600">No participant slots yet. Use the control above to create slots for your team and then fill details. All participants will be submitted together.</div>
              )}

              {participants.map((p, i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Participant {i + 1}</h3>
                  <div className="grid grid-cols-4 gap-3">
                    <input value={p.name} onChange={(e) => updateParticipant(i, 'name', e.target.value)} placeholder="Full name" className="p-2 border rounded" />
                    <select value={p.gender} onChange={(e) => updateParticipant(i, 'gender', e.target.value)} className="p-2 border rounded">
                      <option value="">Gender</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                    <input value={p.age} onChange={(e) => updateParticipant(i, 'age', e.target.value)} placeholder="Age" className="p-2 border rounded" />
                    <input value={p.designation} onChange={(e) => updateParticipant(i, 'designation', e.target.value)} placeholder="Designation / Role" className="p-2 border rounded" />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <input value={p.phone} onChange={(e) => updateParticipant(i, 'phone', e.target.value)} placeholder="Phone number" className="p-2 border rounded mb-2" />

                    <div>
                      <div className="text-sm font-medium mb-1">Choose sports (dropdowns) — females: up to 5, others: up to 3</div>
                      <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: (p.gender && p.gender.toLowerCase() === 'female') ? 5 : 3 }).map((_, si) => (
                          <select key={si} value={(p.sports && p.sports[si]) || ''} onChange={(e) => updateParticipantSport(i, si, e.target.value)} className="p-2 border rounded">
                            <option value="">Select sport {si + 1}</option>
                            {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button disabled={loading} type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg">{loading ? 'Submitting...' : `Submit all ${participants.length} participants`}</button>
            </div>
          </form>
        )}

        {message && (
          <div className={`mt-4 p-3 rounded ${message.type === 'error' ? 'bg-red-50 text-red-700' : message.type === 'info' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
            {message.text}
          </div>
        )}

        <section className="mt-6 text-sm text-gray-700">
          <h4 className="font-semibold">Deployment & Google Sheets linking (instructions)</h4>
          <ol className="list-decimal ml-5 mt-2 space-y-2">
            <li>Create a Google Sheet with headers: <code>team,teamNumber,timestamp,manager,name,gender,age,designation,phone,sports,category</code>.</li>
            <li>Open <strong>Extensions &gt; Apps Script</strong> in the sheet and paste the sample below. Deploy as Web App. Set <em>Who has access</em> to <strong>Anyone</strong> for simple testing.</li>
          </ol>

          <h4 className="font-semibold mt-4">Sample Apps Script (doPost + doGet?action=export)</h4>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">{`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById('${SAMPLE_SHEET_ID}'); // or SpreadsheetApp.getActive()
    var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
    var rows = [];
    data.participants.forEach(function(p){
      var sports = (p.sports || []).filter(Boolean).join('; ');
      var cat = '';
      try { cat = getCategory(p.gender, Number(p.age)); } catch(e) { cat = ''; }
      rows.push([data.team, data.teamNumber, data.timestamp, data.manager, p.name, p.gender, p.age, p.designation, p.phone, sports, cat]);
    });
    if (rows.length > 0) sheet.getRange(sheet.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
    return ContentService.createTextOutput(JSON.stringify({status: 'success', message: 'OK'})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === 'export') {
      var ss = SpreadsheetApp.openById('${SAMPLE_SHEET_ID}');
      var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
      var rows = sheet.getDataRange().getValues();
      var headers = rows.shift();
      var result = rows.map(function(r){
        var obj = {};
        headers.forEach(function(h, i){ obj[h] = r[i]; });
        return obj;
      });
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function getCategory(gender, age) {
  var g = (gender || '').toLowerCase();
  var a = Number(age) || 0;
  if (g === 'male') {
    if (a > 52) return 'Senior Veteran';
    if (a > 45) return 'Veteran';
    return 'Open';
  }
  if (g === 'female') {
    if (a > 40) return 'Veteran';
    return 'Open';
  }
  return 'Open';
}`}</pre>

          <p className="mt-4 text-xs text-gray-500">Deploy the Apps Script as a Web App and paste the generated web app URL into the <code>VITE_GOOGLE_SCRIPT_URL</code> variable in your .env and in Vercel settings.</p>
        </section>
      </div>
    </div>
  );
}
