import { Plugin, Editor } from "obsidian";

/* TODO: add support for:
 * - $ auto-closing feature;
 * + stackrel formula shortcut (maybe \defn ?)
 * + prg:[language extension] to create a coding tab for the specified language
 * - optimize language extensions for the \prg: command by using a single case that automatically gets the correct language from the dictionary
 * - keyboard shortcut to swap between open files
 * - maybe a keyboard shortcut to open a file from the currently opened folder next to the current file?
*/ 

/**
 * UniPlugin class - A plugin for Obsidian that provides two main features:
 * - Displays the line count of the current document in the status bar.
 * - Simplifies specific mathematical expressions in the document.
 */
export default class UniPlugin extends Plugin {
    private statusBarItem: HTMLElement | null = null;

    private languages = {
        "js"    : "js",
        "py"    : "python",
        "cpp"   : "cpp",
        "java"  : "java",
        "psc"   : "pseudocodice"
    };

    private patterns = [
        /arr[0-9]/gi,           // arr[n].
        /m[0-9],[0-9]/gi,       // m[n],[m].
        /\\pars/gi,             // pars
        /\\code/gi,             // opens a code section with backticks (no language selected)
        /\\prg:js/gi,           // opens a code section for js
        /\\prg:py/gi,           // opens a code section for python
        /\\prg:cpp/gi,          // opens a code section for cpp
        /\\prg:java/gi,         // opens a code section for java
        /\\prg:psc/gi,          // opens a code section for pseudocodice
        /\\sys/gi,              // \begin{cases}\end{cases}
        /\\defn/gi,             // \stackrel{}{}

    ];

    /**
     * Initializes the plugin when loaded.
     * - Creates and adds a status bar item for line count.
     * - Registers event listeners for editor changes.
     */
    async onload() {
        console.log("UniPlugin loaded! Have a good lesson👋");

        // Create the status bar item and initialize it.
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.setText(""); // Set initial text to empty.

        // Add the status bar item to the parent container.
        this.statusBarItem.parentElement?.prepend(this.statusBarItem);

        // Listen for changes to the active leaf and update line count accordingly.
        this.app.workspace.on("active-leaf-change", async () => {
            const file = this.app.workspace.getActiveFile();
            if (!file) {
                this.updateLineCount(undefined);
                return;
            }
            const content = await file?.vault.read(file);
            this.updateLineCount(content);
        });

        // Listen for changes in the editor and update line count + simplify math.
        this.app.workspace.on("editor-change", (editor: Editor) => {
            const content = editor.getDoc().getValue();
            this.updateLineCount(content);
            this.mathSimplifier(editor);
        });
    }

    /**
     * Updates the line count displayed in the status bar item.
     * - Splits the file content by line breaks and dollar signs.
     * - Handles the case where the last line might be empty.
     * 
     * @param fileContent - The content of the current file. If undefined, hides the status bar item.
     */
    private async updateLineCount(fileContent?: string) {
        // If no content is available, hide the status bar item.
        if (!fileContent) {
            this.statusBarItem?.hide();
            return;
        }

        // Show the status bar item if content is available.
        this.statusBarItem?.show();

        // Split content by newlines and dollar signs for custom counting.
        const lines = fileContent.split(/\n|\${2}/);

        // If the last item is an empty string, adjust the count.
        let amount = lines.length;
        if (lines[amount - 1] === "") {
            amount--;
        }

        // Update the status bar with the line count.
        this.statusBarItem?.setText(`Lines: ${amount}`);
    }

