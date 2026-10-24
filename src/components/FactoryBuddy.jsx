import PetArtwork from './PetArtwork';
import useBuddyPreference from '../hooks/useBuddyPreference';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './FactoryBuddy.css';

export default function FactoryBuddy({ align = 'end', employeeId }) {
    const { t } = useTranslation();
    const [type] = useBuddyPreference(employeeId);
    const [replay, setReplay] = useState(0);
    const [greetingVisible, setGreetingVisible] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setGreetingVisible(false), 2500);
        return () => window.clearTimeout(timer);
    }, [replay]);

    const greet = () => {
        setGreetingVisible(true);
        setReplay(value => value + 1);
    };

    if (type === 'none') return null;
    return (
        <div className="factory-buddy relative shrink-0" data-testid="factory-buddy">
            <p className={`pointer-events-none absolute ${align === 'start' ? 'left-0' : 'right-0'} top-full z-40 mt-1 w-56 rounded-2xl bg-white px-3 py-2 text-base font-bold text-slate-700 shadow-md dark:bg-slate-800 dark:text-slate-200 transition-opacity motion-reduce:transition-none ${greetingVisible ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
                {greetingVisible ? t('buddy_greeting') : ''}
            </p>
            <button type="button" onClick={greet} aria-label={t('buddy_greet_pet', { pet: t(`pet_${type}`) })} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary active:bg-amber-100 dark:active:bg-slate-800">
<PetArtwork type={type} key={`${type}-${replay}`} />
            </button>
        </div>
    );
}
