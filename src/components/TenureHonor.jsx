import { useTranslation } from 'react-i18next';
import { employeeTenure } from '../utils/employeeTenure';
import './TenureHonor.css';
import { Badge } from './TenureMedal';

export default function TenureHonor({ hireDate, name, compact = false, now }) {
    const { t } = useTranslation();
    const tenure = employeeTenure(hireDate, now);
    if (!tenure) return compact ? null : <div className="text-center font-bold text-slate-800 dark:text-white">{name}</div>;
    const label = t(`honor_${tenure.tier}`);
    return <div className={`tenure-honor tenure-${tenure.tier} ${compact ? 'tenure-compact' : 'tenure-card'}`} title={t('honor_years', { count: tenure.years })}>
        <Badge tier={tenure.tier} small={compact} label={label}/>
        {compact ? <span className="sr-only">{label}</span> : <><div className="tenure-name">{name}</div><div className="tenure-label">{label}</div><div className="tenure-detail">{t('honor_years', { count: tenure.years })}</div></>}
    </div>;
}