    /**
     * Simplifies mathematical expressions in the editor based on predefined patterns.
     * - Replaces the recognized patterns with a simplified format.
     * 
     * @param editor - The editor instance where the math simplification takes place.
     */
    private mathSimplifier(editor: Editor) {
        if (!editor) return;

        const cursorPos = editor.getCursor();
        const wordBeforeCursor = editor.getDoc().getRange(
            { line: cursorPos.line, ch: 0 }, // Start of the line
            cursorPos
        ).split(/\s+/).pop(); // Get the last word before the cursor

        // Check each pattern and simplify if matched.
        this.patterns.forEach((pattern, index) => {
            let newWord = "";
            let startPos;
            let newCursorPos;
            let amount;

            if (wordBeforeCursor && pattern.test(wordBeforeCursor)) {
                switch (index) {
                    case 0: // Handle "arr[n]"
                        amount = Number(wordBeforeCursor[wordBeforeCursor.length - 1]);
                        newWord = "\\begin{array}{";   // if amount = 0, it will not write anything, leaving empty parenthesis.
                        if (amount > 0)
                            newWord = newWord  + 'c'.repeat(amount - 1) + "|c";
                        newWord = newWord + "}\\end{array}";
                        startPos = { line: cursorPos.line, ch: cursorPos.ch - 4 };
                        editor.getDoc().replaceRange(newWord, startPos, cursorPos);
                        newCursorPos = { line: cursorPos.line, ch: cursorPos.ch - (11 + 5) };
                        editor.setCursor(newCursorPos);
                        break;
                    case 1: // Handle "m[n],m"
                        newWord = `M_{${Number(wordBeforeCursor[wordBeforeCursor.length - 3])},${Number(wordBeforeCursor[wordBeforeCursor.length - 1])}} = \\pmatrix{}`;
                        startPos = { line: cursorPos.line, ch: cursorPos.ch - 4 };
                        editor.getDoc().replaceRange(newWord, startPos, cursorPos);
                        break;
                    case 2: // Handle parentheses
                        newWord = "\\left(\\right)";
                        startPos = { line: cursorPos.line, ch: cursorPos.ch - 5 };
                        editor.getDoc().replaceRange(newWord, startPos, cursorPos);
                        newCursorPos = { line: cursorPos.line, ch: cursorPos.ch - (7 + 5) };
                        editor.setCursor(newCursorPos);
                        break;
                    case 3: // Handle code section
                        newWord = `\`\`\`\n\n\`\`\``;
                        startPos = { line: cursorPos.line, ch: cursorPos.ch - 5 };
                        editor.getDoc().replaceRange(newWord, startPos, cursorPos);
                        newCursorPos = { line: cursorPos.line + 1, ch: 0 };
                        editor.setCursor(newCursorPos);  
                        break;
                    case 4: // Handle \prg:js
                        newWord = `\`\`\`js\n\n\`\`\``;
                        startPos = { line: cursorPos.line, ch: cursorPos.ch - 7 };
                        editor.getDoc().replaceRange(newWord, startPos, cursorPos);
                        newCursorPos = { line: cursorPos.line + 1, ch: 0 };
                        editor.setCursor(newCursorPos);  
                        break;
                    case 5: // Handle \prg:py
                        newWord = `\`\`\`python\n\n\`\`\``;
                        startPos = { line: cursorPos.line, ch: cursorPos.ch - 7 };
                        editor.getDoc().replaceRange(newWord, startPos, cursorPos);
                        newCursorPos = { line: cursorPos.line + 1, ch: 0 };
                        editor.setCursor(newCursorPos);  
                        break;
                    case 6: // Handle \prg:cpp
                        newWord = `\`\`\`cpp\n\n\`\`\``;
                        startPos = { line: cursorPos.line, ch: cursorPos.ch - 8 };
                        editor.getDoc().replaceRange(newWord, startPos, cursorPos);
                        newCursorPos = { line: cursorPos.line + 1, ch: 0 };
                        editor.setCursor(newCursorPos);  
                        break;
                    case 7: // Handle \prg:java
                        newWord = `\`\`\`java\n\n\`\`\``;
                        startPos = { line: cursorPos.line, ch: cursorPos.ch - 9 };
                        editor.getDoc().replaceRange(newWord, startPos, cursorPos);
                        newCursorPos = { line: cursorPos.line + 1, ch: 0 };
                        editor.setCursor(newCursorPos);  
                        break;
                    case 8: // Handle \prg:psc
                        newWord = `\`\`\`pseudocodice\n\n\`\`\``;
                        startPos = { line: cursorPos.line, ch: cursorPos.ch - 8 };
                        editor.getDoc().replaceRange(newWord, startPos, cursorPos);
                        newCursorPos = { line: cursorPos.line + 1, ch: 0 };
                        editor.setCursor(newCursorPos);  
                        break;
                    case 9: // Handle \sys
                        newWord = "\\begin{cases}\\end{cases}";
                        startPos = { line: cursorPos.line, ch: cursorPos.ch - 4 };
                        editor.getDoc().replaceRange(newWord, startPos, cursorPos);
                        newCursorPos = { line: cursorPos.line, ch: cursorPos.ch - (10 + 5) };
                        editor.setCursor(newCursorPos);
                        break;
                    case 10:
                        newWord = "\\stackrel{}{}";
                        startPos = { line: cursorPos.line, ch: cursorPos.ch - 5 };
                        editor.getDoc().replaceRange(newWord, startPos, cursorPos);
                        newCursorPos = { line: cursorPos.line, ch: cursorPos.ch - (3 + 5) };
                        editor.setCursor(newCursorPos);
                        break;
                }
            }
        });
    }

    /**
     * Cleans up the plugin when it is unloaded.
     * - Removes the status bar item.
     */
    onunload() {
        console.log("UniPlugin unloaded! Bye bye👋");

        // Clean up: remove status bar item.
        this.statusBarItem?.remove();
    }
}
