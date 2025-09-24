import { hoverTooltip } from "@codemirror/view";
import { getJinjaContext } from "./jinjaCompletions";
import { filterDocs } from "../constants/jinjaTemplates";

// Hover provider for documentation
export const jinjaHover = hoverTooltip((view, pos) => {
  const doc = view.state.doc;
  const context = getJinjaContext(doc, pos);
  
  if (context.type === 'none') return null;
  
  const word = doc.sliceString(Math.max(0, pos - 20), pos + 20).match(/\b\w+\b/);
  if (!word) return null;
  
  const docText = filterDocs[word[0]];
  if (!docText) return null;
  
  return {
    pos,
    above: true,
    create: () => {
      const dom = document.createElement('div');
      dom.className = 'cm-tooltip-hover';
      dom.textContent = docText;
      return { dom };
    }
  };
});