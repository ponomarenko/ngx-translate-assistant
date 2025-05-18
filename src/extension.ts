import * as vscode from "vscode";
import { scanForHardcodedText } from "./scanner";
import { extractToTranslation } from "./translationWriter";
import { registerDefinitionProvider } from "./definition-provider";

export function activate(context: vscode.ExtensionContext) {
  console.log("ngx-translate-assistant is now active");

  // Register the scan command
  const scanCommand = vscode.commands.registerCommand(
    "ngxTranslate.scanHardcodedText",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No editor is active");
        return;
      }

      const document = editor.document;
      if (
        document.languageId !== "html" &&
        document.languageId !== "typescript"
      ) {
        vscode.window.showInformationMessage(
          "This command only works with HTML and TypeScript files"
        );
        return;
      }

      try {
        const hardcodedTexts = await scanForHardcodedText(document);

        if (hardcodedTexts.length === 0) {
          vscode.window.showInformationMessage(
            "No hardcoded text found in the current file"
          );
          return;
        }

        // Show found hardcoded texts
        vscode.window.showInformationMessage(
          `Found ${hardcodedTexts.length} hardcoded strings in the file`
        );

        // Create diagnostic collection
        const diagnostics = hardcodedTexts.map((text) => {
          const range = new vscode.Range(
            document.positionAt(text.start),
            document.positionAt(text.end)
          );

          const diagnostic = new vscode.Diagnostic(
            range,
            "Hardcoded text should be extracted to translation file",
            vscode.DiagnosticSeverity.Information
          );

          diagnostic.code = "ngx-translate-hardcoded";
          return diagnostic;
        });

        const collection =
          vscode.languages.createDiagnosticCollection("ngxTranslate");
        collection.set(document.uri, diagnostics);

        context.subscriptions.push(collection);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error scanning for hardcoded text: ${error}`
        );
      }
    }
  );

  // Register the extract command
  const extractCommand = vscode.commands.registerCommand(
    "ngxTranslate.extractToTranslation",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No editor is active");
        return;
      }

      const document = editor.document;
      const selection = editor.selection;

      if (selection.isEmpty) {
        vscode.window.showInformationMessage("Please select text to extract");
        return;
      }

      const text = document.getText(selection);

      try {
        const result = await extractToTranslation(document, text, selection);
        if (result.success && result.replacement) {
          // Replace selected text with translation pipe or method
          await editor.edit((editBuilder) => {
            editBuilder.replace(selection, result.replacement as string);
          });

          vscode.window.showInformationMessage(
            `Successfully extracted text with key: ${result.key}`
          );
        } else {
          vscode.window.showErrorMessage(
            "Failed to extract text to translation file"
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error extracting text: ${error}`);
      }
    }
  );

  // Register the "Go to Translation" command
  const goToCommand = vscode.commands.registerCommand(
    "ngxTranslate.goToTranslationKey",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No editor is active");
        return;
      }

      // This is more of a fallback method - the real implementation
      // will be handled by the DefinitionProvider
      vscode.window.showInformationMessage(
        "Please use Go to Definition (F12) on a translation key"
      );
    }
  );

  // Register code actions provider
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    ["html", "typescript"],
    {
      provideCodeActions(document, range, context, token) {
        const diagnostics = context.diagnostics.filter(
          (diag) => diag.code === "ngx-translate-hardcoded"
        );

        if (diagnostics.length === 0) {
          return [];
        }

        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of diagnostics) {
          const action = new vscode.CodeAction(
            "Extract to translation file",
            vscode.CodeActionKind.QuickFix
          );

          action.command = {
            command: "ngxTranslate.extractToTranslation",
            title: "Extract to translation file",
            arguments: [document, diagnostic.range],
          };

          action.diagnostics = [diagnostic];
          action.isPreferred = true;
          actions.push(action);
        }

        return actions;
      },
    }
  );

  // Register the Definition Provider
  const definitionProvider = registerDefinitionProvider(context);

  // Add context menu commands
  context.subscriptions.push(
    scanCommand,
    extractCommand,
    goToCommand,
    codeActionProvider,
    definitionProvider
  );
}

// This extension requires no cleanup on deactivation
export function deactivate() {}
