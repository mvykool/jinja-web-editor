import React, { useState, useEffect, useRef } from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import 'antd/dist/reset.css';
import '../styles/antd-overrides.css';

interface InlineFormProps {
  type: 'rollup' | 'for' | 'if' | 'variable' | 'filter' | 'similar_headlines';
  position: { top: number; left: number };
  onSubmit: (jinjaCode: string) => void;
  onCancel: () => void;
}

const InlineJinjaForm: React.FC<InlineFormProps> = ({
  type,
  position,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState<any>({});
  const formRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus first input when form appears
    if (firstInputRef.current) {
      firstInputRef.current.focus();
    }

    // Handle click outside to cancel
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Don't close if clicking on date picker dropdown elements
      if (target.closest('.ant-picker-dropdown') || 
          target.closest('.ant-picker-panel-container')) {
        return;
      }
      
      if (formRef.current && !formRef.current.contains(target)) {
        onCancel();
      }
    };

    // Handle escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const jinjaCode = generateJinjaCode();
    if (jinjaCode) {
      onSubmit(jinjaCode);
    }
  };

  const generateJinjaCode = (): string => {
    switch (type) {
      case 'rollup':
        return `{{ rollups["${formData.symbol || 'btc'}"].${formData.field || 'full'} }}`;
      
      case 'for':
        return `{% for ${formData.item || 'item'} in ${formData.collection || 'items'} %}\n  ${formData.content || '{{ item }}'}\n{% endfor %}`;
      
      case 'if':
        return `{% if ${formData.condition || 'condition'} %}\n  ${formData.content || 'true content'}\n{% endif %}`;
      
      case 'variable':
        return `{{ ${formData.path || 'variable'} }}`;
      
      case 'filter':
        return `{{ ${formData.variable || 'value'} | ${formData.filter || 'upper'} }}`;
      
      case 'similar_headlines':
        const threshold = formData.similarity_threshold || 0.8;
        const limit = formData.limit || 5;
        
        // Calculate lookback_days from date range if both dates are provided
        let lookbackDays = 7; // default
        if (formData.start_date && formData.end_date) {
          const start = dayjs(formData.start_date);
          const end = dayjs(formData.end_date);
          lookbackDays = end.diff(start, 'day') + 1; // +1 to include both dates
        } else if (formData.start_date) {
          // If only start date, calculate from start to today
          const start = dayjs(formData.start_date);
          const today = dayjs();
          lookbackDays = today.diff(start, 'day') + 1;
        } else if (formData.end_date) {
          // If only end date, use default 7 days back from end date
          lookbackDays = 7;
        }
        
        return `{{ similar_headlines(
  lookback_days=${lookbackDays},
  similarity_threshold=${threshold},
  limit=${limit}
) }}`;
      
      default:
        return '';
    }
  };

  const renderForm = () => {
    switch (type) {
      case 'rollup':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Symbol</label>
              <input
                ref={firstInputRef}
                type="text"
                value={formData.symbol || 'btc'}
                onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                placeholder="btc, eth, etc."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Field</label>
              <select
                value={formData.field || 'full'}
                onChange={(e) => setFormData({...formData, field: e.target.value})}
                className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
              >
                <option value="full">full</option>
                <option value="summary">summary</option>
                <option value="price">price</option>
                <option value="trend">trend</option>
              </select>
            </div>
          </div>
        );

      case 'for':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Item</label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={formData.item || 'item'}
                  onChange={(e) => setFormData({...formData, item: e.target.value})}
                  className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="item"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Collection</label>
                <input
                  type="text"
                  value={formData.collection || 'items'}
                  onChange={(e) => setFormData({...formData, collection: e.target.value})}
                  className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="items"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Content</label>
              <textarea
                value={formData.content || '{{ item }}'}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                rows={2}
                placeholder="{{ item }}"
              />
            </div>
          </div>
        );

      case 'if':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Condition</label>
              <input
                ref={firstInputRef}
                type="text"
                value={formData.condition || 'condition'}
                onChange={(e) => setFormData({...formData, condition: e.target.value})}
                className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                placeholder="variable == 'value'"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Content</label>
              <textarea
                value={formData.content || 'true content'}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                rows={2}
                placeholder="Content to show when condition is true"
              />
            </div>
          </div>
        );

      case 'variable':
        return (
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Variable Path</label>
            <input
              ref={firstInputRef}
              type="text"
              value={formData.path || 'variable'}
              onChange={(e) => setFormData({...formData, path: e.target.value})}
              className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
              placeholder="news.headline or user.name"
            />
          </div>
        );

      case 'filter':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Variable</label>
              <input
                ref={firstInputRef}
                type="text"
                value={formData.variable || 'value'}
                onChange={(e) => setFormData({...formData, variable: e.target.value})}
                className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                placeholder="variable name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Filter</label>
              <select
                value={formData.filter || 'upper'}
                onChange={(e) => setFormData({...formData, filter: e.target.value})}
                className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
              >
                <option value="upper">upper</option>
                <option value="lower">lower</option>
                <option value="title">title</option>
                <option value="default">default</option>
                <option value="length">length</option>
                <option value="truncate">truncate</option>
                <option value="safe">safe</option>
                <option value="escape">escape</option>
              </select>
            </div>
          </div>
        );

      case 'similar_headlines':
        return (
          <div className="space-y-3">
            {/* Date Range Selection for Lookback Calculation */}
            <div>
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Date Range 
                  <span className="text-gray-400 font-normal ml-1">(calculates lookback days)</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <DatePicker
                    value={formData.start_date ? dayjs(formData.start_date) : null}
                    onChange={(date) => setFormData({
                      ...formData, 
                      start_date: date ? date.format('YYYY-MM-DD') : null
                    })}
                    placeholder="From date"
                    className="w-full"
                    allowClear
                    size="small"
                    autoFocus={false}
                  />
                </div>
                <div>
                  <DatePicker
                    value={formData.end_date ? dayjs(formData.end_date) : null}
                    onChange={(date) => setFormData({
                      ...formData, 
                      end_date: date ? date.format('YYYY-MM-DD') : null
                    })}
                    placeholder="To date"
                    className="w-full"
                    allowClear
                    size="small"
                    autoFocus={false}
                  />
                </div>
              </div>
              {formData.start_date && formData.end_date && (
                <p className="text-xs text-blue-400 mt-1">
                  📅 {dayjs(formData.end_date).diff(dayjs(formData.start_date), 'day') + 1} days selected
                </p>
              )}
            </div>

            {/* Simple Input Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Limit</label>
                <input
                  ref={type === 'similar_headlines' ? firstInputRef : undefined}
                  type="number"
                  min="1"
                  max="100"
                  value={formData.limit || 5}
                  onChange={(e) => setFormData({...formData, limit: parseInt(e.target.value) || 5})}
                  className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Similarity Threshold</label>
                <input
                  type="number"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={formData.similarity_threshold || 0.8}
                  onChange={(e) => setFormData({...formData, similarity_threshold: parseFloat(e.target.value) || 0.8})}
                  className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="0.8"
                />
              </div>
            </div>

            <p className="text-xs text-gray-400">Similarity: 0.1 (loose) to 1.0 (exact match)</p>
          </div>
        );

      default:
        return null;
    }
  };

  const getFormTitle = () => {
    switch (type) {
      case 'rollup': return '📊 Create Rollup';
      case 'for': return '🔄 Create For Loop';
      case 'if': return '❓ Create If Statement';
      case 'variable': return '📝 Insert Variable';
      case 'filter': return '🔧 Apply Filter';
      case 'similar_headlines': return '🔍 Similar Headlines Query';
      default: return 'Form';
    }
  };

  return (
    <div
      ref={formRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-4"
      style={{
        top: position.top,
        left: position.left,
        width: type === 'similar_headlines' ? '420px' : '380px',
        maxWidth: '90vw'
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{getFormTitle()}</h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white text-lg leading-none"
          type="button"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {renderForm()}
        
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Insert Code
          </button>
        </div>
      </form>

      {/* Preview */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="text-xs text-gray-400 mb-1">Preview:</div>
        <pre className="text-xs text-green-400 bg-gray-900 p-2 rounded overflow-x-auto">
          {generateJinjaCode()}
        </pre>
      </div>
    </div>
  );
};

export default InlineJinjaForm;
