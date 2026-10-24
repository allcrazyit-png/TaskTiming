import { useTranslation } from 'react-i18next';

export default function EmployeeProfile({ profile }) {
    const { t } = useTranslation();
    const result = profile;
    const retry = profile.refresh;
    const fields = [
        ['profile_gender', '性別'],
        ['profile_nationality', '國籍'],
        ['profile_hire_date', '到職日'],
    ];
    const displayValue = (field, value) => {
        if (!value || value === '未填') return t('profile_empty');
        if (field === '性別') return value === '男' ? t('profile_male') : value === '女' ? t('profile_female') : value;
        if (field === '國籍') {
            const key = { 台灣: 'profile_taiwan', 越南: 'profile_vietnam', 印尼: 'profile_indonesia', 其他: 'profile_other' }[value];
            return key ? t(key) : value;
        }
        return value;
    };

    return (
        <section className="space-y-3" aria-labelledby="employee-profile-title">
            <h3 id="employee-profile-title" className="text-base font-bold text-slate-700 dark:text-slate-200">{t('profile_title')}</h3>
            {result.status === 'loading' && <p role="status" className="text-base text-slate-500 dark:text-slate-400">{t('profile_loading')}</p>}
            {result.status === 'error' && (
                <div className="space-y-2">
                    <p role="status" className="text-base text-slate-500 dark:text-slate-400">{t(result.loginRequired ? 'honor_login_required' : 'profile_unavailable')}</p>
                    <button type="button" onClick={retry} className="min-h-16 rounded-xl border border-slate-300 px-4 text-base font-bold text-primary dark:border-slate-600">{t('profile_retry')}</button>
                </div>
            )}
            {result.status === 'ready' && (
                <dl className="space-y-3">
                    {fields.map(([label, field]) => (
                        <div key={field} className="flex justify-between gap-4 text-base">
                            <dt className="shrink-0 text-slate-500 dark:text-slate-400">{t(label)}</dt>
                            <dd className="break-words text-right font-bold text-slate-800 dark:text-slate-100">{displayValue(field, result.data?.[field])}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {result.status === 'ready' && <button type="button" onClick={retry} className="min-h-16 px-4 rounded-xl border border-slate-300 text-base font-bold text-primary dark:border-slate-600">{t('honor_refresh')}</button>}
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('profile_master_hint')}</p>
        </section>
    );
}
