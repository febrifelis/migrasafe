import * as vscode from "vscode";

export class MigrasafeCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      if (diag.source !== "migrasafe") continue;

      // Extract rule ID from the diagnostic message: "[RULE_ID] ..."
      const match = diag.message.match(/^\[([A-Z_]+)\]/);
      const ruleId = match?.[1];

      // Quick Fix 1: suppress this specific rule on the next statement
      if (ruleId) {
        const fix = new vscode.CodeAction(
          `migrasafe: suppress ${ruleId} on this statement`,
          vscode.CodeActionKind.QuickFix
        );
        fix.diagnostics = [diag];
        fix.edit = new vscode.WorkspaceEdit();
        const insertLine = diag.range.start.line;
        fix.edit.insert(
          document.uri,
          new vscode.Position(insertLine, 0),
          `-- migrasafe-disable-next-line ${ruleId}\n`
        );
        actions.push(fix);
      }

      // Quick Fix 2: suppress ALL rules on the next statement
      const suppressAll = new vscode.CodeAction(
        "migrasafe: suppress all rules on this statement",
        vscode.CodeActionKind.QuickFix
      );
      suppressAll.diagnostics = [diag];
      suppressAll.edit = new vscode.WorkspaceEdit();
      const insertLine = diag.range.start.line;
      suppressAll.edit.insert(
        document.uri,
        new vscode.Position(insertLine, 0),
        `-- migrasafe-disable-next-line\n`
      );
      actions.push(suppressAll);
    }

    return actions;
  }
}
