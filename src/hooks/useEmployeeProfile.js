import { useEffect, useState } from 'react';
import { fetchTaskTimingEmployeeProfile, readTaskTimingSession } from '../services/taskTimingEmployees';

import { createEmployeeProfileCache } from '../services/employeeProfileCache';
const cache = createEmployeeProfileCache({ fetchProfile: fetchTaskTimingEmployeeProfile, readSession: readTaskTimingSession });

export default function useEmployeeProfile(employeeId, opened) {
  const [result, setResult] = useState({ id: '', status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!employeeId) cache.clear();
    if (employeeId) cache.load(employeeId, false).then(data => {
      if (active) setResult({ id: employeeId, status: 'ready', data });
    }).catch(error => {
      if (active) setResult({ id: employeeId, status: 'error', data: null, loginRequired: /login|expired|401|403|mismatch/i.test(error.message) });
    });
    return () => { active = false; };
  }, [employeeId, attempt, opened]);
  const refresh = () => {
    cache.clear();
    setResult({ id: employeeId, status: 'loading', data: null });
    setAttempt(value => value + 1);
  };
  return { ...(result.id === employeeId ? result : { status: 'loading', data: null }), refresh };
}
