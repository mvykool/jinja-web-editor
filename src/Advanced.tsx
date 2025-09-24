import { useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from "codemirror";
import { EditorSelection } from "@codemirror/state";
import { jinja } from "@codemirror/lang-jinja";
import { autocompletion, startCompletion, closeCompletion } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { linter, lintGutter } from "@codemirror/lint";
import { DEFAULT_CODE } from './constants/template';
import VariableSidebar from './components/VariablesSidebar';
import InlineJinjaForm from './components/InlineJinjaForm';
import CommandPalette from './components/CommandPalette';
import { createJinjaCompletions } from './utils/jinjaCompletions';
import { createJinjaLinter } from './utils/jinjaLinter';
import { jinjaHover } from './utils/jinjaHover';

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