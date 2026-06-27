import * as vscode from "vscode";

export class MigrasafeHoverProvider implements vscode.HoverProvider {
  constructor(private diagnostics: vscode.DiagnosticCollection) {}

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
    const uri = document.uri;
    const diags = this.diagnostics.get(uri);
    if (!diags) return null;

    for (const diag of diags) {
      if (!diag.range.contains(position) || diag.source !== "migrasafe") continue;

      const lines: string[] = [];
      lines.push(`**migrasafe** — ${diag.message}`);

      if (diag.relatedInformation?.length) {
        for (const info of diag.relatedInformation) {
          lines.push(`\n💡 ${info.message}`);
        }
      }

      lines.push("\n---");
      lines.push(`*Add \`-- migrasafe-disable-next-line\` to suppress this warning.*`);

      return new vscode.Hover(new vscode.MarkdownString(lines.join("\n")));
    }

    return null;
  }
}
