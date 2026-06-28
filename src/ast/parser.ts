import { lex, Token, TK } from "./lexer";
import { ParsedStatement, StatementKind, ColumnDef } from "./types";

class TokenStream {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  getPos(): number { return this.pos; }
  setPos(p: number): void { this.pos = Math.max(0, Math.min(p, this.tokens.length - 1)); }

  peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  next(): Token {
    const t = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return t;
  }

  is(kind: TK, value?: string): boolean {
    const t = this.peek();
    if (t.kind !== kind) return false;
    return value === undefined || t.value.toUpperCase() === value.toUpperCase();
  }

  isKw(value: string): boolean { return this.is("kw", value); }

  eatKw(value: string): boolean {
    if (this.isKw(value)) { this.next(); return true; }
    return false;
  }

  // Eat all keywords in sequence; rollback if any fails
  eatSeq(...kws: string[]): boolean {
    const saved = this.pos;
    for (const kw of kws) {
      if (!this.eatKw(kw)) { this.pos = saved; return false; }
    }
    return true;
  }

  readIdent(): string | undefined {
    const t = this.peek();
    if (t.kind === "ident" || t.kind === "kw") { this.next(); return t.value; }
    return undefined;
  }

  // Read schema.table or just table — return the local name
  readQualifiedIdent(): string | undefined {
    const name = this.readIdent();
    if (!name) return undefined;
    if (this.is("dot")) { this.next(); return this.readIdent() ?? name; }
    return name;
  }

  // Whether keyword appears ahead at parenthesis depth 0
  hasKwAhead(value: string): boolean {
    let depth = 0;
    for (let i = this.pos; i < this.tokens.length; i++) {
      const t = this.tokens[i];
      if (t.kind === "lparen") { depth++; continue; }
      if (t.kind === "rparen") { depth--; continue; }
      if (t.kind === "eof") break;
      if (depth === 0 && t.kind === "kw" && t.value === value) return true;
    }
    return false;
  }

  skipParens(): void {
    if (!this.is("lparen")) return;
    this.next();
    let depth = 1;
    while (depth > 0 && !this.is("eof")) {
      const t = this.next();
      if (t.kind === "lparen") depth++;
      if (t.kind === "rparen") depth--;
    }
  }
}

function blank(line: number, raw: string): ParsedStatement {
  return { kind: "unknown", tables: [], isConcurrent: false, ifExists: false,
    isCascade: false, hasWhere: false, isTemporary: false, confidence: 0.5, raw, line };
}

export function parseStatement(sql: string, line = 1): ParsedStatement {
  const trimmed = sql.trim();
  if (!trimmed) return { ...blank(line, trimmed), confidence: 1.0 };

  const ts = new TokenStream(lex(trimmed));
  const r = blank(line, trimmed);

  // Skip CTE prefix (WITH [...] RECURSIVE ...) to find the DML verb
  if (ts.isKw("WITH")) {
    ts.next();
    ts.eatKw("RECURSIVE");
    let depth = 0;
    while (!ts.is("eof")) {
      const t = ts.peek();
      if (t.kind === "kw" && ["UPDATE","DELETE","INSERT","SELECT"].includes(t.value) && depth === 0) break;
      if (t.kind === "lparen") depth++;
      if (t.kind === "rparen") depth--;
      ts.next();
    }
  }

  const verb = ts.peek();
  if (verb.kind !== "kw") return r;
  ts.next();

  switch (verb.value) {
    case "DROP":   return parseDrop(ts, r);
    case "CREATE": return parseCreate(ts, r);
    case "ALTER":  return parseAlter(ts, r);
    case "DELETE": return parseDelete(ts, r);
    case "UPDATE": return parseUpdate(ts, r);
    case "INSERT": return parseInsert(ts, r);
    case "SELECT": return { ...r, kind: "select", confidence: 1.0 };
    case "TRUNCATE": return parseTruncate(ts, r);
    case "REINDEX":  return parseReindex(ts, r);
    case "VACUUM":   return parseVacuum(ts, r);
    case "CLUSTER":  return parseCluster(ts, r);
    case "ANALYZE":  return { ...r, kind: "analyze", confidence: 1.0 };
    case "LOCK":     return parseLock(ts, r);
    default: return r;
  }
}

