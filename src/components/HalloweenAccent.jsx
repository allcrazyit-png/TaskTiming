import './HalloweenAccent.css';

export function PumpkinAccent({ theme }) {
    if (theme === 'halloween') return <svg className="halloween-pumpkin" viewBox="0 0 48 44" aria-hidden="true"><path d="M24 12q-3-8 4-10" fill="none" stroke="#79936b" strokeWidth="4" strokeLinecap="round"/><path d="M24 13C9 5 1 19 5 32q4 12 19 8 15 4 19-8c4-13-4-27-19-19Z" fill="#efad66" stroke="#b77b4e" strokeWidth="1.6"/><ellipse cx="24" cy="26" rx="10" ry="15" fill="#f6bd7b" stroke="#d99657"/><g fill="#865c45"><circle cx="17" cy="25" r="2"/><circle cx="31" cy="25" r="2"/></g><path d="M20 31q4 4 8 0" fill="none" stroke="#865c45" strokeWidth="1.7" strokeLinecap="round"/></svg>;
    return <svg className="halloween-pumpkin" viewBox="0 0 48 44" aria-hidden="true">
        <g transform="rotate(-25 19 25)"><path d="M20 6C-2 16 4 34 20 36 36 28 34 13 20 6Z" fill="#c1855d"/><path d="M20 13v29m0-18-7-5m7 11 7-7" fill="none" stroke="#956244" strokeWidth="1.3" strokeLinecap="round"/></g>
        <g transform="rotate(28 32 28)"><path d="M32 15q-18 7-11 18 4 6 11 4 16-9 0-22Z" fill="#d9b16c"/><path d="M32 20v23m0-13-5-4" fill="none" stroke="#ad854b" strokeWidth="1.2" strokeLinecap="round"/></g>
    </svg>;
}

export default function HalloweenAccent({ theme, animated = true }) {
    if (theme === 'halloween') return <div className={`halloween-decoration ${animated ? '' : 'season-motion-off'}`} aria-hidden="true"><svg className="halloween-night-sky" viewBox="0 0 360 100" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="pumpkin-moon"><stop stopColor="#ffd69b"/><stop offset="1" stopColor="#e8a159"/></radialGradient></defs><circle cx="242" cy="16" r="23" fill="url(#pumpkin-moon)" opacity=".85"/><circle cx="252" cy="10" r="21" fill="#1b1527"/><g fill="#d6c5ec" opacity=".65"><path d="m191 12 1 4 4 1-4 1-1 4-1-4-4-1 4-1Z"/><circle cx="285" cy="30" r="1.2"/><circle cx="212" cy="48" r="1"/><circle cx="321" cy="15" r="1"/><circle cx="166" cy="32" r="1"/></g><g className="halloween-bats" fill="#090810" stroke="#9e7cb3" strokeWidth=".6"><path d="m272 47 5-7 3 4 3-4 5 7q8-9 14-9l-5 12-7 1-7 7-7-7-7-1-5-12q6 0 8 9Z"/><path d="m201 29 3-4 2 2 2-2 3 4q5-5 9-5l-4 7-4 1-4 4-4-4-4-1-4-7q4 0 5 5Z"/></g><path d="M0 96q45-10 90-1t90 0 90-1 90-4v10H0Z" fill="#6b406c" opacity=".25"/></svg><svg className="halloween-ghost" viewBox="0 0 48 56"><path d="M9 45V24C9 3 39 3 39 24v21l-7-4-8 5-8-5Z" fill="#fffdfa" stroke="#c7bdd5" strokeWidth="1.5"/><g fill="#80718e"><ellipse cx="19" cy="26" rx="2" ry="3"/><ellipse cx="30" cy="26" rx="2" ry="3"/></g><path d="M22 34q3 2 6-1" fill="none" stroke="#95839c" strokeWidth="1.5"/><g fill="#efd0ce"><ellipse cx="14" cy="33" rx="3" ry="1.7"/><ellipse cx="35" cy="33" rx="3" ry="1.7"/></g></svg></div>;
    return <div className={`halloween-decoration autumn-decoration ${animated ? '' : 'season-motion-off'}`} aria-hidden="true">
        <svg className="autumn-landscape" viewBox="0 0 360 100" preserveAspectRatio="xMidYMid slice">
            <circle cx="246" cy="17" r="35" fill="#edca91" opacity=".18"/><circle cx="246" cy="17" r="21" fill="#f6dcaa" opacity=".36"/>
            <g opacity=".38" transform="translate(334 8) rotate(22)"><path d="M0-20V35" stroke="#ac8056" fill="none"/><path d="M0-8q-24-19-22 0 6 12 22 12M0 7q22-23 23-5-1 15-23 17M0 21q-25-18-22 0 7 12 22 10" fill="#c89162"/></g>
            <g opacity=".28" transform="translate(348 81) rotate(-35)"><path d="M0-20V35" stroke="#ac8056" fill="none"/><path d="M0-8q-24-19-22 0 6 12 22 12M0 7q22-23 23-5-1 15-23 17M0 21q-25-18-22 0 7 12 22 10" fill="#d4ab66"/></g>
            <path d="M200 94q40-9 80-2t80-3v11H200Z" fill="#c99569" opacity=".13"/>
            <g fill="#c9985e" opacity=".42"><circle cx="204" cy="15" r="1"/><circle cx="289" cy="70" r="1.4"/><circle cx="225" cy="65" r="1"/></g>
        </svg>
        <svg className="autumn-maple" viewBox="0 0 48 52"><path d="m24 2 5 12 7-5-1 12 11 1-8 9 5 6-16 4-3 9-2-10L5 37l6-7-9-9 13 1-2-13 8 6Z" fill="#bc8059"/><path d="M24 14v35m0-18-10-9m10 13 10-10" fill="none" stroke="#966747" strokeWidth="1.3"/></svg>
        <svg className="halloween-ghost" viewBox="0 0 48 56">
        <path d="M24 39C13 41 0 30 4 14 10 5 17 7 24 13 31 7 38 5 44 14 48 30 35 41 24 39Z" fill="#dfbd78"/>
        <path d="M24 52V24M24 39 9 17m15 22 15-22M24 39l-6-24m6 24 6-24" fill="none" stroke="#b89a60" strokeWidth="1.2" strokeLinecap="round" opacity=".8"/>
    </svg></div>;
}
