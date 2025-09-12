import React, { useState, useEffect, useRef } from 'react';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: string;
}

interface CommandPaletteProps {
  position: { top: number; left: number };
  onSelect: (commandId: string) => void;
  onCancel: () => void;
}

const COMMANDS: Command[] = [
  {
    id: 'rollup',
    label: 'Rollup',
    description: 'Insert a cryptocurrency rollup data block',
    icon: '📊'
  },
  {
    id: 'for',
    label: 'For Loop',
    description: 'Create a for loop to iterate over collections',
    icon: '🔄'
  },
  {
    id: 'if',
    label: 'If Statement',
    description: 'Add conditional logic to your template',
    icon: '❓'
  },
  {
    id: 'variable',
    label: 'Variable',
    description: 'Insert a template variable reference',
    icon: '📝'
  },
  {
    id: 'filter',
    label: 'Filter',
    description: 'Apply a filter to transform data',
    icon: '🔧'
  },
  {
    id: 'similar_headlines',
    label: 'Similar Headlines',
    description: 'Query for similar news headlines',
    icon: '🔍'
  }
];

const CommandPalette: React.FC<CommandPaletteProps> = ({
  position,
  onSelect,
  onCancel
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const paletteRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = COMMANDS.filter(command =>
    command.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    command.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    // Focus search input when palette appears
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }

    // Handle click outside to cancel
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (paletteRef.current && !paletteRef.current.contains(target)) {
        onCancel();
      }
    };

    // Handle keyboard navigation
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex].id);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filteredCommands, selectedIndex, onCancel, onSelect]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  return (
    <div
      ref={paletteRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        width: '320px',
        maxWidth: '90vw'
      }}
    >
      {/* Search Input */}
      <div className="p-3 border-b border-gray-700">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search commands..."
          className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Commands List */}
      <div className="max-h-64 overflow-y-auto">
        {filteredCommands.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            No commands found
          </div>
        ) : (
          filteredCommands.map((command, index) => (
            <div
              key={command.id}
              className={`p-3 cursor-pointer border-b border-gray-700 last:border-b-0 transition-colors ${
                index === selectedIndex 
                  ? 'bg-blue-600 text-white' 
                  : 'hover:bg-gray-700 text-gray-200'
              }`}
              onClick={() => onSelect(command.id)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">{command.icon}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{command.label}</div>
                  <div className={`text-xs mt-1 ${
                    index === selectedIndex ? 'text-blue-100' : 'text-gray-400'
                  }`}>
                    {command.description}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 bg-gray-900 border-t border-gray-700">
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Cancel</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;