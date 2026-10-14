import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function ProductImagePreview({ src, name, onClose }) {
    const { t } = useTranslation();
    const dialogRef = useRef(null);
    useEffect(() => {
        const dialog = dialogRef.current;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.showModal();
        return () => {
            dialog.close();
            document.body.style.overflow = previousOverflow;
        };
    }, []);
    return (
                <dialog
                    ref={dialogRef}
                    aria-labelledby="product-photo-title"
                    className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-5xl max-h-[90dvh] rounded-2xl bg-white p-4 text-slate-900 shadow-2xl backdrop:bg-black/80 dark:bg-slate-900 dark:text-white"
                    onCancel={() => onClose()}
                    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
                >
                    <div className="mb-3 flex items-center justify-between gap-4">
                        <h2 id="product-photo-title" className="text-xl font-bold">{name}</h2>
                        <button type="button" autoFocus onClick={() => onClose()} className="min-h-16 min-w-16 shrink-0 rounded-xl bg-slate-100 px-4 text-lg font-bold dark:bg-slate-800">
                            {t('close_photo')}
                        </button>
                    </div>
                    <img src={src} alt={name} className="max-h-[70dvh] w-full object-contain" />
                </dialog>
    );
}
