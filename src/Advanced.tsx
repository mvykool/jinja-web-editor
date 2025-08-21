import { useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from "codemirror";
import { jinja } from "@codemirror/lang-jinja";
import { 
  autocompletion, 
  CompletionContext, 
  type Completion, 
  type CompletionResult,
  type CompletionSource,
  startCompletion,
  closeCompletion
} from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap, hoverTooltip } from "@codemirror/view";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { DEFAULT_CODE } from './constants/template';
import VariableSidebar from './components/VariablesSidebar';

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
    
    // Check for dot notation (object.property)  
    const dotNotationMatch = content.match(/(\w+(?:\.\w+)*)\.\s*$|(\w+(?:\.\w+)*)\.(\w*)$/);
    if (dotNotationMatch && delimiter === '{{') {
      const [, fullPathWithDot, fullPath, partialProperty] = dotNotationMatch;
      const objectPath = fullPathWithDot || fullPath;
      
      return {
        type: 'property_access',
        objectPath: objectPath,
        prefix: partialProperty || '',
        hasClosing: !!hasClosing
      };
    }
    
    return {
      type: delimiter === '{%' ? 'statement' : delimiter === '{{' ? 'expression' : 'comment',
      prefix: content.trim(),
      hasClosing: !!hasClosing
    };
  }
  
  return { type: 'none', prefix: '' };
}

function createJinjaCompletions(templateVariables: any): CompletionSource {
  return function jinjaCompletions(context: CompletionContext): CompletionResult | null {
  const pos = context.pos;
  const doc = context.state.doc;
  const jinjaContext = getJinjaContext(doc, pos);
  
  // Don't complete in comments
  if (jinjaContext.type === 'comment') {
    return null;
  }
  
  const word = context.matchBefore(/\w+|[{%#]|[\w.]+/);
  
  // Check if the user just typed a dot - if so, force completion
  const charBefore = pos > 0 ? doc.sliceString(pos - 1, pos) : '';
  const explicitDotTrigger = charBefore === '.';
  
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
  const generateVariableCompletions = (obj: any, prefix: string = '', currentPath: string = ''): Completion[] => {
    const completions: Completion[] = [];
    
    Object.entries(obj).forEach(([key, value]) => {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
      
      // If we're looking for completions after a dot (like "news."), only return direct properties
      if (currentPath) {
        if (fullPath.startsWith(currentPath + '.') && fullPath.split('.').length === currentPath.split('.').length + 1) {
          completions.push({
            label: key,
            type: isObject ? "variable" : "property",
            apply: key, // Just apply the property name, not the full path
            detail: typeof value === 'string' ? value : isObject ? `Object with ${Object.keys(value).length} properties` : Array.isArray(value) ? 'Array' : typeof value
          });
        }
      } else {
        // Regular completions
        if (isObject) {
          // Add the object itself as a completion
          completions.push({
            label: key,
            type: "variable",
            apply: fullPath,
            detail: `Object with ${Object.keys(value).length} properties`
          });
          // Add nested completions
          completions.push(...generateVariableCompletions(value, fullPath, currentPath));
        } else {
          completions.push({
            label: key,
            type: "variable", 
            apply: fullPath,
            detail: typeof value === 'string' ? value : Array.isArray(value) ? 'Array' : typeof value
          });
        }
      }
    });
    
    return completions;
  };

  // Get property completions for a specific object path
  const getPropertyCompletions = (obj: any, objectPath: string): Completion[] => {
    const pathParts = objectPath.split('.');
    let current = obj;
    
    // Navigate to the object
    for (const part of pathParts) {
      if (current && typeof current === 'object' && current[part]) {
        current = current[part];
      } else {
        return []; // Path doesn't exist
      }
    }
    
    // Return properties of the current object
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return Object.entries(current).map(([key, value]) => ({
        label: key,
        type: typeof value === 'object' && value !== null && !Array.isArray(value) ? "variable" : "property",
        apply: key,
        detail: typeof value === 'string' ? value : typeof value === 'object' && value !== null && !Array.isArray(value) ? `Object with ${Object.keys(value).length} properties` : Array.isArray(value) ? 'Array' : typeof value
      }));
    }
    
    return [];
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
  } else if (jinjaContext.type === 'property_access') {
    // After dot notation like "news." - suggest properties of that object
    const propertyCompletions = getPropertyCompletions(templateVariables, jinjaContext.objectPath);
    allCompletions.push(...propertyCompletions);
  } else if (explicitDotTrigger && jinjaContext.type === 'expression') {
    // Handle case where user just typed a dot but context detection missed it
    const beforeDot = doc.sliceString(Math.max(0, pos - 50), pos - 1);
    const dotMatch = beforeDot.match(/{{[^}]*?(\w+(?:\.\w+)*)$/);
    if (dotMatch) {
      const objectPath = dotMatch[1];
      const propertyCompletions = getPropertyCompletions(templateVariables, objectPath);
      allCompletions.push(...propertyCompletions);
    }
  }
  
  // Filter completions based on what user has typed
  const query = jinjaContext.prefix.toLowerCase();
  const filteredCompletions = allCompletions.filter(completion => 
    completion.label.toLowerCase().startsWith(query)
  );
  
  if (filteredCompletions.length === 0 && !explicitDotTrigger) {
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
    options: filteredCompletions.slice(0, 20)
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

function Advanced() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [allVariables, setAllVariables] = useState<any>({});

  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      parent: editorRef.current,
      doc: DEFAULT_CODE,
      extensions: [
      EditorView.theme({
        "&": { height: "100%" }, 
        ".cm-scroller": { minHeight: "600px" },
        ".cm-focused": { outline: "none" },
        }),
        basicSetup,
        jinja(),
        oneDark,
        autocompletion({ 
          override: [createJinjaCompletions(allVariables)],
          maxRenderedOptions: 20,
          defaultKeymap: true,
          activateOnTyping: true,
          closeOnBlur: false
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
  }, [allVariables]);

  const handleVariablesChange = (variables: any) => {
    setAllVariables(variables);
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

  return (
    <div className="flex h-screen bg-gray-900">
      <VariableSidebar 
        onInsertVariable={insertVariable}
        onVariablesChange={handleVariablesChange}
      />
      
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-600">
          <h2 className="text-xl font-bold text-white">Advanced Jinja Editor</h2>
          <p className="text-sm text-gray-400 mt-1">Write Jinja2 templates with intelligent autocomplete and variable references</p>
        </div>
        <div className="flex-1">
          <div
            ref={editorRef}
            className="w-full h-full border border-gray-600 rounded-lg shadow-lg"
          />
        </div>
      </div>
    </div>
  );
}

export default Advanced;
