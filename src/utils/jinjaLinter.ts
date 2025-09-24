import { EditorView } from "codemirror";
import { type Diagnostic } from "@codemirror/lint";
import type { JinjaBlock, StackTag, TypoPattern, MixedDelimiterPattern, BracketPair } from "../types/editor.types";

export function createJinjaLinter(templateVariables: any) {
  return function jinjaLinter(view: EditorView): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const doc = view.state.doc;
    const text = doc.toString();
    
    // 1. Check for mixed delimiter syntax
    const mixedDelimiters: MixedDelimiterPattern[] = [
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
    const blocks: JinjaBlock[] = [];
    
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
    const tagStack: StackTag[] = [];
    
    const blockTags = ['if', 'for', 'block', 'macro', 'raw', 'with', 'filter', 'call', 'set', 'trans', 'autoescape'];
    const endTags = ['endif', 'endfor', 'endblock', 'endmacro', 'endraw', 'endwith', 'endfilter', 'endcall', 'endset', 'endtrans', 'endautoescape'];
    
    blocks.forEach(block => {
      if (block.type === 'statement') {
        const content = block.content;
        const words = content.split(/\s+/);
        const firstWord = words[0];
        
        // Check for typos in control keywords first
        const commonTypos: TypoPattern[] = [
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
      const pairs: BracketPair[] = [
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
