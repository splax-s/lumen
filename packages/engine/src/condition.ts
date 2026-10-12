import type { EventBus } from './events';

/**
 * `done_when` expressions, for example `count(dropped) >= 3 && has(dropped, 'ice')`.
 * Parsed by hand so lesson files can never run arbitrary code.
 */

export class ConditionError extends Error {
  readonly position: number;
  constructor(message: string, position: number) {
    super(`${message} (at ${position})`);
    this.name = 'ConditionError';
    this.position = position;
  }
}

type Value = number | string | boolean;
type CompareOp = '==' | '!=' | '<' | '<=' | '>' | '>=';

type Node =
  | { kind: 'literal'; value: Value }
  | { kind: 'state'; name: string }
  | { kind: 'count'; event: string }
  | { kind: 'has'; event: string; value: string | number }
  | { kind: 'event'; event: string }
  | { kind: 'not'; operand: Node }
  | { kind: 'and' | 'or'; left: Node; right: Node }
  | { kind: 'compare'; op: CompareOp; left: Node; right: Node };

export type Condition = { readonly source: string; readonly ast: Node };
export type ConditionContext = { bus: EventBus; state: Record<string, Value> };

type Token =
  | { type: 'number'; value: number; pos: number }
  | { type: 'string'; value: string; pos: number }
  | { type: 'ident'; value: string; pos: number }
  | { type: 'op'; value: string; pos: number }
  | { type: 'end'; pos: number };

const OPERATORS = ['&&', '||', '==', '!=', '<=', '>=', '<', '>', '!', '(', ')', ','];
const FUNCTIONS: Record<string, number> = { count: 1, has: 2, event: 1, state: 1 };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const start = i;
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      while (i < source.length && /[0-9.]/.test(source[i]!)) i++;
      const text = source.slice(start, i);
      const value = Number(text);
      if (Number.isNaN(value)) throw new ConditionError(`Bad number "${text}"`, start);
      tokens.push({ type: 'number', value, pos: start });
      continue;
    }
    if (ch === "'" || ch === '"') {
      i++;
      while (i < source.length && source[i] !== ch) i++;
      if (i >= source.length) throw new ConditionError('Unterminated string', start);
      tokens.push({ type: 'string', value: source.slice(start + 1, i), pos: start });
      i++;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      while (i < source.length && /[A-Za-z0-9_.-]/.test(source[i]!)) i++;
      tokens.push({ type: 'ident', value: source.slice(start, i), pos: start });
      continue;
    }
    if (ch === '-' && /[0-9.]/.test(source[i + 1] ?? '')) {
      i++;
      while (i < source.length && /[0-9.]/.test(source[i]!)) i++;
      tokens.push({ type: 'number', value: Number(source.slice(start, i)), pos: start });
      continue;
    }
    const op = OPERATORS.find((candidate) => source.startsWith(candidate, i));
    if (!op) throw new ConditionError(`Unexpected character "${ch}"`, start);
    tokens.push({ type: 'op', value: op, pos: start });
    i += op.length;
  }
  tokens.push({ type: 'end', pos: source.length });
  return tokens;
}

