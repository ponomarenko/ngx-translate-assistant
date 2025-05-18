import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceSettings } from './utils';

/**
 * Registers a definition provider for translation keys
 */
export function registerDefinitionProvider(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.languages.registerDefinitionProvider(
        ['html', 'typescript'],
        new TranslationKeyDefinitionProvider()
    );
}

class TranslationKeyDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {
        // Get the word at the cursor position
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        
        // Get the line text
        const lineText = document.lineAt(position.line).text;
        
        // Extract the translation key
        let translationKey = this.extractTranslationKey(lineText, position);
        if (!translationKey) {
            return undefined;
        }
        
        // Find the translation file
        const settings = getWorkspaceSettings();
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        
        if (!workspaceFolder || !settings.translationPath || !settings.defaultLang) {
            return undefined;
        }
        
        const translationFilePath = path.join(
            workspaceFolder.uri.fsPath,
            settings.translationPath,
            `${settings.defaultLang}.json`
        );
        
        // Check if the translation file exists
        if (!fs.existsSync(translationFilePath)) {
            return undefined;
        }
        
        // Read the translation file
        const translationFileUri = vscode.Uri.file(translationFilePath);
        try {
            const translationContent = fs.readFileSync(translationFilePath, 'utf8');
            const location = this.findTranslationKeyLocation(
                translationContent,
                translationKey,
                translationFileUri
            );
            
            return location;
        } catch (error) {
            console.error(`Error reading translation file: ${error}`);
            return undefined;
        }
    }
    
    /**
     * Extract translation key from the line of text
     */
    private extractTranslationKey(lineText: string, position: vscode.Position): string | undefined {
        // Handle different patterns for translation keys
        
        // Pattern 1: {{ 'key' | translate }} or {{ "key" | translate }}
        const pipePattern = /\{\{\s*(?:['"]|\\["'])(.+?)(?:['"]|\\["'])\s*\|\s*translate\s*\}\}/g;
        let match: RegExpExecArray | null;
        while ((match = pipePattern.exec(lineText)) !== null) {
            const keyStart = match.index + match[0].indexOf(match[1]);
            const keyEnd = keyStart + match[1].length;
            
            if (position.character >= keyStart && position.character <= keyEnd) {
                return match[1];
            }
        }
        
        // Pattern 2: translate.instant('key')
        const instantPattern = /translate\.instant\(\s*['"](.+?)['"]\s*\)/g;
        while ((match = instantPattern.exec(lineText)) !== null) {
            const keyStart = match.index + match[0].indexOf(match[1]);
            const keyEnd = keyStart + match[1].length;
            
            if (position.character >= keyStart && position.character <= keyEnd) {
                return match[1];
            }
        }
        
        // Pattern 3: this.translate.instant('key')
        const thisInstantPattern = /this\.translate\.instant\(\s*['"](.+?)['"]\s*\)/g;
        while ((match = thisInstantPattern.exec(lineText)) !== null) {
            const keyStart = match.index + match[0].indexOf(match[1]);
            const keyEnd = keyStart + match[1].length;
            
            if (position.character >= keyStart && position.character <= keyEnd) {
                return match[1];
            }
        }
        
        // Pattern 4: [attr]="'key' | translate"
        const attrPattern = /\[\w+\]=\s*["'](.+?)\s*\|\s*translate["']/g;
        while ((match = attrPattern.exec(lineText)) !== null) {
            const keyStart = match.index + match[0].indexOf(match[1]);
            const keyEnd = keyStart + match[1].length;
            
            if (position.character >= keyStart && position.character <= keyEnd) {
                return match[1];
            }
        }
        
        // Pattern 5: translate="key"
        const directivePattern = /translate=["'](.+?)["']/g;
        while ((match = directivePattern.exec(lineText)) !== null) {
            const keyStart = match.index + match[0].indexOf(match[1]);
            const keyEnd = keyStart + match[1].length;
            
            if (position.character >= keyStart && position.character <= keyEnd) {
                return match[1];
            }
        }
        
        return undefined;
    }
    
    /**
     * Find the location of a translation key in the JSON content
     */
    private findTranslationKeyLocation(
        content: string,
        key: string,
        fileUri: vscode.Uri
    ): vscode.Location | undefined {
        // Escape special characters for regex
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Build regex pattern based on nested key path
        const keyParts = key.split('.');
        let pattern = '';
        let currentPath = '';
        
        for (let i = 0; i < keyParts.length; i++) {
            const part = keyParts[i];
            currentPath += (currentPath ? '.' : '') + part;
            
            if (i === keyParts.length - 1) {
                // Last part - look for the actual key-value pair
                pattern = `["']${escapedKey}["']\\s*:\\s*["']`;
            } else {
                // Intermediate part - look for the object
                pattern = `["']${part}["']\\s*:\\s*\\{`;
            }
            
            const regex = new RegExp(pattern);
            const match = regex.exec(content);
            
            if (match) {
                const position = content.substring(0, match.index).split('\n');
                const line = position.length - 1;
                const character = position[position.length - 1].length;
                
                return new vscode.Location(
                    fileUri,
                    new vscode.Position(line, character)
                );
            }
        }
        
        return undefined;
    }
}
