// Private data lives in this page's memory only. Never persist it to localStorage.
export function createEmployeeProfileCache({ fetchProfile, readSession, now = Date.now }) {
let cached = null;
let flight = null;
const TTL = 5 * 60 * 1000;

async function load(employeeId, force) {
  const session = readSession();
  if (!session || session.employeeId !== employeeId) {
    cached = null;
    throw new Error('Employee login required');
  }
  const key = `${employeeId}:${session.refreshToken}`;
  if (!force && cached?.key === key && now() - cached.time < TTL) return cached.data;
  if (flight?.key === key) return flight.promise;
  const promise = fetchProfile(employeeId).then(data => {
    const current = readSession();
    if (current?.employeeId === employeeId) cached = { key: `${employeeId}:${current.refreshToken}`, data, time: now() };
    return data;
  });
  flight = { key, promise };
  try { return await promise; } finally { if (flight?.promise === promise) flight = null; }
}

return { load, clear: () => { cached = null; } };
}
