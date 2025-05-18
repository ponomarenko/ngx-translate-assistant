import * as vscode from 'vscode';

export function goToTranslationKey() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const selection = editor.document.getText(editor.selection);
  const keyMatch = selection.match(/'(.*?)'/);
  if (!keyMatch) return;

  const key = keyMatch[1];
  const translationPath = vscode.workspace.getConfiguration('ngxTranslateAssistant').get<string>('translationPath') || 'assets/i18n';
  const defaultLang = vscode.workspace.getConfiguration('ngxTranslateAssistant').get<string>('defaultLang') || 'en';

  const filePath = vscode.Uri.file(`${vscode.workspace.rootPath}/${translationPath}/${defaultLang}.json`);

  vscode.workspace.openTextDocument(filePath).then(doc => {
    vscode.window.showTextDocument(doc).then(editor => {
      const text = doc.getText();
      const index = text.indexOf(`"${key}"`);
      if (index !== -1) {
        const pos = doc.positionAt(index);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos));
      }
    });
  });
}