import { useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from "codemirror";
import { jinja } from "@codemirror/lang-jinja";
import { 
  autocompletion, 
  CompletionContext, 
  type Completion, 
  type CompletionResult,
  startCompletion,
  closeCompletion
} from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap, hoverTooltip } from "@codemirror/view";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";

function getJinjaContext(doc: any, pos: number) {
  const lineStart = doc.lineAt(pos).from;
  const lineText = doc.sliceString(lineStart, pos);
  const afterText = doc.sliceString(pos, Math.min(pos + 50, doc.length));
  
  const incompleteMatch = lineText.match(/.*?(\{+)([%#]?)(\w*)$/);
  
  if (incompleteMatch) {
    const [fullMatch, braces, delimiter, word] = incompleteMatch;
    const matchStart = pos - fullMatch.length + fullMatch.lastIndexOf(braces);
    
    // Single { followed by letters = partial block
    if (braces === '{' && !delimiter && word) {
      return {
        type: 'partial',
        prefix: word,
        replaceStart: matchStart,
        replaceEnd: pos
      };
    }
    
    // Single { with no letters yet
    if (braces === '{' && !delimiter && !word) {
      return {
        type: 'partial',
        prefix: '',
        replaceStart: matchStart,
        replaceEnd: pos
      };
    }
  }
  
  // Check if we're inside a proper Jinja block
  const blockMatch = lineText.match(/.*?({%|{{|{#)\s*([^}%#]*)$/);
  if (blockMatch) {
    const delimiter = blockMatch[1];
    const content = blockMatch[2] || '';
    const hasClosing = afterText.match(/^\s*[^}]*?(%}|}|#)/);
    
    return {
      type: delimiter === '{%' ? 'statement' : delimiter === '{{' ? 'expression' : 'comment',
      prefix: content.trim(),
      hasClosing: !!hasClosing
    };
  }
  
  return { type: 'none', prefix: '' };
}

function createJinjaCompletions(templateVariables: any) {
  return function jinjaCompletions(context: CompletionContext): CompletionResult | null {
  const pos = context.pos;
  const doc = context.state.doc;
  const jinjaContext = getJinjaContext(doc, pos);
  
  // Don't complete in comments
  if (jinjaContext.type === 'comment') {
    return null;
  }
  
  const word = context.matchBefore(/\w+|[{%#]/);
  
  // Base Jinja block starters (only when not inside a block)
  const blockStarters: Completion[] = [];
  if (jinjaContext.type === 'none' || jinjaContext.type === 'partial') {
    blockStarters.push(
      { 
        label: "{{", 
        type: "keyword", 
        apply: (view, _completion, from, to) => {
          view.dispatch({
            changes: { from, to, insert: "{{ }}" },
            selection: { anchor: from + 3 }
          });
        },
        detail: "Expression" 
      },
      { 
        label: "{%", 
        type: "keyword", 
        apply: (view, _completion, from, to) => {
          view.dispatch({
            changes: { from, to, insert: "{% %}" },
            selection: { anchor: from + 3 }
          });
        },
        detail: "Statement" 
      },
      { 
        label: "{#", 
        type: "keyword", 
        apply: (view, _completion, from, to) => {
          view.dispatch({
            changes: { from, to, insert: "{# #}" },
            selection: { anchor: from + 3 }
          });
        },
        detail: "Comment" 
      }
    );
  }

  // Statement completions (for {% %} blocks)
  const statementCompletions: Completion[] = [
    { 
      label: "if", 
      type: "keyword", 
      apply: jinjaContext.hasClosing ? "if $0" : "if $0 %}\n  \n{% endif",
      detail: "Conditional statement"
    },
    { 
      label: "for", 
      type: "keyword", 
      apply: jinjaContext.hasClosing ? "for $0" : "for $0 in $1 %}\n  \n{% endfor",
      detail: "Loop statement"
    },
    { 
      label: "set", 
      type: "keyword", 
      apply: jinjaContext.hasClosing ? "set $0 = $1" : "set $0 = $1 %}",
      detail: "Variable assignment"
    },
    { 
      label: "block", 
      type: "keyword", 
      apply: jinjaContext.hasClosing ? "block $0" : "block $0 %}\n  \n{% endblock",
      detail: "Template block"
    },
    { 
      label: "extends", 
      type: "keyword", 
      apply: jinjaContext.hasClosing ? "extends '$0'" : "extends '$0' %}",
      detail: "Template inheritance"
    },
    { 
      label: "include", 
      type: "keyword", 
      apply: jinjaContext.hasClosing ? "include '$0'" : "include '$0' %}",
      detail: "Include template"
    },
    { 
      label: "macro", 
      type: "keyword", 
      apply: jinjaContext.hasClosing ? "macro $0()" : "macro $0() %}\n  \n{% endmacro",
      detail: "Macro definition"
    },
    { 
      label: "raw", 
      type: "keyword", 
      apply: jinjaContext.hasClosing ? "raw" : "raw %}\n$0\n{% endraw",
      detail: "Raw content block"
    },
    { 
      label: "with", 
      type: "keyword", 
      apply: jinjaContext.hasClosing ? "with $0" : "with $0 %}\n  \n{% endwith",
      detail: "Context block"
    },
    // End tags
    { label: "endif", type: "keyword", apply: "endif", detail: "End if" },
    { label: "endfor", type: "keyword", apply: "endfor", detail: "End for" },
    { label: "endblock", type: "keyword", apply: "endblock", detail: "End block" },
    { label: "endmacro", type: "keyword", apply: "endmacro", detail: "End macro" },
    { label: "endraw", type: "keyword", apply: "endraw", detail: "End raw" },
    { label: "endwith", type: "keyword", apply: "endwith", detail: "End with" },
  ];

  // Generate variables from template context
  const generateVariableCompletions = (obj: any, prefix: string = ''): Completion[] => {
    const completions: Completion[] = [];
    
    Object.entries(obj).forEach(([key, value]) => {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
      
      if (isObject) {
        // Add the object itself as a completion
        completions.push({
          label: key,
          type: "variable",
          apply: fullPath,
          detail: `Object with ${Object.keys(value).length} properties`
        });
        // Add nested completions
        completions.push(...generateVariableCompletions(value, fullPath));
      } else {
        completions.push({
          label: key,
          type: "variable", 
          apply: fullPath,
          detail: typeof value === 'string' ? value : Array.isArray(value) ? 'Array' : typeof value
        });
      }
    });
    
    return completions;
  };

  const variables: Completion[] = [
    ...generateVariableCompletions(templateVariables),
    { label: "loop", type: "variable", apply: "loop", detail: "Loop info (index, first, last)" },
    { label: "super", type: "function", apply: "super()", detail: "Parent block" },
  ];

  // Common Jinja filters (minijinja compatible)
  const filters: Completion[] = [
    { label: "default", type: "function", apply: "default($0)", detail: "Default value if undefined" },
    { label: "length", type: "function", apply: "length", detail: "Get length of sequence" },
    { label: "upper", type: "function", apply: "upper", detail: "Convert to uppercase" },
    { label: "lower", type: "function", apply: "lower", detail: "Convert to lowercase" },
    { label: "title", type: "function", apply: "title", detail: "Convert to title case" },
    { label: "capitalize", type: "function", apply: "capitalize", detail: "Capitalize first letter" },
    { label: "trim", type: "function", apply: "trim", detail: "Remove whitespace" },
    { label: "escape", type: "function", apply: "escape", detail: "HTML escape" },
    { label: "safe", type: "function", apply: "safe", detail: "Mark as safe HTML" },
    { label: "int", type: "function", apply: "int", detail: "Convert to integer" },
    { label: "float", type: "function", apply: "float", detail: "Convert to float" },
    { label: "string", type: "function", apply: "string", detail: "Convert to string" },
    { label: "list", type: "function", apply: "list", detail: "Convert to list" },
    { label: "abs", type: "function", apply: "abs", detail: "Absolute value" },
    { label: "round", type: "function", apply: "round", detail: "Round number" },
    { label: "max", type: "function", apply: "max", detail: "Maximum value" },
    { label: "min", type: "function", apply: "min", detail: "Minimum value" },
    { label: "sum", type: "function", apply: "sum", detail: "Sum values" },
    { label: "sort", type: "function", apply: "sort", detail: "Sort sequence" },
    { label: "reverse", type: "function", apply: "reverse", detail: "Reverse sequence" },
    { label: "join", type: "function", apply: "join('$0')", detail: "Join with separator" },
    { label: "split", type: "function", apply: "split('$0')", detail: "Split string" },
    { label: "replace", type: "function", apply: "replace('$0', '$1')", detail: "Replace substring" },
    { label: "truncate", type: "function", apply: "truncate($0)", detail: "Truncate text" },
    { label: "first", type: "function", apply: "first", detail: "First item" },
    { label: "last", type: "function", apply: "last", detail: "Last item" },
    { label: "unique", type: "function", apply: "unique", detail: "Remove duplicates" },
    { label: "reject", type: "function", apply: "reject($0)", detail: "Filter out items" },
    { label: "select", type: "function", apply: "select($0)", detail: "Filter items" },
    { label: "map", type: "function", apply: "map($0)", detail: "Apply function to items" },
  ];

  // Test functions (for use with 'is' keyword)
  const tests: Completion[] = [
    { label: "defined", type: "function", apply: "defined", detail: "Check if variable is defined" },
    { label: "undefined", type: "function", apply: "undefined", detail: "Check if variable is undefined" },
    { label: "none", type: "function", apply: "none", detail: "Check if value is None" },
    { label: "even", type: "function", apply: "even", detail: "Check if number is even" },
    { label: "odd", type: "function", apply: "odd", detail: "Check if number is odd" },
    { label: "string", type: "function", apply: "string", detail: "Check if value is string" },
    { label: "number", type: "function", apply: "number", detail: "Check if value is number" },
    { label: "sequence", type: "function", apply: "sequence", detail: "Check if value is sequence" },
    { label: "mapping", type: "function", apply: "mapping", detail: "Check if value is mapping" },
    { label: "iterable", type: "function", apply: "iterable", detail: "Check if value is iterable" },
  ];
  
  // Operators and keywords
  const operators: Completion[] = [
    { label: "and", type: "keyword", apply: "and", detail: "Logical AND" },
    { label: "or", type: "keyword", apply: "or", detail: "Logical OR" },
    { label: "not", type: "keyword", apply: "not", detail: "Logical NOT" },
    { label: "in", type: "keyword", apply: "in", detail: "Membership test" },
    { label: "is", type: "keyword", apply: "is", detail: "Identity test" },
    { label: "else", type: "keyword", apply: "else", detail: "Else clause" },
    { label: "elif", type: "keyword", apply: "elif $0", detail: "Else if clause" },
    { label: "true", type: "constant", apply: "true", detail: "Boolean true" },
    { label: "false", type: "constant", apply: "false", detail: "Boolean false" },
    { label: "none", type: "constant", apply: "none", detail: "Null value" },
  ];

  let allCompletions: Completion[] = [];
  
  // Add completions based on context
  if (jinjaContext.type === 'none' || jinjaContext.type === 'partial') {
    // Outside any Jinja blocks or partial blocks - suggest block starters
    allCompletions.push(...blockStarters);
  } else if (jinjaContext.type === 'statement') {
    // Inside {% %} - suggest statements, operators, variables, tests
    allCompletions.push(...statementCompletions, ...operators, ...variables, ...tests);
  } else if (jinjaContext.type === 'expression') {
    // Inside {{ }} - suggest variables, filters, operators
    allCompletions.push(...variables, ...filters, ...operators);
  }
  
  // Filter completions based on what user has typed
  const query = jinjaContext.prefix.toLowerCase();
  const filteredCompletions = allCompletions.filter(completion => 
    completion.label.toLowerCase().startsWith(query)
  );
  
  if (filteredCompletions.length === 0) {
    return null;
  }
  
  // Calculate the correct replacement range
  let replaceFrom = word ? word.from : pos;
  let replaceTo = pos;
  
  // For partial blocks, use the exact range we detected
  if (jinjaContext.type === 'partial' && jinjaContext.replaceStart !== undefined) {
    replaceFrom = jinjaContext.replaceStart;
    replaceTo = jinjaContext.replaceEnd || pos;
  }
  
  return {
    from: replaceFrom,
    to: replaceTo,
    options: filteredCompletions.slice(0, 20) // Limit to 20 items for performance
  };
  };
}

// Simple Jinja linter - only catch obvious syntax errors
function jinjaLinter(view: EditorView): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const doc = view.state.doc;
  const text = doc.toString();
  // Simpli check: to find blocks that are clearly malformed
  // Look for obvious syntax errors like mismatched delimiters
  const patterns = [
    // Wrong delimiter combinations like {{% or %}} 
    { regex: /{{%|%}}/g, message: "Mixed delimiter syntax" },
    { regex: /{{\s*%|%\s*}}/g, message: "Mixed delimiter syntax" },
    // Very basic unclosed check - only flag if line ends with just opening
    { regex: /^\s*{[%{#]\s*$/gm, message: "Incomplete block" }
  ];
  
  patterns.forEach(({ regex, message }) => {
    let match;
    while ((match = regex.exec(text)) !== null) {
      diagnostics.push({
        from: match.index,
        to: match.index + match[0].length,
        severity: 'error',
        message
      });
    }
  });
  
  return diagnostics;
}

// Hover provider for documentation
const jinjaHover = hoverTooltip((view, pos) => {
  const doc = view.state.doc;
  const context = getJinjaContext(doc, pos);
  
  if (context.type === 'none') return null;
  
  const word = doc.sliceString(Math.max(0, pos - 20), pos + 20).match(/\b\w+\b/);
  if (!word) return null;
  
  const filterDocs: Record<string, string> = {
    'default': 'Returns a default value if the variable is undefined',
    'length': 'Returns the length of a sequence or mapping',
    'upper': 'Converts a string to uppercase',
    'lower': 'Converts a string to lowercase',
    'title': 'Converts a string to title case',
    'join': 'Joins a sequence with a separator',
    'replace': 'Replaces occurrences of a substring',
    'truncate': 'Truncates a string to a given length',
  };
  
  const doc_text = filterDocs[word[0]];
  if (!doc_text) return null;
  
  return {
    pos,
    above: true,
    create: () => {
      const dom = document.createElement('div');
      dom.className = 'cm-tooltip-hover';
      dom.textContent = doc_text;
      return { dom };
    }
  };
});

function advanced() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [customVariables, setCustomVariables] = useState<any>({});
  const [showAddVariable, setShowAddVariable] = useState(false);
  const [newVariable, setNewVariable] = useState({ path: '', description: '', type: 'string' });

  useEffect(() => {
    if (!editorRef.current) return;
    
    // Combine built-in and custom variables for this effect
    const allVariables = { ...builtInVariables, ...customVariables };

    const view = new EditorView({
      parent: editorRef.current,
      doc: `# Should I buy BTC now?

## News Item

Time now: {{ system.time }}
Headline: {{ news.headline }}
Source: {{ news.source }}
Time: {{ news.published_at }}
Symbols mentioned: {% for s in news.symbols_mentioned %} {{ s.symbol }} {% endfor %}

{{ news.body }}

## Historical Context

{{ rollups["btc"].full }}

## Recent Headlines

{% for recent in recent_news["btc"] %}
- {{ recent.headline }}
{% endfor %}

## Instructions

{% include templates.instructions.4o %}`,
      extensions: [
        basicSetup,
        jinja(),
        oneDark,
        autocompletion({ 
          override: [createJinjaCompletions(allVariables)],
          maxRenderedOptions: 20,
          defaultKeymap: true
        }),
        linter(jinjaLinter),
        lintGutter(),
        jinjaHover,
        keymap.of([
          {
            key: "Ctrl-Space",
            run: startCompletion
          },
          {
            key: "Escape", 
            run: closeCompletion
          }
        ])
      ],
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [customVariables]); // Recreate editor when custom variables change

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

  // templateVariables is now calculated inside useEffect as allVariables

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
    current[pathParts[pathParts.length - 1]] = newVariable.description || newVariable.path;
    
    setCustomVariables(newVars);
    setNewVariable({ path: '', description: '', type: 'string' });
    setShowAddVariable(false);
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
  };

  const insertVariable = (varPath: string) => {
    if (viewRef.current) {
      const view = viewRef.current;
      const pos = view.state.selection.main.head;
      view.dispatch({
        changes: { from: pos, insert: `{{ ${varPath} }}` },
        selection: { anchor: pos + varPath.length + 6 }
      });
      view.focus();
    }
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
                onClick={() => insertVariable(fullPath)}
                className="flex-1 text-left px-2 py-1 text-green-300 hover:bg-gray-700 rounded text-sm transition-colors"
                title={typeof value === 'string' ? value : ''}
              >
                <span className="text-yellow-300">{key}</span>
                {Array.isArray(value) && <span className="text-gray-400 ml-1">[]</span>}
              </button>
              {isCustom && (
                <button
                  onClick={() => removeCustomVariable(fullPath)}
                  className="text-red-400 hover:text-red-300 ml-2 text-xs px-1"
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
    <div className="flex h-screen bg-gray-900">
      {/* Variables Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-600 flex flex-col">
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-white">Template Variables</h2>
            <button
              onClick={() => setShowAddVariable(!showAddVariable)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
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
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <input
                  type="text"
                  value={newVariable.description}
                  onChange={(e) => setNewVariable({...newVariable, description: e.target.value})}
                  placeholder="Description of this variable"
                  className="w-full px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addCustomVariable}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                >
                  Add Variable
                </button>
                <button
                  onClick={() => setShowAddVariable(false)}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
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
      
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-600">
          <h1 className="text-2xl font-bold text-white">Advanced Jinja Editor</h1>
          <p className="text-sm text-gray-400 mt-1">Write Jinja2 templates with intelligent autocomplete and variable references</p>
        </div>
        <div className="flex-1 p-4">
          <div
            ref={editorRef}
            className="w-full h-full border border-gray-600 rounded-lg shadow-lg"
          />
        </div>
      </div>
    </div>
  );
}

export default advanced;
