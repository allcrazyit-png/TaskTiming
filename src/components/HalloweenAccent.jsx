import './HalloweenAccent.css';

export function PumpkinAccent({ theme }) {
    if (theme === 'halloween') return <svg className="halloween-pumpkin" viewBox="0 0 48 44" aria-hidden="true"><path d="M24 12q-3-8 4-10" fill="none" stroke="#79936b" strokeWidth="4" strokeLinecap="round"/><path d="M24 13C9 5 1 19 5 32q4 12 19 8 15 4 19-8c4-13-4-27-19-19Z" fill="#efad66" stroke="#b77b4e" strokeWidth="1.6"/><ellipse cx="24" cy="26" rx="10" ry="15" fill="#f6bd7b" stroke="#d99657"/><g fill="#865c45"><circle cx="17" cy="25" r="2"/><circle cx="31" cy="25" r="2"/></g><path d="M20 31q4 4 8 0" fill="none" stroke="#865c45" strokeWidth="1.7" strokeLinecap="round"/></svg>;
    return <svg className="halloween-pumpkin" viewBox="0 0 48 44" aria-hidden="true">
        <g transform="rotate(-25 19 25)"><path d="M20 6C-2 16 4 34 20 36 36 28 34 13 20 6Z" fill="#c1855d"/><path d="M20 13v29m0-18-7-5m7 11 7-7" fill="none" stroke="#956244" strokeWidth="1.3" strokeLinecap="round"/></g>
        <g transform="rotate(28 32 28)"><path d="M32 15q-18 7-11 18 4 6 11 4 16-9 0-22Z" fill="#d9b16c"/><path d="M32 20v23m0-13-5-4" fill="none" stroke="#ad854b" strokeWidth="1.2" strokeLinecap="round"/></g>
    </svg>;
}

export default function HalloweenAccent({ theme }) {
    if (theme === 'halloween') return <div className="halloween-decoration" aria-hidden="true"><svg className="halloween-ghost" viewBox="0 0 48 56"><path d="M9 45V24C9 3 39 3 39 24v21l-7-4-8 5-8-5Z" fill="#fffdfa" stroke="#c7bdd5" strokeWidth="1.5"/><g fill="#80718e"><ellipse cx="19" cy="26" rx="2" ry="3"/><ellipse cx="30" cy="26" rx="2" ry="3"/></g><path d="M22 34q3 2 6-1" fill="none" stroke="#95839c" strokeWidth="1.5"/><g fill="#efd0ce"><ellipse cx="14" cy="33" rx="3" ry="1.7"/><ellipse cx="35" cy="33" rx="3" ry="1.7"/></g></svg></div>;
    return <div className="halloween-decoration" aria-hidden="true"><svg className="halloween-ghost" viewBox="0 0 48 56">
        <path d="M24 39C13 41 0 30 4 14 10 5 17 7 24 13 31 7 38 5 44 14 48 30 35 41 24 39Z" fill="#dfbd78"/>
        <path d="M24 52V24M24 39 9 17m15 22 15-22M24 39l-6-24m6 24 6-24" fill="none" stroke="#b89a60" strokeWidth="1.2" strokeLinecap="round" opacity=".8"/>
    </svg></div>;
}
