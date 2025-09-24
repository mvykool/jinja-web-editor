import type { Completion } from "../types/editor.types";

// Statement completions (for {% %} blocks)
export const statementCompletions: Completion[] = [
  { 
    label: "if", 
    type: "keyword", 
    apply: "if $0",
    detail: "Conditional statement"
  },
  { 
    label: "for", 
    type: "keyword", 
    apply: "for $0 in $1",
    detail: "Loop statement"
  },
  { 
    label: "set", 
    type: "keyword", 
    apply: "set $0 = $1",
    detail: "Variable assignment"
  },
  { 
    label: "block", 
    type: "keyword", 
    apply: "block $0",
    detail: "Template block"
  },
  { 
    label: "extends", 
    type: "keyword", 
    apply: "extends '$0'",
    detail: "Template inheritance"
  },
  { 
    label: "include", 
    type: "keyword", 
    apply: "include '$0'",
    detail: "Include template"
  },
  { 
    label: "macro", 
    type: "keyword", 
    apply: "macro $0()",
    detail: "Macro definition"
  },
  { 
    label: "raw", 
    type: "keyword", 
    apply: "raw",
    detail: "Raw content block"
  },
  { 
    label: "with", 
    type: "keyword", 
    apply: "with $0",
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

// Common Jinja filters
export const filters: Completion[] = [
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

export const tests: Completion[] = [
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
export const operators: Completion[] = [
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

// Built-in variables
export const builtInVariables: Completion[] = [
  { label: "loop", type: "variable", apply: "loop", detail: "Loop info (index, first, last)" },
  { label: "super", type: "function", apply: "super()", detail: "Parent block" },
];

// Filter documentation for hover
export const filterDocs: Record<string, string> = {
  'default': 'Returns a default value if the variable is undefined',
  'length': 'Returns the length of a sequence or mapping',
  'upper': 'Converts a string to uppercase',
  'lower': 'Converts a string to lowercase',
  'title': 'Converts a string to title case',
  'join': 'Joins a sequence with a separator',
  'replace': 'Replaces occurrences of a substring',
  'truncate': 'Truncates a string to a given length',
};