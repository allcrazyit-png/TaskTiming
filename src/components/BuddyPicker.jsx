import { useTranslation } from 'react-i18next';
import useBuddyPreference, { BUDDY_TYPES } from '../hooks/useBuddyPreference';
import PetArtwork from './PetArtwork';
import './FactoryBuddy.css';
export default function BuddyPicker({ employeeId }) {
    const { t } = useTranslation();
    const [choice, choose] = useBuddyPreference(employeeId);
    return <section className="space-y-3" aria-labelledby="buddy-picker-title">
        <h3 id="buddy-picker-title" className="text-base font-bold text-slate-800 dark:text-slate-100">{t('pet_title')}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('pet_local_hint')}</p>
        <div className="grid grid-cols-2 gap-3">{BUDDY_TYPES.map(type => <button key={type} type="button" aria-pressed={choice === type} onClick={() => choose(type)} className={`factory-buddy flex min-h-16 items-center gap-2 rounded-2xl border-2 p-3 text-base font-bold ${choice === type ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}>
            {type !== 'none' && <PetArtwork type={type} />}
            <span>{t(`pet_${type}`)}</span><span aria-hidden="true" className="ml-auto">{choice === type ? '✓' : ''}</span>
        </button>)}</div>
    </section>;
}
