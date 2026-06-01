import cds from "@sap/cds";

const LOG = cds.log("email:condition");

type RefToken = { ref: string[] };
type ValToken = { val: unknown };
type XprToken = { xpr: Token[] };
type ListToken = { list: ValToken[] };
export type Token = RefToken | ValToken | XprToken | ListToken | string;

/** A parsed CDS condition expression (the `xpr` form of `cds.parse.expr`). */
export type ConditionAst = { xpr: Token[] };

function isRef(token: Token): token is RefToken {
  return typeof token === "object" && "ref" in token;
}

function isVal(token: Token): token is ValToken {
  return typeof token === "object" && "val" in token;
}

function isXpr(token: Token): token is XprToken {
  return typeof token === "object" && "xpr" in token;
}

function isList(token: Token): token is ListToken {
  return typeof token === "object" && "list" in token;
}

/**
 * Resolves a token to its runtime value using entity data.
 */
function resolve(token: Token, data: Record<string, unknown>): unknown {
  if (isRef(token)) return data[token.ref[0]];
  if (isVal(token)) return token.val;
  return undefined;
}

/**
 * Splits a token array by a logical operator ('and' | 'or'),
 * skipping 'and' tokens that are part of 'between...and' syntax.
 */
function splitByLogicalOp(tokens: Token[], op: "and" | "or"): Token[][] {
  const groups: Token[][] = [];
  let current: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === op) {
      // Skip 'and' that belongs to 'between...and'
      if (op === "and" && i >= 2 && tokens[i - 2] === "between") {
        current.push(token);
        continue;
      }
      groups.push(current);
      current = [];
    } else {
      current.push(token);
    }
  }
  groups.push(current);
  return groups;
}

/**
 * Evaluates a comparison group (no and/or) against entity data.
 */
function evaluateComparison(tokens: Token[], data: Record<string, unknown>): boolean {
  if (tokens.length === 0) return true;

  // Nested expression: {xpr: [...]}
  if (tokens.length === 1 && isXpr(tokens[0])) {
    return evaluateXpr(tokens[0].xpr, data);
  }

  // 'is null' / 'is not null': [ref, 'is', 'null'] or [ref, 'is', 'not', 'null']
  if (tokens.length >= 3 && tokens[1] === "is") {
    const left = resolve(tokens[0], data);
    if (tokens[2] === "not" && tokens[3] === "null") {
      return left !== null && left !== undefined;
    }
    if (tokens[2] === "null") {
      return left === null || left === undefined;
    }
  }

  // 'in' list: [ref, 'in', {list: [...]}]
  if (tokens.length === 3 && tokens[1] === "in" && isList(tokens[2])) {
    const left = resolve(tokens[0], data);
    const values = tokens[2].list.map((item) => item.val);
    return values.includes(left);
  }

  // 'between': [ref, 'between', val, 'and', val]
  if (tokens.length === 5 && tokens[1] === "between" && tokens[3] === "and") {
    const left = resolve(tokens[0], data);
    const low = resolve(tokens[2], data);
    const high = resolve(tokens[4], data);
    if (typeof left !== "number" || typeof low !== "number" || typeof high !== "number") {
      LOG.warn("BETWEEN requires numeric operands — skipping email");
      return false;
    }
    return left >= low && left <= high;
  }

  // Standard comparison: [left, op, right]
  if (tokens.length === 3 && typeof tokens[1] === "string") {
    const left = resolve(tokens[0], data);
    const right = resolve(tokens[2], data);
    return compareValues(left, tokens[1], right);
  }

  LOG.warn("Unsupported condition expression structure — skipping email");
  return false;
}

function isNumeric(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function compareValues(left: unknown, op: string, right: unknown): boolean {
  switch (op) {
    case "=":
    case "==":
      return left === right;
    case "!=":
    case "<>":
      return left !== right;
    case ">":
    case "<":
    case ">=":
    case "<=":
      if (!isNumeric(left) || !isNumeric(right)) {
        LOG.warn(`Operator '${op}' requires numeric operands (got ${typeof left}, ${typeof right}) — skipping email`);
        return false;
      }
      if (op === ">") return left > right;
      if (op === "<") return left < right;
      if (op === ">=") return left >= right;
      return left <= right;
    default:
      LOG.warn(`Unsupported operator '${op}' in condition — skipping email`);
      return false;
  }
}

/**
 * Evaluates a parsed CDS xpr array against entity data.
 * Handles and/or with proper precedence (and > or).
 */
function evaluateXpr(xpr: Token[], data: Record<string, unknown>): boolean {
  // Split by 'or' first (lowest precedence)
  const orGroups = splitByLogicalOp(xpr, "or");
  return orGroups.some((group) => {
    // Split by 'and' (higher precedence)
    const andGroups = splitByLogicalOp(group, "and");
    return andGroups.every((comp) => evaluateComparison(comp, data));
  });
}

/**
 * Parses and validates a CDS condition expression at startup.
 * Throws if the condition cannot be parsed — fail early and loud.
 * Returns the parsed AST so it can be cached and reused on every event,
 * or undefined when there is no condition (always send).
 */
export function validateCondition(condition: string | undefined, entityName: string): ConditionAst | undefined {
  if (!condition) return undefined;

  LOG.debug(`Validating condition for ${entityName}: '${condition}'`);

  try {
    const parsed = cds.parse.expr(condition) as Partial<ConditionAst>;
    return parsed?.xpr ? { xpr: parsed.xpr } : undefined;
  } catch (err) {
    throw new Error(
      `Invalid @email.condition on ${entityName}: '${condition}' — ${err instanceof Error ? err.message : err}`,
    );
  }
}

/**
 * Evaluates a pre-parsed CDS condition AST against entity data.
 * Returns true if the condition is met (email should be sent).
 * Returns true if no condition is set (always send).
 * Returns false if the condition is not met (skip email).
 */
export function evaluateCondition(ast: ConditionAst | undefined, data: Record<string, unknown>): boolean {
  if (!ast?.xpr) return true;

  const result = evaluateXpr(ast.xpr, data);
  LOG.debug(`Condition evaluated to ${result}`);
  return result;
}
