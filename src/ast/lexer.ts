export type TK =
  | "kw" | "ident" | "string" | "number"
  | "comma" | "semi" | "lparen" | "rparen" | "dot" | "star" | "op"
  | "eof";

export interface Token {
  kind: TK;
  value: string;
  raw: string;
}

const KEYWORDS = new Set([
  "SELECT","INSERT","UPDATE","DELETE","TRUNCATE","DROP","CREATE","ALTER",
  "TABLE","INDEX","COLUMN","DATABASE","SCHEMA","VIEW","FUNCTION","TRIGGER",
  "MATERIALIZED","SEQUENCE","TYPE","DOMAIN","AGGREGATE","CONSTRAINT","SYSTEM",
  "OWNED","BY","PARTITION","ADD","SET","RENAME","TO","NOT","NULL","DEFAULT",
  "CONCURRENTLY","IF","EXISTS","CASCADE","RESTRICT","WHERE","FROM","RETURNING",
  "WITH","RECURSIVE","UNIQUE","FOREIGN","KEY","REFERENCES","CHECK","ENABLE",
  "DISABLE","ATTACH","DETACH","TEMPORARY","TEMP","REPLACE","OR","INTO",
  "LANGUAGE","AS","BEGIN","END","RETURNS","RETURN","FULL","VACUUM","REINDEX",
  "CLUSTER","ANALYZE","LOCK","USING","MODIFY","CHANGE","ON","ONLY","VALUES",
  "DATA","CONVERT","INHERITS","ATTACH","PRIMARY","OWNER",
]);

export function lex(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    if (/\s/.test(sql[i])) { i++; continue; }

    // line comment
    if (sql[i] === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }

    // block comment
    if (sql[i] === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    // dollar-quoted string
    if (sql[i] === "$") {
      const rest = sql.slice(i);
      const m = rest.match(/^\$([^$]*)\$/);
      if (m) {
        const tag = m[0];
        const end = sql.indexOf(tag, i + tag.length);
        if (end !== -1) {
          tokens.push({ kind: "string", value: "", raw: sql.slice(i, end + tag.length) });
          i = end + tag.length;
          continue;
        }
      }
      tokens.push({ kind: "op", value: "$", raw: "$" });
      i++;
      continue;
    }

    // single-quoted string
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      tokens.push({ kind: "string", value: "", raw: sql.slice(i, j) });
      i = j;
      continue;
    }

    // double-quoted identifier
    if (sql[i] === '"') {
      let j = i + 1;
      while (j < sql.length && sql[j] !== '"') j++;
      tokens.push({ kind: "ident", value: sql.slice(i + 1, j), raw: sql.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // backtick identifier (MySQL)
    if (sql[i] === "`") {
      let j = i + 1;
      while (j < sql.length && sql[j] !== "`") j++;
      tokens.push({ kind: "ident", value: sql.slice(i + 1, j), raw: sql.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // numbers
    if (/[0-9]/.test(sql[i])) {
      let j = i;
      while (j < sql.length && /[0-9.]/.test(sql[j])) j++;
      const raw = sql.slice(i, j);
      tokens.push({ kind: "number", value: raw, raw });
      i = j;
      continue;
    }

    // identifiers and keywords
    if (/[a-zA-Z_]/.test(sql[i])) {
      let j = i;
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++;
      const raw = sql.slice(i, j);
      const upper = raw.toUpperCase();
      tokens.push(KEYWORDS.has(upper)
        ? { kind: "kw", value: upper, raw }
        : { kind: "ident", value: raw, raw });
      i = j;
      continue;
    }

    switch (sql[i]) {
      case ",": tokens.push({ kind: "comma", value: ",", raw: "," }); break;
      case ";": tokens.push({ kind: "semi",  value: ";", raw: ";" }); break;
      case "(": tokens.push({ kind: "lparen",value: "(", raw: "(" }); break;
      case ")": tokens.push({ kind: "rparen",value: ")", raw: ")" }); break;
      case ".": tokens.push({ kind: "dot",   value: ".", raw: "." }); break;
      case "*": tokens.push({ kind: "star",  value: "*", raw: "*" }); break;
      default:  tokens.push({ kind: "op",    value: sql[i], raw: sql[i] });
    }
    i++;
  }

  tokens.push({ kind: "eof", value: "", raw: "" });
  return tokens;
}
