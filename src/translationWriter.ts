import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { generateTranslationKey, getWorkspaceSettings } from "./utils";

interface ExtractionResult {
  success: boolean;
  key?: string;
  replacement?: string;
}

/**
 * Extract selected text to the translation file and return the key
 */
export async function extractToTranslation(
  document: vscode.TextDocument,
  text: string,
  selection: vscode.Selection
): Promise<ExtractionResult> {
  const settings = getWorkspaceSettings();

  if (!settings.translationPath || !settings.defaultLang) {
    vscode.window.showErrorMessage(
      "Translation settings are not configured. Please set translationPath and defaultLang in settings.json"
    );
    return { success: false };
  }

  // Get the workspace folder containing the current document
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage(
      "Cannot determine workspace folder for the current file"
    );
    return { success: false };
  }

  // Calculate paths
  const componentPath = document.fileName;
  const translationFilePath = path.join(
    workspaceFolder.uri.fsPath,
    settings.translationPath,
    `${settings.defaultLang}.json`
  );

  // Generate translation key
  const key = await generateTranslationKey(componentPath, text);

  // Update the translation file
  try {
    await updateTranslationFile(translationFilePath, key, text);

    // Generate replacement text based on file type
    let replacement = "";
    if (document.languageId === "html") {
      // Handle HTML template replacement
      if (text.includes("\n") || text.includes('"')) {
        // For multiline or text with quotes, use an interpolated binding
        replacement = `{{ '${key}' | translate }}`;
      } else {
        // Determine if the text is inside an attribute or a text node
        const selectedText = document.getText(selection);
        const line = document.lineAt(selection.start.line).text;
        const selectedStart = line.indexOf(selectedText);

        if (selectedStart >= 0) {
          const beforeText = line.substring(0, selectedStart);

          // Check if the text is within an attribute
          const attributeMatch = beforeText.match(/\s(\w+)=["']$/);
          if (attributeMatch) {
            const attribute = attributeMatch[1];
            // Determine if we should use attribute binding or translate directive
            if (
              ["placeholder", "title", "alt", "aria-label"].includes(attribute)
            ) {
              // For these attributes, we'll use the translate directive
              replacement = key;

              // We'll need to inform the user to add the translate directive
              vscode.window.showInformationMessage(
                `Add [${attribute}]="${key}" and the translate directive to the element`
              );
            } else {
              // For other attributes, use simple key
              replacement = key;
            }
          } else {
            // Text node
            replacement = `{{ '${key}' | translate }}`;
          }
        } else {
          // Default to pipe if we can't determine context
          replacement = `{{ '${key}' | translate }}`;
        }
      }
    } else if (document.languageId === "typescript") {
      // Handle TypeScript file replacement
      replacement = `this.translate.instant('${key}')`;
    }

    return { success: true, key, replacement };
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to update translation file: ${error}`
    );
    return { success: false };
  }
}

/**
 * Updates the translation file with the new key and text
 */
async function updateTranslationFile(
  filePath: string,
  key: string,
  text: string
): Promise<void> {
  // Ensure the directory exists
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  let translationObj: any = {};

  // If the file already exists, read it
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      translationObj = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Cannot parse translation file: ${error}`);
    }
  }

  // Update or add the translation key
  setNestedProperty(translationObj, key, text);

  // Write the file with proper formatting
  fs.writeFileSync(filePath, JSON.stringify(translationObj, null, 2), "utf8");
}

/**
 * Sets a nested property in an object using dot notation
 * For example: setNestedProperty(obj, 'home.title', 'Welcome')
 * would create: { home: { title: 'Welcome' } }
 */
function setNestedProperty(obj: any, key: string, value: string): void {
  const parts = key.split(".");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) {
      current[part] = {};
    } else if (typeof current[part] !== "object") {
      // If the path exists but is not an object, convert it to an object
      current[part] = {};
    }
    current = current[part];
  }

  // Set the final property
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}
