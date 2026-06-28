import { ParsedStatement } from "../ast/types";

export type ObjectType = "table" | "view" | "index" | "sequence" | "function" | "trigger" | "schema" | "type" | "unknown";

export interface ObjectNode {
  name:         string;
  type:         ObjectType;
  dependencies: string[];   // objects this node depends on
  dependents:   string[];   // objects that depend on this node
}

export interface DominoEffect {
  root:      string;
  affected:  string[];   // transitive dependents
  depth:     number;
}

export class DependencyGraph {
  private nodes = new Map<string, ObjectNode>();

  add(name: string, type: ObjectType, dependencies: string[] = []): void {
    const key = name.toLowerCase();
    if (!this.nodes.has(key)) {
      this.nodes.set(key, { name, type, dependencies: [], dependents: [] });
    }
    const node = this.nodes.get(key)!;
    for (const dep of dependencies) {
      const depKey = dep.toLowerCase();
      if (!node.dependencies.includes(depKey)) node.dependencies.push(depKey);
      if (!this.nodes.has(depKey)) {
        this.nodes.set(depKey, { name: dep, type: "unknown", dependencies: [], dependents: [] });
      }
      const depNode = this.nodes.get(depKey)!;
      if (!depNode.dependents.includes(key)) depNode.dependents.push(key);
    }
  }

  get(name: string): ObjectNode | undefined {
    return this.nodes.get(name.toLowerCase());
  }

  getDirectDependents(name: string): string[] {
    return this.nodes.get(name.toLowerCase())?.dependents ?? [];
  }

  getDomino(name: string, maxDepth = 10): DominoEffect {
    const visited = new Set<string>();
    const queue   = [{ n: name.toLowerCase(), depth: 0 }];
    const affected: string[] = [];

    while (queue.length) {
      const { n, depth } = queue.shift()!;
      if (visited.has(n) || depth > maxDepth) continue;
      visited.add(n);
      const node = this.nodes.get(n);
      if (!node) continue;
      for (const dep of node.dependents) {
        if (!visited.has(dep)) {
          affected.push(dep);
          queue.push({ n: dep, depth: depth + 1 });
        }
      }
    }

    return { root: name, affected, depth: Math.min(maxDepth, affected.length > 0 ? maxDepth : 0) };
  }

  size(): number { return this.nodes.size; }

  toJson(): Record<string, { type: ObjectType; dependencies: string[]; dependents: string[] }> {
    const out: Record<string, { type: ObjectType; dependencies: string[]; dependents: string[] }> = {};
    for (const [key, node] of this.nodes) {
      out[key] = { type: node.type, dependencies: node.dependencies, dependents: node.dependents };
    }
    return out;
  }
}

// Build a dependency graph from parsed statements.
// This is static analysis — we infer relationships from the SQL structure,
// not by querying the live database.
export function buildDependencyGraph(stmts: ParsedStatement[]): DependencyGraph {
  const graph = new DependencyGraph();

  for (const s of stmts) {
    switch (s.kind) {
      case "create_table":
        if (s.table) graph.add(s.table, "table");
        break;

      case "create_view":
      case "create_materialized_view":
        // Views depend on every table referenced in their query
        if (s.table) {
          const deps = s.tables.filter((t) => t !== s.table);
          graph.add(s.table, "view", deps);
        }
        break;

      case "create_index":
        if (s.indexName && s.table) graph.add(s.indexName, "index", [s.table]);
        break;

      case "create_sequence":
        if (s.table) graph.add(s.table, "sequence");
        break;

      case "create_function":
        if (s.table) {
          const deps = s.tables.filter((t) => t !== s.table);
          graph.add(s.table, "function", deps);
        }
        break;

      case "create_trigger":
        if (s.table && s.tables.length > 1) {
          const triggerTable = s.tables.find((t) => t !== s.table) ?? s.tables[0];
          graph.add(s.table, "trigger", [triggerTable]);
        }
        break;

      case "create_schema":
        if (s.table) graph.add(s.table, "schema");
        break;

      case "create_type":
        if (s.table) graph.add(s.table, "type");
        break;

      case "alter_rename_table":
        if (s.table) graph.add(s.table, "table");
        if (s.newName) graph.add(s.newName, "table");
        break;

      case "drop_table":
      case "drop_view":
      case "drop_index":
      case "drop_sequence":
      case "drop_function":
      case "drop_type":
      case "drop_schema":
        // Node remains in graph but is "dropped" — useful for tracking domino effects
        if (s.table) graph.add(s.table, inferType(s.kind));
        break;

      default:
        // DML — register tables referenced
        for (const t of s.tables) {
          if (t) graph.add(t, "table");
        }
        break;
    }
  }

  return graph;
}

function inferType(kind: string): ObjectType {
  if (kind.includes("view"))     return "view";
  if (kind.includes("index"))    return "index";
  if (kind.includes("sequence")) return "sequence";
  if (kind.includes("function")) return "function";
  if (kind.includes("schema"))   return "schema";
  if (kind.includes("type"))     return "type";
  return "table";
}
