import { useTranslation } from 'react-i18next';
import useHeaderTheme from '../hooks/useHeaderTheme';
export default function HeaderThemePicker() {
    const { t } = useTranslation();
    const { theme, animated, chooseTheme, chooseMotion } = useHeaderTheme();
    return <section className="space-y-3" aria-labelledby="header-theme-title"><h3 id="header-theme-title" className="text-base font-bold">{t('header_theme')}</h3><div className="grid grid-cols-1 gap-2">{['classic', 'autumn', 'halloween'].map(value => <button type="button" key={value} aria-pressed={theme === value} onClick={() => chooseTheme(value)} className={`min-h-16 rounded-xl border-2 px-4 text-left text-base font-bold ${theme === value ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-slate-700'}`}>{t(`header_theme_${value}`)}{theme === value && <span className="float-right" aria-hidden="true">✓</span>}</button>)}</div><label className="flex min-h-16 cursor-pointer items-center justify-between gap-3 text-base font-bold"><span>{t('header_theme_motion')}</span><input type="checkbox" checked={animated} onChange={e => chooseMotion(e.target.checked)} className="h-6 w-6 accent-primary"/></label></section>;
}
