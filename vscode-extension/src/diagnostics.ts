import * as vscode from "vscode";
import { runMigrasafe, JsonIssue } from "./runner";

export class MigrasafeDiagnosticsProvider {
  private collection: vscode.DiagnosticCollection;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private statusBar: vscode.StatusBarItem;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection("migrasafe");
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
    this.statusBar.command = "migrasafe.checkFile";
  }

  dispose(): void {
    this.collection.dispose();
    this.statusBar.dispose();
    for (const t of this.debounceTimers.values()) clearTimeout(t);
  }

  scheduleCheck(document: vscode.TextDocument, delayMs = 800): void {
    const cfg = vscode.workspace.getConfiguration("migrasafe");
    if (!cfg.get<boolean>("enabled", true)) return;
    if (document.languageId !== "sql") return;

    const key = document.uri.toString();
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      this.check(document);
    }, delayMs);
    this.debounceTimers.set(key, timer);
  }

  async check(document: vscode.TextDocument): Promise<void> {
    this.statusBar.text = "$(sync~spin) migrasafe";
    this.statusBar.show();

    try {
      const result = await runMigrasafe(document.uri.fsPath);
      const diagnostics: vscode.Diagnostic[] = [];

      for (const fileResult of result.files) {
        for (const issue of fileResult.issues) {
          const diag = this.issueToDiagnostic(document, issue);
          diagnostics.push(diag);
        }
      }

      this.collection.set(document.uri, diagnostics);

      if (result.safe) {
        this.statusBar.text = "$(check) migrasafe";
        this.statusBar.tooltip = "No issues found";
      } else {
        const { critical, high } = result.summary;
        this.statusBar.text = `$(warning) migrasafe ${result.summary.total} issue(s)`;
        this.statusBar.tooltip = `${critical} CRITICAL, ${high} HIGH — Risk ${result.risk.score}/100`;
      }
    } catch {
      this.statusBar.text = "$(x) migrasafe";
      this.statusBar.tooltip = "Failed to run migrasafe (is it installed?)";
    }
  }

  clear(uri: vscode.Uri): void {
    this.collection.delete(uri);
  }

  clearAll(): void {
    this.collection.clear();
    this.statusBar.hide();
  }

  private issueToDiagnostic(document: vscode.TextDocument, issue: JsonIssue): vscode.Diagnostic {
    const lineIndex = Math.max(0, issue.line - 1);
    const lineText = document.lineAt(Math.min(lineIndex, document.lineCount - 1)).text;
    const range = new vscode.Range(lineIndex, 0, lineIndex, lineText.length);

    const severity =
      issue.severity === "CRITICAL" || issue.severity === "HIGH"
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;

    const diag = new vscode.Diagnostic(range, `[${issue.severity}] ${issue.message}`, severity);
    diag.source = "migrasafe";
    diag.code = issue.severity;
    if (issue.suggestion) {
      diag.relatedInformation = [
        new vscode.DiagnosticRelatedInformation(
          new vscode.Location(document.uri, range),
          `Fix: ${issue.suggestion}`
        ),
      ];
    }
    return diag;
  }
}
