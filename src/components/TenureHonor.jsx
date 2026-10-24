import { useTranslation } from 'react-i18next';
import { employeeTenure } from '../utils/employeeTenure';
import './TenureHonor.css';

export default function TenureHonor({ hireDate, name, compact = false, now }) {
    const { t } = useTranslation();
    const tenure = employeeTenure(hireDate, now);
    if (!tenure) return compact ? null : <div className="text-center font-bold text-slate-800 dark:text-white">{name}</div>;
    const label = t(`honor_${tenure.tier}`);
    return <div className={`tenure-honor tenure-${tenure.tier} ${compact ? 'tenure-compact' : 'tenure-card'}`} title={t('honor_years', { count: tenure.years })}>
        <svg viewBox="0 0 64 72" aria-hidden="true" className="tenure-medal">
            <path d="M17 39 12 68 31 58 51 68 46 39" fill="currentColor" opacity=".35" />
            <path d="m32 3 10 5 11 2 3 11 5 11-5 10-3 11-11 3-10 5-10-5-11-3-3-11-5-10 5-11 3-11 11-2Z" fill="currentColor" />
            <circle cx="32" cy="32" r="22" fill="white" opacity=".68" />
            {tenure.tier === 'diamond' ? <><path d="m18 27 8-9h12l8 9-14 19Z" fill="currentColor"/><path d="m18 27 28 0M26 18l6 28 6-28" fill="none" stroke="white" strokeWidth="1.5"/></> : <path d="m32 17 4.5 9 10 1.5-7.3 7 1.8 10-9-4.8-9 4.8 1.8-10-7.3-7 10-1.5Z" fill="currentColor" />}
        </svg>
        {compact ? <span className="sr-only">{label}</span> : <><div className="tenure-name">{name}</div><div className="tenure-label">{label}</div><div className="tenure-detail">{t('honor_years', { count: tenure.years })}</div></>}
    </div>;
}
