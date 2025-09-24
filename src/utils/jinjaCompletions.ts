import { CompletionContext, type CompletionResult, type CompletionSource } from "@codemirror/autocomplete";
import type { JinjaContext, Completion } from "../types/editor.types";
import { statementCompletions, filters, tests, operators, builtInVariables } from "../constants/jinjaTemplates";

export function getJinjaContext(doc: any, pos: number): JinjaContext {
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

// Generate variables from template context
export function generateVariableCompletions(obj: any, prefix: string = '', currentPath: string = ''): Completion[] {
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
}

export function getPropertyCompletions(obj: any, objectPath: string): Completion[] {
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
}

export function createJinjaCompletions(templateVariables: any): CompletionSource {
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

    const variables: Completion[] = [
      ...generateVariableCompletions(templateVariables),
      ...builtInVariables
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
      const propertyCompletions = getPropertyCompletions(templateVariables, jinjaContext.objectPath!);
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