import { useState } from 'react';

interface VariableSidebarProps {
  onInsertVariable: (varPath: string) => void;
  onVariablesChange: (variables: any) => void;
}

function VariableSidebar({ onInsertVariable, onVariablesChange }: VariableSidebarProps) {
  const [customVariables, setCustomVariables] = useState<any>({});
  const [showAddVariable, setShowAddVariable] = useState(false);
  const [newVariable, setNewVariable] = useState({ path: '', type: 'string' });

  // Built-in template variables
  const builtInVariables = {
    system: {
      time: 'Current timestamp',
      user: 'Current user info',
      environment: 'Runtime environment'
    },
    news: {
      headline: 'News article headline',
      source: 'News source name',
      published_at: 'Publication timestamp',
      symbols_mentioned: 'Array of financial symbols',
      body: 'Full article content'
    },
    rollups: {
      'btc': {
        full: 'Complete BTC analysis',
        summary: 'BTC summary data',
        price: 'Current BTC price'
      }
    },
    recent_news: {
      'btc': 'Array of recent BTC news items'
    },
    templates: {
      instructions: {
        '4o': 'GPT-4 instruction template'
      }
    }
  };

  // Add custom variable function
  const addCustomVariable = () => {
    if (!newVariable.path.trim()) return;
    
    const pathParts = newVariable.path.split('.');
    const newVars = { ...customVariables };
    
    // Create nested object structure
    let current = newVars;
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        current[pathParts[i]] = {};
      }
      current = current[pathParts[i]];
    }
    
    // Set the final value
    current[pathParts[pathParts.length - 1]] =  newVariable.path;
    
    setCustomVariables(newVars);
    setNewVariable({ path: '', type: 'string' });
    setShowAddVariable(false);
    
    // Notify parent component about variables change
    const allVariables = { ...builtInVariables, ...newVars };
    onVariablesChange(allVariables);
  };

  // Remove custom variable function
  const removeCustomVariable = (path: string) => {
    const pathParts = path.split('.');
    const newVars = { ...customVariables };
    
    if (pathParts.length === 1) {
      delete newVars[pathParts[0]];
    } else {
      // Navigate to parent and delete the key
      let current = newVars;
      for (let i = 0; i < pathParts.length - 1; i++) {
        current = current[pathParts[i]];
      }
      delete current[pathParts[pathParts.length - 1]];
    }
    
    setCustomVariables(newVars);
    
    // Notify parent component about variables change
    const allVariables = { ...builtInVariables, ...newVars };
    onVariablesChange(allVariables);
  };


  const renderVariables = (obj: any, prefix: string = '', level: number = 0, isCustom: boolean = false) => {
    return Object.entries(obj).map(([key, value]) => {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
      
      return (
        <div key={fullPath} className={`ml-${level * 4}`}>
          {isObject ? (
            <>
              <div className="flex items-center justify-between text-blue-300 font-semibold py-1 text-sm">
                <span>{key}</span>
                {isCustom && level === 0 && (
                  <button
                    onClick={() => removeCustomVariable(key)}
                    className="text-red-400 hover:text-red-300 ml-2 text-xs"
                    title="Remove custom variable"
                  >
                    ✕
                  </button>
                )}
              </div>
              {renderVariables(value, fullPath, level + 1, isCustom)}
            </>
          ) : (
            <div className="flex items-center justify-between">
              <button
                onClick={() => onInsertVariable(fullPath)}
                className="flex-1 text-left px-2 gap-2 py-1 text-green-300 hover:bg-gray-700 rounded text-sm transition-colors"
                title={typeof value === 'string' ? value : ''}
              >
                <span className="text-slate-200 bg-gray-900 p-2 rounded-sm flex">{key}</span>
                {Array.isArray(value) && <span className="text-gray-400 ml-1">[]</span>}
              </button>
              {isCustom && (
                <button
                  onClick={() => removeCustomVariable(fullPath)}
                  className="text-red-400 hover:text-red-300 ml-2 cursor-pointer text-xs px-1"
                  title="Remove custom variable"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-600 flex flex-col">
      <div className="p-4 border-b border-gray-600">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">Template Variables</h2>
          <button
            onClick={() => setShowAddVariable(!showAddVariable)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded cursor-pointer transition-colors"
          >
            + Add
          </button>
        </div>
        <p className="text-xs text-gray-400">Click to insert into template</p>
      </div>
      
      {/* Add Variable Form */}
      {showAddVariable && (
        <div className="p-4 bg-gray-750 border-b border-gray-600">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Variable Path</label>
              <input
                type="text"
                value={newVariable.path}
                onChange={(e) => setNewVariable({...newVariable, path: e.target.value})}
                placeholder="e.g., user.profile.name"
                className="w-full px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && addCustomVariable()}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={addCustomVariable}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors cursor-pointer"
              >
                Add Variable
              </button>
              <button
                onClick={() => setShowAddVariable(false)}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Built-in Variables */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Built-in Variables</h3>
          <div className="space-y-1">
            {renderVariables(builtInVariables, '', 0, false)}
          </div>
        </div>
        
        {/* Custom Variables */}
        {Object.keys(customVariables).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Custom Variables</h3>
            <div className="space-y-1">
              {renderVariables(customVariables, '', 0, true)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VariableSidebar;
