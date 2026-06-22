import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ManualWork() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [workName, setWorkName] = useState('');
  const [error, setError] = useState('');

  const handleCancel = () => {
    navigate('/');
  };

  const handleStartWork = () => {
    if (!workName.trim()) {
      setError(t('manual_work_name_required'));
      return;
    }
    // 導航到 Input，傳遞空品番
    navigate('/input', {
      state: {
        productName: workName.trim(),
        partNumber: '', // 空品番表示非產品工作
        carModel: '',
        standardTime: 0,
        operator: localStorage.getItem('savedOperatorId') || '',
        productImage: null,
        category: ''
      }
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 p-4 text-large">
      {/* 標題區 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('manual_work_title')}
        </h1>
        <button
          onClick={handleCancel}
          className="bg-danger hover:bg-red-700 text-white rounded-full px-4 py-2 text-sm font-bold"
        >
          ✕ {t('cancel')}
        </button>
      </div>

      {/* 工作名稱輸入 */}
      <div className="mb-6">
        <label className="block text-lg font-bold text-slate-900 dark:text-white mb-2">
          {t('manual_work_name_label')} <span className="text-danger">*必填</span>
        </label>
        <input
          type="text"
          value={workName}
          onChange={(e) => {
            setWorkName(e.target.value);
            setError('');
          }}
          placeholder={t('manual_work_name_placeholder')}
          className={`w-full px-4 py-3 rounded-xl border-2 transition-colors text-lg ${
            error
              ? 'border-danger bg-red-50 dark:bg-red-900/20'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
          }`}
        />
        {error && <p className="text-danger text-sm mt-2 font-bold">{error}</p>}
      </div>

      {/* 開始記錄按鈕 */}
      <button
        onClick={handleStartWork}
        className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg transition-colors"
      >
        ▶ {t('manual_work_start')}
      </button>
    </div>
  );
}
