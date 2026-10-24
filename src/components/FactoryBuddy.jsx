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
    const [messageKey, setMessageKey] = useState('buddy_greeting');

    useEffect(() => {
        const timer = window.setTimeout(() => setGreetingVisible(false), 6000);
        return () => window.clearTimeout(timer);
    }, [replay]);

    const greet = () => {
        const choices = ['buddy_greeting', 'buddy_joke_alarm', 'buddy_joke_fridge', 'buddy_joke_power', 'buddy_joke_leftovers', 'buddy_joke_shower', 'buddy_joke_full_fridge', 'buddy_joke_directions', 'buddy_joke_storage', 'buddy_joke_bedtime_phone'].filter(key => key !== messageKey);
        setMessageKey(choices[Math.floor(Math.random() * choices.length)]);
        setGreetingVisible(true);
        setReplay(value => value + 1);
    };

    if (type === 'none') return null;
    return (
        <div className="factory-buddy relative shrink-0" data-testid="factory-buddy">
            <p className={`buddy-speech ${align === 'start' ? 'buddy-speech-start' : 'buddy-speech-end'} ${greetingVisible ? 'buddy-speech-visible' : ''}`} aria-live="polite" aria-atomic="true">
                {greetingVisible ? t(messageKey) : ''}
            </p>
            <button type="button" onClick={greet} aria-label={t('buddy_greet_pet', { pet: t(`pet_${type}`) })} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary active:bg-amber-100 dark:active:bg-slate-800">
<PetArtwork type={type} key={`${type}-${replay}`} />
            </button>
        </div>
    );
}
