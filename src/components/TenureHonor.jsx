import { useTranslation } from 'react-i18next';
import { employeeTenure } from '../utils/employeeTenure';
import './TenureHonor.css';
import { Badge } from './TenureMedal';

export default function TenureHonor({ hireDate, name, compact = false, now }) {
    const { t } = useTranslation();
    const tenure = employeeTenure(hireDate, now);
    // Reserve the same space while the private profile is loading, or if no
    // valid hire date is available, so the settings content never jumps.
    if (!tenure) return compact ? null : <div className="tenure-honor tenure-card">
        <div className="tenure-badge-placeholder" aria-hidden="true" />
        <div className="tenure-name">{name}</div>
        <div className="tenure-label" aria-hidden="true">&nbsp;</div>
        <div className="tenure-detail" aria-hidden="true">&nbsp;</div>
    </div>;
    const label = t(`honor_${tenure.tier}`);
    return <div className={`tenure-honor tenure-${tenure.tier} ${compact ? 'tenure-compact' : 'tenure-card'}`} title={t('honor_years', { count: tenure.years })}>
        <Badge tier={tenure.tier} small={compact} label={label}/>
        {compact ? <span className="sr-only">{label}</span> : <><div className="tenure-name">{name}</div><div className="tenure-label">{label}</div><div className="tenure-detail">{t('honor_years', { count: tenure.years })}</div></>}
    </div>;
}
