/* eslint-disable @typescript-eslint/no-explicit-any -- we mutate a loosely typed ESTree in place; strict ESTree types add noise, not safety */
import { parse, parseExpressionAt } from "acorn";
import { generate } from "astring";
import type { Language } from "../engine/types";

// AST instrumentation (acorn + astring), per skills/execution-tracing:
// - `__s(line, [probes])` before every statement, and inside every loop test so each iteration is a step.
// - `__enter(name, line)` at function entry and `__exit()` in a `finally`, so depth survives early returns and throws.
// - `__v(() => expr)` probes read identifiers and simple index expressions; the runtime wraps each in its own try/catch.

export const C_SUBSET_ERROR = "Run mode supports a C-like subset. Try Play file.";
export const TS_ERROR =
  "Run mode runs plain JavaScript. Remove the TypeScript type annotations, or try Play file.";
export const UNSUPPORTED_ERROR =
  "Run mode supports JavaScript and a C-like subset (C, C++, Java). Try Play file.";

/** Thrown when code can't be prepared for Run mode; `message` is safe to show in the UI. */
export class InstrumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstrumentError";
  }
}

const C_LIKE: ReadonlySet<Language> = new Set(["c", "cpp", "java"]);
const RUNNABLE: ReadonlySet<Language> = new Set(["js", "ts", "c", "cpp", "java"]);
const MAX_PROBES = 8;
const IGNORED_IDS = new Set(["console", "undefined", "NaN", "Infinity", "arguments"]);

// Generated nodes have no source positions, so start/end/loc are optional.
type N = { type: string; start?: number; end?: number; loc?: any; [key: string]: any };

/** C/C++/Java → JS: typed declarations become `let`, print calls become the no-op `__print`. Keeps line numbers. */
export function rewriteCLike(source: string): string {
  return source
    .replace(/\b(int|float|double|char|long|short|bool|unsigned)\b(?=\s+[A-Za-z_])/g, "let")
    .replace(/\bSystem\s*\.\s*out\s*\.\s*print(?:ln|f)?\s*\(/g, "__print(")
    .replace(/\bprintf\s*\(/g, "__print(");
}

/** Returns instrumented JS for the Run-mode sandbox. Throws InstrumentError with a user-facing message. */
export function instrument(source: string, lang: Language): string {
  if (!RUNNABLE.has(lang)) throw new InstrumentError(UNSUPPORTED_ERROR);
  const code = C_LIKE.has(lang) ? rewriteCLike(source) : source;
  let program: N;
  try {
    program = parse(code, { ecmaVersion: "latest", sourceType: "script", locations: true }) as any;
  } catch (err) {
    if (C_LIKE.has(lang)) throw new InstrumentError(C_SUBSET_ERROR);
    if (lang === "ts") throw new InstrumentError(TS_ERROR);
    throw new InstrumentError(`SyntaxError: ${err instanceof Error ? err.message : String(err)}`);
  }
  new Instrumenter(code).visit(program);
  return generate(program as any);
}

class Instrumenter {
  constructor(private readonly code: string) {}

  visit(node: N, nameHint?: string): void {
    if (isFunction(node)) {
      this.instrumentFunction(node, nameHint);
      return;
    }
    switch (node.type) {
      case "Program":
      case "BlockStatement":
      case "StaticBlock":
        node.body = this.instrumentList(node.body);
        return;
      case "SwitchCase":
        if (node.test) this.visit(node.test);
        node.consequent = this.instrumentList(node.consequent);
        return;
      case "IfStatement":
        node.consequent = blockify(node.consequent);
        if (node.alternate) node.alternate = blockify(node.alternate);
        break;
      case "ForStatement":
      case "WhileStatement":
      case "DoWhileStatement":
      case "ForInStatement":
      case "ForOfStatement":
        this.instrumentLoop(node);
        return;
    }
    this.visitChildren(node);
  }

  private visitChildren(node: N): void {
    for (const key of Object.keys(node)) {
      if (key === "loc") continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) if (isNode(child)) this.visit(child, hintFor(node, child));
      } else if (isNode(value)) {
        this.visit(value, hintFor(node, value));
      }
    }
  }

  /** Puts a step before each statement. Probes are collected before children are rewritten. */
  private instrumentList(list: N[]): N[] {
    const out: N[] = [];
    for (const stmt of list) {
      const traced = isTracedStatement(stmt);
      const step = traced ? this.stepCall(line(stmt), headerParts(stmt)) : null;
      this.visit(stmt);
      if (step) out.push(exprStatement(step));
      out.push(stmt);
    }
    return out;
  }

  /** Loops step on every test evaluation (or every iteration for for-in/of), so iterations are audible. */
  private instrumentLoop(node: N): void {
    const step = this.stepCall(
      line(node.type === "DoWhileStatement" ? node.test : node),
      headerParts(node),
    );
    node.body = blockify(node.body);
    this.visitChildren(node);
    if (node.type === "ForInStatement" || node.type === "ForOfStatement") {
      node.body.body.unshift(exprStatement(step));
    } else {
      const test = node.test ?? { type: "Literal", value: true, raw: "true" };
      node.test = { type: "SequenceExpression", expressions: [step, test] };
    }
  }

  private instrumentFunction(fn: N, nameHint?: string): void {
    const name = fn.id?.name ?? nameHint ?? "anonymous";
    this.visit(fn.body);
    const body: N =
      fn.body.type === "BlockStatement"
        ? fn.body
        : { type: "BlockStatement", body: [{ type: "ReturnStatement", argument: fn.body }] };
    fn.expression = false;
    fn.body = {
      type: "BlockStatement",
      body: [
        exprStatement(expr(`__enter(${JSON.stringify(name)}, ${line(fn)})`)),
        {
          type: "TryStatement",
          block: body,
          handler: null,
          finalizer: { type: "BlockStatement", body: [exprStatement(expr("__exit()"))] },
        },
      ],
    };
  }

  private stepCall(lineNo: number, parts: (N | null | undefined)[]): N {
    const probes: string[] = [];
    for (const part of parts) if (part) this.collectProbes(part, probes);
    const list = probes.slice(0, MAX_PROBES).map((p) => `__v(() => (${p}))`);
    return expr(`__s(${lineNo}, [${list.join(", ")}])`);
  }

  /** Identifiers and simple `name[index]` reads, in source order. Never descends into functions. */
  private collectProbes(node: N, out: string[]): void {
    if (isFunction(node) || node.type === "ClassExpression") return;
    if (node.type === "Identifier") {
      addProbe(out, node.name, IGNORED_IDS.has(node.name) || node.name.startsWith("__"));
      return;
    }
    if (node.type === "MemberExpression") {
      if (node.computed && node.object.type === "Identifier" && isSideEffectFree(node.property)) {
        addProbe(out, this.code.slice(node.start, node.end), false);
      }
      this.collectProbes(node.object, out);
      if (node.computed) this.collectProbes(node.property, out);
      return;
    }
    if (node.type === "Property") {
      if (node.computed) this.collectProbes(node.key, out);
      this.collectProbes(node.value, out);
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === "loc") continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) if (isNode(child)) this.collectProbes(child, out);
      } else if (isNode(value)) {
        this.collectProbes(value, out);
      }
    }
  }
}