// ── DROP ─────────────────────────────────────────────────────────────────────

function parseDrop(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  ts.eatSeq("IF", "EXISTS") && (r.ifExists = true);

  const obj = ts.peek();
  if (obj.kind !== "kw") return r;
  ts.next();

  switch (obj.value) {
    case "TABLE":
      r.kind = "drop_table";
      r.table = ts.readQualifiedIdent();
      if (r.table) r.tables.push(r.table);
      r.isCascade = ts.eatKw("CASCADE");
      r.confidence = 0.95;
      break;
    case "INDEX":
      r.kind = "drop_index";
      r.isConcurrent = ts.eatKw("CONCURRENTLY");
      r.indexName = ts.readQualifiedIdent();
      r.confidence = 0.95;
      break;
    case "DATABASE":
      r.kind = "drop_database";
      r.table = ts.readIdent();
      r.confidence = 0.95;
      break;
    case "SCHEMA":
      r.kind = "drop_schema";
      r.table = ts.readIdent();
      r.isCascade = ts.eatKw("CASCADE");
      r.confidence = 0.95;
      break;
    case "COLUMN":
      r.kind = "drop_column";
      r.column = ts.readIdent();
      r.confidence = 0.9;
      break;
    case "SEQUENCE":
      r.kind = "drop_sequence";
      r.table = ts.readQualifiedIdent();
      r.confidence = 0.9;
      break;
    case "TYPE":
      r.kind = "drop_type";
      r.table = ts.readQualifiedIdent();
      r.confidence = 0.9;
      break;
    case "DOMAIN":
      r.kind = "drop_domain";
      r.table = ts.readQualifiedIdent();
      r.confidence = 0.9;
      break;
    case "VIEW":
      r.kind = "drop_view";
      r.table = ts.readQualifiedIdent();
      r.confidence = 0.9;
      break;
    case "AGGREGATE":
      r.kind = "drop_aggregate"; r.confidence = 0.85; break;
    case "FUNCTION":
      r.kind = "drop_function"; r.confidence = 0.85; break;
    case "TRIGGER":
      r.kind = "drop_trigger"; r.confidence = 0.85; break;
    case "CONSTRAINT":
      r.kind = "drop_constraint"; r.confidence = 0.85; break;
    case "OWNED":
      if (ts.eatKw("BY")) { r.kind = "drop_owned"; r.confidence = 0.95; }
      break;
  }
  return r;
}

// ── CREATE ────────────────────────────────────────────────────────────────────

function parseCreate(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  ts.eatSeq("OR", "REPLACE");
  r.isTemporary = ts.eatKw("TEMPORARY") || ts.eatKw("TEMP");
  const isUnique = ts.eatKw("UNIQUE");

  const obj = ts.peek();
  if (obj.kind !== "kw") return r;
  ts.next();

  switch (obj.value) {
    case "TABLE":
      r.kind = "create_table";
      ts.eatSeq("IF", "NOT", "EXISTS");
      r.table = ts.readQualifiedIdent();
      if (r.table) r.tables.push(r.table);
      r.confidence = 0.95;
      break;
    case "INDEX":
      r.kind = "create_index";
      r.isConcurrent = ts.eatKw("CONCURRENTLY");
      ts.eatSeq("IF", "NOT", "EXISTS");
      r.indexName = ts.readQualifiedIdent();
      if (ts.eatKw("ON")) { r.table = ts.readQualifiedIdent(); if (r.table) r.tables.push(r.table); }
      r.confidence = 0.95;
      break;
    case "MATERIALIZED":
      if (ts.eatKw("VIEW")) {
        r.kind = "create_materialized_view";
        r.table = ts.readQualifiedIdent();
        if (r.table) r.tables.push(r.table);
        r.confidence = 0.9;
      }
      break;
    case "VIEW":
      r.kind = "create_view";
      r.table = ts.readQualifiedIdent();
      if (r.table) r.tables.push(r.table);
      r.confidence = 0.9;
      break;
    case "FUNCTION":  r.kind = "create_function";  r.confidence = 0.85; break;
    case "TRIGGER":   r.kind = "create_trigger";   r.confidence = 0.85; break;
    case "SEQUENCE":
      r.kind = "create_sequence";
      r.table = ts.readQualifiedIdent();
      r.confidence = 0.9;
      break;
    case "SCHEMA":
      r.kind = "create_schema";
      r.table = ts.readIdent();
      r.confidence = 0.9;
      break;
    case "TYPE":
      r.kind = "create_type";
      r.table = ts.readQualifiedIdent();
      r.confidence = 0.9;
      break;
    case "DOMAIN":
      r.kind = "create_domain";
      r.table = ts.readQualifiedIdent();
      r.confidence = 0.85;
      break;
  }
  void isUnique;
  return r;
}

