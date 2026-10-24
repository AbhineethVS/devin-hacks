import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import {
  Compartment,
  EditorState,
  StateEffect,
  StateField,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  drawSelection,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { tokenize } from "../engine/tokenize";
import type { EditorApi, Language, Step, Token } from "../engine/types";

// CodeMirror 6 editor (Card 3). Playback highlight: a blue wash on the current line and a pink pill
// on the current token. Token positions come from our own tokenizer, so the pill lands on exactly
// the token the engine is playing.

type Highlight = Step["highlight"] | null;

const setHighlight = StateEffect.define<Highlight>();

const lineMark = Decoration.line({ class: "cm-play-line" });
const tokenMark = Decoration.mark({ class: "cm-play-token" });

function languageExtension(lang: Language): Extension {
  switch (lang) {
    case "js":
      return javascript();
    case "ts":
      return javascript({ typescript: true });
    case "python":
      return python();
    case "c":
    case "cpp":
    case "java":
    case "go":
    case "rust":
      return cpp(); // close enough for colouring C-family syntax
    default:
      return [];
  }
}

const theme = EditorView.theme(
  {
    "&": { height: "100%", backgroundColor: "transparent", color: "var(--text)" },
    ".cm-scroller": {
      fontFamily: "var(--mono)",
      fontSize: "17px",
      lineHeight: "1.65",
      fontVariantLigatures: "none",
    },
    ".cm-content": { padding: "20px 0", caretColor: "var(--accent)" },
    ".cm-line": { padding: "0 24px 0 12px", borderRadius: "4px" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
      color: "#4a5166",
      paddingLeft: "12px",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "rgb(47 107 255 / 0.35)",
    },
    ".cm-play-line": {
      backgroundColor: "rgb(47 107 255 / 0.16)",
      boxShadow: "inset 3px 0 0 var(--blue)",
    },
    ".cm-play-token": {
      backgroundColor: "var(--accent)",
      color: "#1a0710",
      borderRadius: "4px",
      boxShadow: "0 0 0 2px var(--accent), 0 0 18px rgb(255 77 141 / 0.65)",
    },
  },
  { dark: true },
);

const colours = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: "#ff7ab0" },
  { tag: [t.typeName, t.standard(t.typeName)], color: "#ffb86b" },
  { tag: [t.number, t.bool, t.null], color: "#f9d56e" },
  { tag: [t.string, t.special(t.string)], color: "#8be9a8" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#5c6478", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#7aa2ff" },
  { tag: [t.operator, t.compareOperator, t.updateOperator], color: "#9ad7ff" },
  { tag: [t.punctuation, t.bracket, t.separator], color: "#8a91a6" },
  { tag: [t.variableName, t.propertyName], color: "#e8eaf0" },
]);

export function createEditor(
  parent: HTMLElement,
  initialCode = "",
  lang: Language = "js",
): EditorApi {
  let currentLang = lang;
  let tokenCache: Token[][] | null = null;
  const changeListeners: ((code: string) => void)[] = [];
  const langSlot = new Compartment();

  const tokensFor = (code: string): Token[][] => (tokenCache ??= tokenize(code, currentLang));

  const highlightField = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(deco, tr) {
      for (const effect of tr.effects) {
        if (!effect.is(setHighlight)) continue;
        const h = effect.value;
        if (!h || h.line < 1 || h.line > tr.state.doc.lines) return Decoration.none;
        const line = tr.state.doc.line(h.line);
        const ranges = [lineMark.range(line.from)];
        const tok =
          h.token === undefined
            ? undefined
            : tokensFor(tr.state.doc.toString())[h.line - 1]?.[h.token];
        if (tok) {
          const from = Math.min(line.from + tok.col, line.to);
          const to = Math.min(from + tok.text.length, line.to);
          if (to > from) ranges.push(tokenMark.range(from, to));
        }
        return Decoration.set(ranges, true);
      }
      // Any edit clears the playback highlight (its positions would be stale).
      return tr.docChanged ? Decoration.none : deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initialCode,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        indentUnit.of("  "),
        EditorState.tabSize.of(2),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        syntaxHighlighting(colours),
        langSlot.of(languageExtension(lang)),
        highlightField,
        theme,
        EditorView.contentAttributes.of({ "aria-label": "Code editor", spellcheck: "false" }),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          tokenCache = null;
          const code = u.state.doc.toString();
          for (const cb of changeListeners) cb(code);
        }),
      ],
    }),
  });

  function setLanguage(next: Language): void {
    currentLang = next;
    tokenCache = null;
    view.dispatch({ effects: langSlot.reconfigure(languageExtension(next)) });
  }

  return {
    getCode: () => view.state.doc.toString(),
    setCode(code: string, nextLang?: Language) {
      if (nextLang) {
        currentLang = nextLang;
        view.dispatch({ effects: langSlot.reconfigure(languageExtension(nextLang)) });
      }
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
        effects: setHighlight.of(null),
      });
      tokenCache = null;
      view.scrollDOM.scrollTop = 0;
    },
    highlight(h: Highlight) {
      const effects: StateEffect<unknown>[] = [setHighlight.of(h)];
      if (h && h.line >= 1 && h.line <= view.state.doc.lines) {
        effects.push(EditorView.scrollIntoView(view.state.doc.line(h.line).from, { y: "nearest" }));
      }
      view.dispatch({ effects });
    },
    onChange: (cb) => {
      changeListeners.push(cb);
    },
    setLanguage,
  };
}