function addProbe(out: string[], text: string, skip: boolean): void {
  if (!skip && !out.includes(text)) out.push(text);
}

/** Index expressions safe to re-evaluate in a probe: names, literals and arithmetic on them. */
function isSideEffectFree(node: N): boolean {
  switch (node.type) {
    case "Identifier":
    case "Literal":
      return true;
    case "BinaryExpression":
      return isSideEffectFree(node.left) && isSideEffectFree(node.right);
    case "UnaryExpression":
      return node.operator !== "delete" && isSideEffectFree(node.argument);
    case "MemberExpression":
      return isSideEffectFree(node.object) && (!node.computed || isSideEffectFree(node.property));
    default:
      return false;
  }
}

/** The parts of a statement that belong to "its line": what we probe. */
function headerParts(stmt: N): (N | null | undefined)[] {
  switch (stmt.type) {
    case "ExpressionStatement":
      return [stmt.expression];
    case "VariableDeclaration":
      return [stmt];
    case "ReturnStatement":
    case "ThrowStatement":
      return [stmt.argument];
    case "IfStatement":
    case "WhileStatement":
    case "DoWhileStatement":
      return [stmt.test];
    case "SwitchStatement":
      return [stmt.discriminant];
    case "ForStatement":
      return [stmt.init, stmt.test, stmt.update];
    case "ForInStatement":
    case "ForOfStatement":
      return [stmt.left, stmt.right];
    default:
      return [];
  }
}

const UNTRACED = new Set([
  "FunctionDeclaration",
  "ClassDeclaration",
  "EmptyStatement",
  "BlockStatement",
  "LabeledStatement",
  // Loops trace themselves on each iteration.
  "ForStatement",
  "WhileStatement",
  "DoWhileStatement",
  "ForInStatement",
  "ForOfStatement",
]);

function isTracedStatement(stmt: N): boolean {
  if (UNTRACED.has(stmt.type)) return false;
  // Inserting a call before "use strict" would turn the directive into a plain string.
  return !(stmt.type === "ExpressionStatement" && typeof stmt.directive === "string");
}

function isFunction(node: N): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function isNode(value: unknown): value is N {
  return typeof value === "object" && value !== null && typeof (value as N).type === "string";
}

/** Names anonymous functions after the variable, property or method that holds them. */
function hintFor(parent: N, child: N): string | undefined {
  if (!isFunction(child)) return undefined;
  if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier")
    return parent.id.name;
  if (
    (parent.type === "Property" || parent.type === "MethodDefinition") &&
    parent.key.type === "Identifier"
  ) {
    return parent.key.name;
  }
  if (parent.type === "AssignmentExpression" && parent.left.type === "Identifier")
    return parent.left.name;
  return undefined;
}

function blockify(stmt: N): N {
  return stmt.type === "BlockStatement" ? stmt : { type: "BlockStatement", body: [stmt] };
}

function line(node: N): number {
  return node.loc?.start.line ?? 1;
}

function expr(code: string): N {
  return parseExpressionAt(code, 0, { ecmaVersion: "latest" }) as any;
}

function exprStatement(expression: N): N {
  return { type: "ExpressionStatement", expression };
}
