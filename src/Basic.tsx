import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from "codemirror";
import { jinja } from "@codemirror/lang-jinja";

function Basic() {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      parent: editorRef.current,
      doc: `{% if user.active %}\n  {{ user.name }}\n{% endif %}`,
      extensions: [
        basicSetup,
        jinja(),
      ],
    });

    return () => {
      view.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <h1 className="text-2xl font-bold mb-4 text-white">CodeMirror Editor</h1>
      <div
        ref={editorRef}
        className="w-3/4 h-auto border border-gray-300 text-black rounded-md shadow bg-gray-200"
      />
    </div>
  );
}

export default Basic;
