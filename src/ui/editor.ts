import type { EditorApi, Language } from "../engine/types";

// STUB (Card 3): a plain textarea standing in for CodeMirror 6, so main.ts can show code.
export function createEditor(parent: HTMLElement, initialCode = ""): EditorApi {
  const area = document.createElement("textarea");
  area.className = "editor-stub";
  area.spellcheck = false;
  area.value = initialCode;
  area.setAttribute("aria-label", "Code editor");
  parent.append(area);

  return {
    getCode: () => area.value,
    setCode: (code: string, _lang?: Language) => {
      area.value = code;
    },
    highlight: () => {},
    onChange: (cb) => area.addEventListener("input", () => cb(area.value)),
    setLanguage: () => {},
  };
}