// ── ALTER ─────────────────────────────────────────────────────────────────────

function parseAlter(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  const obj = ts.peek();
  if (obj.kind !== "kw") return r;
  ts.next();

  if (obj.value === "SYSTEM") {
    const sysAction = ts.peek();
    const action = (sysAction.kind === "kw" || sysAction.kind === "ident") ? sysAction.value.toUpperCase() : "";
    if (action) ts.next();
    return { ...r, kind: "alter_system", alterSystemAction: action || "SET", confidence: 0.95 };
  }
  if (obj.value !== "TABLE") return r;

  ts.eatSeq("IF", "EXISTS");
  ts.eatKw("ONLY");
  r.table = ts.readQualifiedIdent();
  if (r.table) r.tables.push(r.table);

  const action = ts.peek();
  if (action.kind !== "kw") return r;
  ts.next();

  switch (action.value) {
    case "ADD":     return parseAlterAdd(ts, r);
    case "DROP":    return parseAlterDrop(ts, r);
    case "RENAME":  return parseAlterRename(ts, r);
    case "ALTER":   return parseAlterColumn(ts, r);
    case "ENABLE":  if (ts.eatKw("TRIGGER")) { r.kind = "alter_enable_trigger";  r.confidence = 0.9; } break;
    case "DISABLE": if (ts.eatKw("TRIGGER")) { r.kind = "alter_disable_trigger"; r.confidence = 0.9; } break;
    case "ATTACH":
      if (ts.eatKw("PARTITION")) { r.kind = "attach_partition"; r.confidence = 0.9; }
      break;
    case "DETACH":
      if (ts.eatKw("PARTITION")) {
        r.kind = "detach_partition";
        r.isConcurrent = ts.hasKwAhead("CONCURRENTLY");
        r.confidence = 0.9;
      }
      break;
    case "MODIFY":
      ts.eatKw("COLUMN");
      r.kind = "alter_alter_column_type";
      r.column = ts.readIdent();
      r.confidence = 0.8;
      break;
    case "CHANGE":
      ts.eatKw("COLUMN");
      r.kind = "alter_rename_column";
      r.column = ts.readIdent();
      r.newName = ts.readIdent();
      r.confidence = 0.8;
      break;
    case "OWNER":
      ts.eatKw("TO");
      r.kind = "unknown";
      r.confidence = 0.9;
      break;
  }
  return r;
}

