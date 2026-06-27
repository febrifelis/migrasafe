import * as vscode from "vscode";
import { MigrasafeDiagnosticsProvider } from "./diagnostics";
import { MigrasafeCodeActionProvider } from "./codeActions";
import { MigrasafeHoverProvider } from "./hover";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new MigrasafeDiagnosticsProvider();

  // Register hover and code actions
  const SQL_SELECTOR: vscode.DocumentSelector = { language: "sql" };

  context.subscriptions.push(
    provider,
    vscode.languages.registerCodeActionsProvider(SQL_SELECTOR, new MigrasafeCodeActionProvider(), {
      providedCodeActionKinds: MigrasafeCodeActionProvider.providedCodeActionKinds,
    }),
    vscode.languages.registerHoverProvider(SQL_SELECTOR, new MigrasafeHoverProvider(
      // expose internal collection via cast — in real extension, pass collection reference
      (provider as unknown as { collection: vscode.DiagnosticCollection }).collection
    )),
  );

  // Check on open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => provider.scheduleCheck(doc))
  );

  // Check on save (immediate) and on change (debounced)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => provider.scheduleCheck(doc, 0)),
    vscode.workspace.onDidChangeTextDocument((e) => provider.scheduleCheck(e.document, 1000)),
    vscode.workspace.onDidCloseTextDocument((doc) => provider.clear(doc.uri))
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("migrasafe.checkFile", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) provider.check(editor.document);
    }),
    vscode.commands.registerCommand("migrasafe.clearDiagnostics", () => {
      provider.clearAll();
    })
  );

  // Check already-open editors on activate
  for (const doc of vscode.workspace.textDocuments) {
    provider.scheduleCheck(doc, 500);
  }
}

export function deactivate(): void {
  // cleanup handled by subscriptions
}