class Parser {
  private index = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.index]!;
  }

  private take(): Token {
    return this.tokens[this.index++]!;
  }

  private isOp(value: string): boolean {
    const token = this.peek();
    return token.type === 'op' && token.value === value;
  }

  private expectOp(value: string): void {
    const token = this.peek();
    if (!this.isOp(value)) throw new ConditionError(`Expected "${value}"`, token.pos);
    this.index++;
  }

  parse(): Node {
    const node = this.or();
    const rest = this.peek();
    if (rest.type !== 'end') throw new ConditionError('Unexpected input', rest.pos);
    return node;
  }

  private or(): Node {
    let left = this.and();
    while (this.isOp('||')) {
      this.index++;
      left = { kind: 'or', left, right: this.and() };
    }
    return left;
  }

  private and(): Node {
    let left = this.not();
    while (this.isOp('&&')) {
      this.index++;
      left = { kind: 'and', left, right: this.not() };
    }
    return left;
  }

  private not(): Node {
    if (this.isOp('!')) {
      this.index++;
      return { kind: 'not', operand: this.not() };
    }
    return this.compare();
  }

  private compare(): Node {
    const left = this.value();
    const token = this.peek();
    if (token.type === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(token.value)) {
      this.index++;
      return { kind: 'compare', op: token.value as CompareOp, left, right: this.value() };
    }
    return left;
  }

  private value(): Node {
    const token = this.take();
    switch (token.type) {
      case 'number':
      case 'string':
        return { kind: 'literal', value: token.value };
      case 'ident':
        if (this.isOp('(')) return this.call(token.value, token.pos);
        if (token.value === 'true') return { kind: 'literal', value: true };
        if (token.value === 'false') return { kind: 'literal', value: false };
        return { kind: 'state', name: token.value };
      case 'op':
        if (token.value === '(') {
          const inner = this.or();
          this.expectOp(')');
          return inner;
        }
        throw new ConditionError(`Unexpected "${token.value}"`, token.pos);
      case 'end':
        throw new ConditionError('Unexpected end of expression', token.pos);
    }
  }

  private call(name: string, pos: number): Node {
    const arity = FUNCTIONS[name];
    if (arity === undefined) throw new ConditionError(`Unknown function "${name}"`, pos);
    this.expectOp('(');
    const args: (string | number)[] = [];
    if (!this.isOp(')')) {
      for (;;) {
        const arg = this.take();
        if (arg.type === 'end') throw new ConditionError('Unexpected end of expression', arg.pos);
        if (arg.type === 'op') throw new ConditionError(`Unexpected "${arg.value}"`, arg.pos);
        args.push(arg.value);
        if (this.isOp(',')) {
          this.index++;
          continue;
        }
        break;
      }
    }
    this.expectOp(')');
    if (args.length !== arity) {
      throw new ConditionError(`${name}() takes ${arity} argument${arity === 1 ? '' : 's'}`, pos);
    }
    const first = String(args[0]);
    switch (name) {
      case 'count':
        return { kind: 'count', event: first };
      case 'event':
        return { kind: 'event', event: first };
      case 'state':
        return { kind: 'state', name: first };
      default:
        return { kind: 'has', event: first, value: args[1]! };
    }
  }
}

export function parseCondition(source: string): Condition {
  if (source.trim() === '') throw new ConditionError('Empty condition', 0);
  return { source, ast: new Parser(tokenize(source)).parse() };
}

function truthy(value: Value): boolean {
  return typeof value === 'string' ? value !== '' : Boolean(value);
}

function valueOf(node: Node, ctx: ConditionContext): Value {
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'state':
      return ctx.state[node.name] ?? 0;
    case 'count':
      return ctx.bus.count(node.event);
    case 'has':
      return ctx.bus.has(node.event, node.value);
    case 'event':
      return ctx.bus.seen(node.event);
    case 'not':
      return !truthy(valueOf(node.operand, ctx));
    case 'and':
      return truthy(valueOf(node.left, ctx)) && truthy(valueOf(node.right, ctx));
    case 'or':
      return truthy(valueOf(node.left, ctx)) || truthy(valueOf(node.right, ctx));
    case 'compare': {
      const left = valueOf(node.left, ctx);
      const right = valueOf(node.right, ctx);
      switch (node.op) {
        case '==':
          return left === right;
        case '!=':
          return left !== right;
        case '<':
          return left < right;
        case '<=':
          return left <= right;
        case '>':
          return left > right;
        case '>=':
          return left >= right;
      }
    }
  }
}

export function evaluate(condition: Condition, ctx: ConditionContext): boolean {
  return truthy(valueOf(condition.ast, ctx));
}
