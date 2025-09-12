import { useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from "codemirror";
import { EditorSelection } from "@codemirror/state";
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
import InlineJinjaForm from './components/InlineJinjaForm';
import CommandPalette from './components/CommandPalette';

function getJinjaContext(doc: any, pos: number) {
  const lineStart = doc.lineAt(pos).from;
  const lineText = doc.sliceString(lineStart, pos);
  const afterText = doc.sliceString(pos, Math.min(pos + 50, doc.length));
  
  const incompleteMatch = lineText.match(/.*?(\{+)([%#]?)(\w*)$/);
  
  if (incompleteMatch) {
    const [fullMatch, braces, delimiter, word] = incompleteMatch;
    const matchStart = pos - fullMatch.length + fullMatch.lastIndexOf(braces);
    
    if (braces === '{' && !delimiter && word) {
      return {
        type: 'partial',
        prefix: word,
        replaceStart: matchStart,
        replaceEnd: pos
      };
    }
    
    if (braces === '{' && !delimiter && !word) {
      return {
        type: 'partial',
        prefix: '',
        replaceStart: matchStart,
        replaceEnd: pos
      };
    }
  }
  
  const blockMatch = lineText.match(/.*?({%|{{|{#)\s*([^}%#]*)$/);
  if (blockMatch) {
    const delimiter = blockMatch[1];
    const content = blockMatch[2] || '';
    const hasClosing = afterText.match(/^\s*[^}]*?(%}|}|#)/);
    
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
            apply: key,
            detail: typeof value === 'string' ? value : isObject ? `Object with ${Object.keys(value).length} properties` : Array.isArray(value) ? 'Array' : typeof value
          });
        }
      } else {
        if (isObject) {
          completions.push({
            label: key,
            type: "variable",
            apply: fullPath,
            detail: `Object with ${Object.keys(value).length} properties`
          });
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

  const getPropertyCompletions = (obj: any, objectPath: string): Completion[] => {
    const pathParts = objectPath.split('.');
    let current = obj;
    
    for (const part of pathParts) {
      if (current && typeof current === 'object' && current[part]) {
        current = current[part];
      } else {
        return []; 
      }
    }
    
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

  // Common jjinja filters 
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
    const propertyCompletions = getPropertyCompletions(templateVariables, jinjaContext.objectPath);
    allCompletions.push(...propertyCompletions);
  } else if (explicitDotTrigger && jinjaContext.type === 'expression') {
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
  
  let replaceFrom = word ? word.from : pos;
  let replaceTo = pos;
  
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

// Enhanced Jinja linter for comprehensive syntax error highlighting
function createJinjaLinter(templateVariables: any) {
  return function jinjaLinter(view: EditorView): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const doc = view.state.doc;
  const text = doc.toString();
  
  // Template variables are passed from the factory function
  
  // 1. Check for mixed delimiter syntax
  const mixedDelimiters = [
    { regex: /{{%|%}}/g, message: "Mixed delimiter syntax" },
    { regex: /{{\s*%|%\s*}}/g, message: "Mixed delimiter syntax" },
    { regex: /{#%|%#}/g, message: "Mixed delimiter syntax" },
    { regex: /{%#|#%}/g, message: "Mixed delimiter syntax" },
  ];
  
  mixedDelimiters.forEach(({ regex, message }) => {
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

  // 2. Parse all Jinja blocks and check for balanced delimiters
  const blocks: Array<{
    type: 'expression' | 'statement' | 'comment';
    start: number;
    end: number;
    content: string;
    opener: string;
    closer?: string;
  }> = [];
  
  const blockRegex = /({[%{#])(.*?)([%}#]}|$)/gs;
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    const [fullMatch, opener, content, closer] = match;
    const start = match.index;
    const end = start + fullMatch.length;
    
    // Check for incomplete blocks (missing closing delimiter)
    if (!closer || closer === '$') {
      diagnostics.push({
        from: start,
        to: end,
        severity: 'error',
        message: 'Unclosed block'
      });
      continue;
    }
    
    // Check for mismatched delimiters
    const expectedCloser = opener === '{{' ? '}}' : opener === '{%' ? '%}' : '#}';
    if (closer !== expectedCloser) {
      diagnostics.push({
        from: end - closer.length,
        to: end,
        severity: 'error',
        message: `Expected '${expectedCloser}' but found '${closer}'`
      });
      continue;
    }

    blocks.push({
      type: opener === '{{' ? 'expression' : opener === '{%' ? 'statement' : 'comment',
      start,
      end,
      content: content.trim(),
      opener,
      closer
    });
  }

  // 3. Check for balanced open/close tags
  const tagStack: Array<{
    tag: string;
    position: number;
    fullContent: string;
  }> = [];
  
  const blockTags = ['if', 'for', 'block', 'macro', 'raw', 'with', 'filter', 'call', 'set', 'trans', 'autoescape'];
  const endTags = ['endif', 'endfor', 'endblock', 'endmacro', 'endraw', 'endwith', 'endfilter', 'endcall', 'endset', 'endtrans', 'endautoescape'];
  
  blocks.forEach(block => {
    if (block.type === 'statement') {
      const content = block.content;
      const words = content.split(/\s+/);
      const firstWord = words[0];
      
      // Check for typos in control keywords first
      const commonTypos = [
        { typo: 'esle', correct: 'else' },
        { typo: 'esli', correct: 'elif' },
        { typo: 'fro', correct: 'for' },
        { typo: 'ofr', correct: 'for' },
        { typo: 'fi', correct: 'if' },
        { typo: 'endfi', correct: 'endif' },
        { typo: 'enffor', correct: 'endfor' },
        { typo: 'endofr', correct: 'endfor' },
        { typo: 'endfi', correct: 'endif' }
      ];
      
      commonTypos.forEach(({ typo, correct }) => {
        if (firstWord === typo) {
          const wordStart = block.start + block.opener.length + block.content.indexOf(typo);
          diagnostics.push({
            from: wordStart,
            to: wordStart + typo.length,
            severity: 'error',
            message: `Did you mean '${correct}'?`
          });
          return;
        }
      });
      
      // Check for opening tags
      if (blockTags.includes(firstWord)) {
        tagStack.push({
          tag: firstWord,
          position: block.start,
          fullContent: content
        });
      }
      // Check for closing tags
      else if (endTags.includes(firstWord)) {
        const expectedTag = firstWord.substring(3); // Remove 'end' prefix
        if (tagStack.length === 0) {
          diagnostics.push({
            from: block.start,
            to: block.end,
            severity: 'error',
            message: `Unexpected '${firstWord}' - no matching opening tag`
          });
        } else {
          const lastTag = tagStack[tagStack.length - 1];
          if (lastTag.tag !== expectedTag) {
            diagnostics.push({
              from: block.start,
              to: block.end,
              severity: 'error',
              message: `Expected 'end${lastTag.tag}' but found '${firstWord}'`
            });
          } else {
            tagStack.pop(); // Correctly matched, remove from stack
          }
        }
      }
      // Check for invalid end tags
      else if (firstWord.startsWith('end') && !endTags.includes(firstWord)) {
        const wordStart = block.start + block.opener.length + block.content.indexOf(firstWord);
        diagnostics.push({
          from: wordStart,
          to: wordStart + firstWord.length,
          severity: 'error',
          message: `Invalid end tag '${firstWord}'`
        });
      }
    }
  });
  
  // Report unclosed tags
  tagStack.forEach(unclosedTag => {
    diagnostics.push({
      from: unclosedTag.position,
      to: unclosedTag.position + unclosedTag.fullContent.length + 4, // +4 for {% %}
      severity: 'error',
      message: `Unclosed '${unclosedTag.tag}' tag - missing 'end${unclosedTag.tag}'`
    });
  });

  // 4. Check for malformed strings and parentheses
  blocks.forEach(block => {
    const content = block.content;
    const contentStart = block.start + block.opener.length;
    
    // Check for unmatched quotes
    const quotes = ['"', "'"];
    quotes.forEach(quote => {
      const quoteMatches = [...content.matchAll(new RegExp(quote, 'g'))];
      if (quoteMatches.length % 2 !== 0) {
        const lastQuotePos = quoteMatches[quoteMatches.length - 1].index!;
        diagnostics.push({
          from: contentStart + lastQuotePos,
          to: contentStart + lastQuotePos + 1,
          severity: 'error',
          message: `Unmatched ${quote} quote`
        });
      }
    });
    
    // Check for unmatched parentheses/brackets
    const pairs = [
      { open: '(', close: ')', name: 'parenthesis' },
      { open: '[', close: ']', name: 'bracket' },
      { open: '{', close: '}', name: 'brace' }
    ];
    
    pairs.forEach(({ open, close, name }) => {
      let depth = 0;
      let lastUnmatched = -1;
      
      for (let i = 0; i < content.length; i++) {
        if (content[i] === open) {
          depth++;
          if (depth === 1) lastUnmatched = i;
        } else if (content[i] === close) {
          depth--;
          if (depth < 0) {
            diagnostics.push({
              from: contentStart + i,
              to: contentStart + i + 1,
              severity: 'error',
              message: `Unexpected closing ${name}`
            });
            depth = 0; // Reset to continue checking
          }
        }
      }
      
      if (depth > 0) {
        diagnostics.push({
          from: contentStart + lastUnmatched,
          to: contentStart + lastUnmatched + 1,
          severity: 'error',
          message: `Unmatched opening ${name}`
        });
      }
    });
  });

  // 5. Check for undefined variables (basic check)
  const expressionBlocks = blocks.filter(b => b.type === 'expression');
  expressionBlocks.forEach(block => {
    const content = block.content;
    const baseExpression = content.split('|')[0].trim(); // Remove filters
    
    // Skip complex expressions, literals, and built-in variables
    if (baseExpression.includes('[') || baseExpression.includes('"') || baseExpression.includes("'") || 
        baseExpression.includes('(') || baseExpression.includes(' ') ||
        /^(\d+(\.\d+)?|true|false|none)$/i.test(baseExpression) ||
        ['loop', 'super'].includes(baseExpression.split('.')[0])) {
      return;
    }
    
    const varName = baseExpression.split('.')[0];
    
    // Check if variable exists in template variables
    if (varName && Object.keys(templateVariables).length > 0 && !templateVariables.hasOwnProperty(varName)) {
      const contentStart = block.start + block.opener.length;
      const varStart = content.indexOf(varName);
      diagnostics.push({
        from: contentStart + varStart,
        to: contentStart + varStart + varName.length,
        severity: 'error',
        message: `Undefined variable '${varName}'`
      });
    }
  });
  
  return diagnostics;
  };
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
  const [showInlineForm, setShowInlineForm] = useState<{
    type: 'rollup' | 'for' | 'if' | 'variable' | 'filter' | 'similar_headlines';
    position: { top: number; left: number };
    wordRange: { from: number; to: number };
  } | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState<{
    position: { top: number; left: number };
    wordRange: { from: number; to: number };
  } | null>(null);

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
        // Custom key handlers
        keymap.of([
          {
            key: ".",
            run: (view) => {
              view.dispatch(view.state.update(view.state.changeByRange(range => ({
                changes: {from: range.from, to: range.to, insert: "."},
                range: EditorSelection.range(range.from + 1, range.to + 1)
              }))));
              setTimeout(() => startCompletion(view), 50);
              return true;
            }
          },
          {
            key: "/",
            run: (view) => {
              const pos = view.state.selection.main.head;
              const line = view.state.doc.lineAt(pos);
              const lineText = view.state.doc.sliceString(line.from, pos);
              
              // Only trigger command palette if at start of line or after whitespace
              if (lineText.trim() === '') {
                const coords = view.coordsAtPos(pos);
                if (coords) {
                  setShowCommandPalette({
                    position: {
                      top: coords.bottom + 5,
                      left: coords.left
                    },
                    wordRange: { from: pos, to: pos }
                  });
                  return true; // Don't insert the /
                }
              }
              return false; // Let default / insertion happen
            }
          },
        ]),
        linter(createJinjaLinter(allVariables)),
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

  // Update linter when variables change
  useEffect(() => {
    if (viewRef.current) {
      // Force re-run of linter with new variables
      viewRef.current.dispatch({
        effects: []  // Empty effects to trigger a re-render
      });
    }
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


  const handleFormSubmit = (jinjaCode: string) => {
    if (viewRef.current && showInlineForm) {
      const view = viewRef.current;
      view.dispatch({
        changes: {
          from: showInlineForm.wordRange.from,
          to: showInlineForm.wordRange.to,
          insert: jinjaCode
        }
      });
      setShowInlineForm(null);
      view.focus();
    }
  };

  const handleFormCancel = () => {
    setShowInlineForm(null);
    if (viewRef.current) {
      viewRef.current.focus();
    }
  };

  const handleCommandSelect = (commandId: string) => {
    if (viewRef.current && showCommandPalette) {
      const view = viewRef.current;
      const coords = view.coordsAtPos(showCommandPalette.wordRange.from);
      
      if (coords) {
        setShowInlineForm({
          type: commandId as 'rollup' | 'for' | 'if' | 'variable' | 'filter' | 'similar_headlines',
          position: {
            top: coords.bottom + 5,
            left: coords.left
          },
          wordRange: showCommandPalette.wordRange
        });
      }
    }
    setShowCommandPalette(null);
  };

  const handleCommandCancel = () => {
    setShowCommandPalette(null);
    if (viewRef.current) {
      viewRef.current.focus();
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
          <p className="text-sm text-gray-400 mt-1">
            Write Jinja templates with variable references
            <span className="block text-xs text-blue-400 mt-1">
              💡 Type <kbd className="bg-gray-700 px-1 rounded">/</kbd> at the start of a line to open command palette
            </span>
          </p>
        </div>
        <div className="flex-1 relative">
          <div
            ref={editorRef}
            className="w-full h-full border border-gray-600 rounded-lg shadow-lg"
          />
          
          {/* Command Palette */}
          {showCommandPalette && (
            <CommandPalette
              position={showCommandPalette.position}
              onSelect={handleCommandSelect}
              onCancel={handleCommandCancel}
            />
          )}

          {/* Notion-style Inline Form */}
          {showInlineForm && (
            <InlineJinjaForm
              type={showInlineForm.type}
              position={showInlineForm.position}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default Advanced;