function parseAlterAdd(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  ts.eatKw("COLUMN");

  if (ts.eatKw("CONSTRAINT")) {
    r.constraintName = ts.readIdent();
    const ctype = ts.peek();
    r.kind = "alter_add_constraint";
    if (ctype.kind === "kw") {
      r.constraintType = ctype.value; // PRIMARY, FOREIGN, UNIQUE, CHECK
      ts.next();
      if (ctype.value === "FOREIGN" || ctype.value === "PRIMARY") ts.eatKw("KEY");
    }
    // NOT VALID = skip scan; VALID is not a keyword so check only for NOT at depth 0
    r.isNotValid = ts.hasKwAhead("NOT");
    r.confidence = 0.9;
    return r;
  }

  // ADD PRIMARY KEY / ADD FOREIGN KEY / ADD UNIQUE / ADD CHECK without CONSTRAINT name
  {
    const kw = ts.peek();
    if (kw.kind === "kw" && ["PRIMARY", "FOREIGN", "UNIQUE", "CHECK"].includes(kw.value)) {
      r.kind = "alter_add_constraint";
      r.constraintType = kw.value;
      ts.next();
      if (kw.value === "PRIMARY" || kw.value === "FOREIGN") ts.eatKw("KEY");
      r.isNotValid = ts.hasKwAhead("NOT");
      r.confidence = 0.85;
      return r;
    }
  }

  ts.eatSeq("IF", "NOT", "EXISTS");
  r.kind = "alter_add_column";
  r.column = ts.readIdent();

  // Scan for NOT NULL and DEFAULT flags
  let hasNotNull = false;
  let hasDefault = false;
  let hasVolatileDefault = false;
  const typeTokens: string[] = [];
  let depth = 0;
  let pastType = false;

  while (true) {
    const t = ts.peek();
    if (t.kind === "eof" || t.kind === "semi") break;
    if (t.kind === "comma" && depth === 0) break;
    if (t.kind === "rparen" && depth === 0) break;
    if (t.kind === "lparen") { depth++; if (!pastType) typeTokens.push(t.raw); ts.next(); continue; }
    if (t.kind === "rparen") { depth--; if (!pastType) typeTokens.push(t.raw); ts.next(); continue; }

    if (depth === 0 && t.kind === "kw") {
      if (t.value === "NOT") {
        const saved = ts.getPos();
        ts.next();
        if (ts.eatKw("NULL")) { hasNotNull = true; pastType = true; continue; }
        ts.setPos(saved);
      }
      if (t.value === "NULL") { ts.next(); pastType = true; continue; }
      if (t.value === "DEFAULT") { hasDefault = true; pastType = true; ts.next();
        // consume the default expression; detect volatile function calls via '('
        // stop at depth-0 constraint keywords (NOT NULL, UNIQUE, PRIMARY, etc.)
        const CONSTRAINT_KWS = new Set(["NOT","NULL","UNIQUE","PRIMARY","REFERENCES","CHECK","GENERATED","CONSTRAINT"]);
        // Volatile pseudofunctions that appear without parens (non-deterministic)
        const VOLATILE_NOPARENS = new Set([
          "CURRENT_TIMESTAMP","CURRENT_DATE","CURRENT_TIME","CURRENT_USER","CURRENT_ROLE",
          "TRANSACTION_TIMESTAMP","STATEMENT_TIMESTAMP","CLOCK_TIMESTAMP","TIMEOFDAY",
        ]);
        let prevTokenKind: string = "start";
        while (!ts.is("eof") && !ts.is("semi") && !(ts.is("comma") && depth === 0)) {
          if (depth === 0 && ts.peek().kind === "kw" && CONSTRAINT_KWS.has(ts.peek().value)) break;
          const cur = ts.peek();
          // Function call: ident or kw immediately before '(' → volatile
          if (cur.kind === "lparen") {
            if (prevTokenKind === "ident" || prevTokenKind === "kw") hasVolatileDefault = true;
            depth++;
          } else if (cur.kind === "rparen" && depth === 0) break;
          else if (cur.kind === "rparen") depth--;
          // Known volatile pseudofunctions without parens
          else if (cur.kind === "ident" && VOLATILE_NOPARENS.has(cur.value.toUpperCase())) {
            hasVolatileDefault = true;
          }
          prevTokenKind = cur.kind;
          ts.next();
        }
        continue;
      }
      if (["UNIQUE","PRIMARY","REFERENCES","CHECK","GENERATED"].includes(t.value)) {
        pastType = true; ts.next(); continue;
      }
    }

    if (!pastType) typeTokens.push(t.raw);
    ts.next();
  }

  r.columnDef = {
    name: r.column ?? "",
    dataType: typeTokens.join(" ").replace(/\s+/g, " ").trim(),
    nullable: !hasNotNull,
    hasDefault,
    hasVolatileDefault,
  };
  r.confidence = 0.9;
  return r;
}

function parseAlterDrop(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  ts.eatSeq("IF", "EXISTS");
  if (ts.eatKw("COLUMN")) {
    ts.eatSeq("IF", "EXISTS");
    r.kind = "alter_drop_column";
    r.column = ts.readIdent();
    r.isCascade = ts.eatKw("CASCADE");
    r.confidence = 0.9;
  } else if (ts.eatKw("CONSTRAINT")) {
    r.kind = "alter_drop_constraint";
    r.constraintName = ts.readIdent();
    r.confidence = 0.9;
  }
  return r;
}

function parseAlterRename(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  if (ts.eatKw("TO")) {
    r.kind = "alter_rename_table";
    r.newName = ts.readIdent();
    r.confidence = 0.95;
  } else if (ts.eatKw("COLUMN")) {
    r.kind = "alter_rename_column";
    r.column = ts.readIdent();
    ts.eatKw("TO");
    r.newName = ts.readIdent();
    r.confidence = 0.95;
  } else {
    r.kind = "alter_rename_table";
    r.newName = ts.readIdent();
    r.confidence = 0.85;
  }
  return r;
}

function parseAlterColumn(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  ts.eatKw("COLUMN");
  r.column = ts.readIdent();

  const action = ts.peek();
  if (action.kind !== "kw") return r;
  ts.next();

  if (action.value === "TYPE") {
    r.kind = "alter_alter_column_type"; r.confidence = 0.95;
    r.newType = ts.readIdent();
    r.hasUsing = ts.hasKwAhead("USING");
  } else if (action.value === "SET") {
    if (ts.eatSeq("NOT", "NULL")) {
      r.kind = "alter_set_not_null"; r.confidence = 0.95;
    } else if (ts.eatKw("DEFAULT")) {
      r.kind = "alter_set_default"; r.confidence = 0.9;
    } else if (ts.eatSeq("DATA", "TYPE")) {
      r.kind = "alter_alter_column_type"; r.confidence = 0.9;
    }
    // SET STATISTICS / SET (n_distinct=...) / SET STORAGE etc. are safe planner hints — leave as unknown
  } else if (action.value === "DROP") {
    if (ts.eatSeq("NOT", "NULL")) {
      r.kind = "alter_drop_not_null"; r.confidence = 0.95;
    } else if (ts.eatKw("DEFAULT")) {
      r.kind = "alter_drop_default"; r.confidence = 0.95;
    }
  } else if (action.value === "USING") {
    r.kind = "alter_alter_column_type"; r.confidence = 0.85;
  }
  return r;
}

// ── DML ───────────────────────────────────────────────────────────────────────

function parseDelete(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  r.kind = "delete";
  ts.eatKw("FROM");
  r.table = ts.readQualifiedIdent();
  if (r.table) r.tables.push(r.table);
  r.hasWhere = ts.hasKwAhead("WHERE");
  r.confidence = 0.95;
  return r;
}

function parseUpdate(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  r.kind = "update";
  ts.eatKw("ONLY");
  r.table = ts.readQualifiedIdent();
  if (r.table) r.tables.push(r.table);
  r.hasWhere = ts.hasKwAhead("WHERE");
  r.confidence = 0.95;
  return r;
}

function parseInsert(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  r.kind = "insert";
  ts.eatKw("INTO");
  r.table = ts.readQualifiedIdent();
  if (r.table) r.tables.push(r.table);
  r.confidence = 0.95;
  return r;
}

function parseTruncate(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  r.kind = "truncate";
  ts.eatKw("TABLE");
  r.table = ts.readQualifiedIdent();
  if (r.table) r.tables.push(r.table);
  r.isCascade = ts.hasKwAhead("CASCADE");
  r.confidence = 0.95;
  return r;
}

function parseReindex(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  r.kind = "reindex";
  if (ts.is("lparen")) { ts.skipParens(); r.isConcurrent = true; }
  const obj = ts.peek();
  if (obj.kind === "kw" && ["INDEX","TABLE","SCHEMA","DATABASE","SYSTEM"].includes(obj.value)) {
    r.reindexScope = obj.value;
    ts.next();
  }
  r.isConcurrent = r.isConcurrent || ts.eatKw("CONCURRENTLY");
  r.table = ts.readQualifiedIdent();
  r.confidence = 0.9;
  return r;
}

function parseVacuum(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  r.kind = ts.eatKw("FULL") ? "vacuum_full" : "vacuum";
  r.confidence = 0.9;
  return r;
}

function parseCluster(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  r.kind = "cluster";
  r.table = ts.readQualifiedIdent();
  if (r.table) r.tables.push(r.table);
  r.confidence = 0.85;
  return r;
}

function parseLock(ts: TokenStream, r: ParsedStatement): ParsedStatement {
  r.kind = "lock_table";
  ts.eatKw("TABLE");
  r.table = ts.readQualifiedIdent();
  if (r.table) r.tables.push(r.table);
  r.confidence = 0.9;
  return r;
}
