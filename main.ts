import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, getAllTags} from 'obsidian';
import * as path from 'path';
import * as fs from 'fs';

interface ObsidianToQuartoSettings {
    dateOption: 'none' | 'created' | 'modified';
    dateFormat: string;
    outputFolder: string;
    overwriteExisting: boolean;
    importTags: boolean;
    allowExternalPaths: boolean;
}

const DEFAULT_SETTINGS: ObsidianToQuartoSettings = {
    dateOption: 'none',
    dateFormat: 'YYYY-MM-DD',
    outputFolder: '',
    overwriteExisting: false,
    importTags: true,
    allowExternalPaths: false
}

export default class ObsidianToQuartoPlugin extends Plugin {
    settings: ObsidianToQuartoSettings;

    async onload() {
        console.log('Loading ObsidianToQuartoPlugin');
        await this.loadSettings();

        this.addCommand({
            id: 'export-to-quarto',
            name: 'Export to Quarto QMD',
            callback: () => this.exportToQuarto(),
        });

        this.addSettingTab(new ObsidianToQuartoSettingTab(this.app, this));
        console.log('ObsidianToQuartoPlugin loaded');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async exportToQuarto() {
        try {
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile || activeFile.extension !== 'md') {
                new Notice('Please open a Markdown file before exporting');
                return;
            }

            const content = await this.app.vault.read(activeFile);
            const convertedContent = await this.convertToQuarto(content, activeFile);
            
            let outputPath: string;
            let newFileName = activeFile.basename + '.qmd';
            let newPath: string;

            if (this.settings.allowExternalPaths && path.isAbsolute(this.settings.outputFolder)) {
                // Handle absolute path outside vault
                outputPath = this.settings.outputFolder;
                try {
                    fs.mkdirSync(outputPath, { recursive: true });
                    newPath = path.join(outputPath, newFileName);

                    if (fs.existsSync(newPath)) {
                        if (this.settings.overwriteExisting) {
                            fs.unlinkSync(newPath);
                        } else {
                            let counter = 1;
                            while (fs.existsSync(newPath)) {
                                newFileName = `${activeFile.basename}_${counter}.qmd`;
                                newPath = path.join(outputPath, newFileName);
                                counter++;
                            }
                        }
                    }

                    fs.writeFileSync(newPath, convertedContent);
                    new Notice(`Successfully exported to ${newPath}`);
                } catch (error) {
                    console.error('Error writing to external path:', error);
                    new Notice(`Failed to write to external path: ${error.message}`);
                    return;
                }
            } else {
                // Handle vault path
                outputPath = this.settings.outputFolder || activeFile.parent.path;
                await this.app.vault.adapter.mkdir(outputPath);
                
                newPath = `${outputPath}/${newFileName}`;
                if (await this.app.vault.adapter.exists(newPath)) {
                    if (this.settings.overwriteExisting) {
                        await this.app.vault.adapter.remove(newPath);
                    } else {
                        let counter = 1;
                        while (await this.app.vault.adapter.exists(newPath)) {
                            newFileName = `${activeFile.basename}_${counter}.qmd`;
                            newPath = `${outputPath}/${newFileName}`;
                            counter++;
                        }
                    }
                }

                await this.app.vault.create(newPath, convertedContent);
                const newFile = this.app.vault.getAbstractFileByPath(newPath);
                if (newFile instanceof TFile) {
                    await this.app.workspace.openLinkText(newFile.path, '', true);
                }
                new Notice(`Successfully exported to ${newFileName}`);
            }
        } catch (error) {
            console.error('Error in exportToQuarto:', error);
            new Notice('Failed to export to Quarto QMD. Check console for details.');
        }
    }

    convertObsidianImages(content: string): string {
        // Convert Obsidian image syntax (![[image.png]]) to standard Markdown
        // Only match files with image/media extensions to avoid mangling embedded notes
        return content.replace(
            /!\[\[([^\]]+?\.(?:png|jpe?g|gif|bmp|svg|webp|mp4|webm|ogv|mov|mkv|pdf)(?:\|[^\]]*)?)\]\]/gi,
            (_, ref) => {
                // Strip Obsidian size hint (e.g. |400) if present
                const clean = ref.replace(/\|.*$/, '');
                return `![](${clean})`;
            }
        );
    }

    async convertToQuarto(content: string, file: TFile): Promise<string> {
        // Normalise line endings to \n (handles Windows \r\n)
        content = content.replace(/\r\n/g, '\n');

        // Extract frontmatter if it exists
        let frontmatter = '';
        let mainContent = content;
        const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
        if (frontmatterMatch) {
            frontmatter = frontmatterMatch[0];
            mainContent = content.slice(frontmatter.length);
        }

        // Use title from existing frontmatter if present, otherwise fall back to filename
        let existingTitle: string | null = null;
        if (frontmatter) {
            const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
            if (titleMatch) {
                existingTitle = titleMatch[1].trim();
            }
        }
        const title = existingTitle ?? file.basename;
        let newFrontmatter = `---\ntitle: "${title}"\n`;

        if (this.settings.dateOption !== 'none') {
            const date = await this.getFileDate(file);
            newFrontmatter += `date: "${date}"\n`;
        }

        // Add tags if enabled
        if (this.settings.importTags) {
            const fileTags = this.getFileTags(file);
            if (fileTags.length > 0) {
                newFrontmatter += `tags:\n${fileTags.map(tag => `  - ${tag}`).join('\n')}\n`;
            }
        }

        // Merge existing frontmatter (if any) with new frontmatter, excluding tags
        if (frontmatter) {
            const lines = frontmatter
                .slice(4, -4) // Remove '---' delimiters
                .split('\n');
            const filtered: string[] = [];
            let inTagsBlock = false;
            let currentListKey = '';
            let currentListItems: string[] = [];

            const flushList = () => {
                if (currentListKey) {
                    // Convert multiline YAML list to inline format for Quarto compatibility
                    const quoted = currentListItems.map(item => `"${item}"`);
                    filtered.push(`${currentListKey}: [${quoted.join(', ')}]`);
                    currentListKey = '';
                    currentListItems = [];
                }
            };

            for (const line of lines) {
                // Skip title — already written at the top of newFrontmatter
                if (/^title\s*:/.test(line)) {
                    continue;
                }
                if (/^tags\s*:/.test(line)) {
                    flushList();
                    inTagsBlock = true;
                    continue;
                }
                if (inTagsBlock) {
                    if (/^\s+-/.test(line) || line.trim() === '') {
                        continue;
                    }
                    inTagsBlock = false;
                }

                // Detect start of a YAML multiline list (key with no inline value)
                const listKeyMatch = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*$/);
                if (listKeyMatch) {
                    flushList();
                    currentListKey = listKeyMatch[1];
                    continue;
                }

                // Collect list items if we're inside a multiline list
                if (currentListKey) {
                    const itemMatch = line.match(/^\s+-\s*(.+)$/);
                    if (itemMatch) {
                        currentListItems.push(itemMatch[1].trim());
                        continue;
                    } else if (line.trim() === '') {
                        continue;
                    } else {
                        // Not a list item — flush and continue normally
                        flushList();
                    }
                }

                // Fix single-quoted JSON array values (Obsidian text property type)
                // e.g. resource-path: '["C:/path"]' → resource-path: ["C:/path"]
                const quotedArrayMatch = line.match(/^([^:]+):\s*'(\[.*\])'\s*$/);
                if (quotedArrayMatch) {
                    filtered.push(`${quotedArrayMatch[1]}: ${quotedArrayMatch[2]}`);
                    continue;
                }

                filtered.push(line);
            }
            flushList();
            newFrontmatter += filtered.join('\n') + '\n';
        }
        newFrontmatter += '---\n\n';

        // Process main content
        let convertedContent = mainContent;

        // Preserve content before the first header
        const firstHeaderIndex = convertedContent.search(/^\s*#/m);
        let preHeaderContent = '';
        if (firstHeaderIndex !== -1) {
            preHeaderContent = convertedContent.slice(0, firstHeaderIndex).trim() + '\n\n';
            convertedContent = convertedContent.slice(firstHeaderIndex);
        }

        // Convert Obsidian image syntax before other conversions
        convertedContent = this.convertObsidianImages(convertedContent);

        convertedContent = await this.convertEmbeddedNotes(convertedContent);

        // Add line breaks before headers
        convertedContent = convertedContent.replace(/^(#+\s.*)/gm, '\n$1');

        // Format single-line display math ($$...$$) as multi-line for Quarto
        convertedContent = convertedContent.replace(
            /^\$\$([^\n]+?)\$\$\s*$/gm,
            '$$$\n$1\n$$$'
        );

        // Convert Obsidian highlight syntax ==text== to <mark> tags
        convertedContent = convertedContent.replace(/==(.*?)==/g, '<mark>$1</mark>');

        // Convert Obsidian wikilinks [[Page Name]] and [[Page Name|Display Text]] to Markdown links
        convertedContent = convertedContent.replace(
            /(?<!!)\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
            (_, target, display) => `[${display || target}](${target.replace(/ /g, '%20')})`
        );

        // Convert Obsidian callouts to Quarto callouts
        convertedContent = convertedContent.replace(
            /> \[!(\w+)\](.*?)(?:\n)((?:>.*(?:\n|$))*)/g,
            (_, type, title, content) => {
                const quartoType = this.mapCalloutType(type);
                const cleanContent = content
                    .replace(/^>\s?/gm, '')
                    .trim();
                return `::: {.callout-${quartoType}}\n${title.trim() ? `## ${title.trim()}\n` : ''}${cleanContent}\n:::\n\n`;
            }
        );

        // Combine all parts
        return newFrontmatter + preHeaderContent + convertedContent;
    }

    getFileTags(file: TFile): string[] {
        const fileCache = this.app.metadataCache.getFileCache(file);
        if (fileCache) {
            const tags = getAllTags(fileCache);
            return tags ? tags.map(tag => tag.replace('#', '')) : [];
        }
        return [];
    }

    async getFileDate(file: TFile): Promise<string> {
        try {
            const stat = await this.app.vault.adapter.stat(file.path);
            if (!stat) {
                console.error('Failed to get file stats');
                return this.formatDate(new Date()); // Use current date as fallback
            }
            const date = this.settings.dateOption === 'created' ? stat.ctime : stat.mtime;
            return this.formatDate(new Date(date));
        } catch (error) {
            console.error('Error getting file date:', error);
            return this.formatDate(new Date()); // Use current date as fallback
        }
    }

    formatDate(date: Date): string {
        const format = this.settings.dateFormat;
        return format
            .replace('YYYY', date.getFullYear().toString())
            .replace('MM', (date.getMonth() + 1).toString().padStart(2, '0'))
            .replace('DD', date.getDate().toString().padStart(2, '0'))
            .replace('HH', date.getHours().toString().padStart(2, '0'))
            .replace('mm', date.getMinutes().toString().padStart(2, '0'))
            .replace('ss', date.getSeconds().toString().padStart(2, '0'));
    }

    async convertEmbeddedNotes(content: string): Promise<string> {
        const embeddedNoteRegex = /!\[\[([^\]]+?)((?:#|\^).+?)?\]\]/g;
        const embedPromises: Promise<string>[] = [];

        content.replace(embeddedNoteRegex, (match, noteName, reference) => {
            embedPromises.push(this.getEmbeddedNoteContent(noteName, reference));
            return match;
        });

        const embeddedContents = await Promise.all(embedPromises);

        return content.replace(embeddedNoteRegex, () => embeddedContents.shift() || '');
    }

    async getEmbeddedNoteContent(noteName: string, reference?: string): Promise<string> {
        const file = this.app.metadataCache.getFirstLinkpathDest(noteName, '');
        if (file instanceof TFile) {
            let content = await this.app.vault.read(file);
            console.log(`Original content length: ${content.length}`);

            if (reference) {
                console.log(`Processing reference: ${reference}`);
                if (reference.startsWith('#')) {
                    // Header reference
                    const headerName = reference.slice(1);
                    console.log(`Looking for header: ${headerName}`);
                    const headerRegex = new RegExp(`^(#+)\\s*${this.escapeRegExp(headerName)}\\s*$`, 'im');
                    const headerMatch = content.match(headerRegex);
                    if (headerMatch) {
                        console.log(`Found header: ${headerMatch[0]}`);
                        const headerLevel = headerMatch[1].length;
                        const headerIndex = headerMatch.index!;
                        const nextHeaderRegex = new RegExp(`^#{1,${headerLevel}}\\s`, 'im');
                        const remainingContent = content.slice(headerIndex + headerMatch[0].length);
                        const nextHeaderMatch = remainingContent.match(nextHeaderRegex);
                        const nextHeaderIndex = nextHeaderMatch ? nextHeaderMatch.index! + headerMatch[0].length : content.length;
                        content = content.slice(headerIndex, headerIndex + nextHeaderIndex);
                        console.log(`Extracted content length: ${content.length}`);
                    } else {
                        console.log(`Header not found: ${headerName}`);
                        return `\n\n> [!warning] Header not found: ${headerName} in ${noteName}\n\n`;
                    }
                } else if (reference.startsWith('^')) {
                    // Block reference
                    const blockId = reference.slice(1);
                    console.log(`Looking for block: ${blockId}`);
                    const blockRegex = new RegExp(`(^|\n)([^\n]+\\s*(?:{{[^}]*}})?\\s*\\^${this.escapeRegExp(blockId)}\\s*$)`, 'm');
                    const blockMatch = content.match(blockRegex);
                    if (blockMatch) {
                        console.log(`Found block: ${blockMatch[2]}`);
                        const blockIndex = blockMatch.index! + blockMatch[1].length;
                        const blockEndIndex = content.indexOf('\n\n', blockIndex);
                        content = blockEndIndex !== -1 
                            ? content.slice(blockIndex, blockEndIndex).trim()
                            : content.slice(blockIndex).trim();
                        console.log(`Extracted content length: ${content.length}`);
                    } else {
                        console.log(`Block not found: ${blockId}`);
                        return `\n\n> [!warning] Block not found: ${blockId} in ${noteName}\n\n`;
                    }
                }
            }

            // Remove the block reference if it exists
            content = content.replace(/\s*\^[a-zA-Z0-9-]+\s*$/, '');

            return `\n\n${content.trim()}\n\n`;
        } else {
            console.log(`File not found: ${noteName}`);
            return `\n\n> [!warning] Embedded note not found: ${noteName}${reference || ''}\n\n`;
        }
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private mapCalloutType(obsidianType: string): string {
        const typeMap: {[key: string]: string} = {
            'note': 'note',
            'info': 'info',
            'tip': 'tip',
            'success': 'success',
            'question': 'question',
            'warning': 'warning',
            'failure': 'error',
            'danger': 'warning',
            'bug': 'bug',
            'example': 'example',
            'quote': 'quote'
        };
        return typeMap[obsidianType.toLowerCase()] || 'note';
    }


}

class ObsidianToQuartoSettingTab extends PluginSettingTab {
    plugin: ObsidianToQuartoPlugin;

    constructor(app: App, plugin: ObsidianToQuartoPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Allow External Paths')
            .setDesc('If enabled, allows exporting files to locations outside the Obsidian vault using absolute paths')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.allowExternalPaths)
                .onChange(async (value) => {
                    this.plugin.settings.allowExternalPaths = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Output Folder')
            .setDesc('Specify the folder where QMD files should be saved. Use absolute path (e.g., /home/user/exports) to save outside vault, or relative path for inside vault. Leave blank to use same folder as original file.')
            .addText(text => text
                .setPlaceholder('Enter folder path')
                .setValue(this.plugin.settings.outputFolder)
                .onChange(async (value) => {
                    this.plugin.settings.outputFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Date Option')
            .setDesc('Choose which date to add to the Quarto document')
            .addDropdown(dropdown => dropdown
                .addOption('none', 'No date')
                .addOption('created', 'Creation date')
                .addOption('modified', 'Last modified date')
                .setValue(this.plugin.settings.dateOption)
                .onChange(async (value) => {
                    this.plugin.settings.dateOption = value as 'none' | 'created' | 'modified';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Date Format')
            .setDesc('Specify the date format (YYYY: year, MM: month, DD: day, HH: hour, mm: minute, ss: second)')
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD')
                .setValue(this.plugin.settings.dateFormat)
                .onChange(async (value) => {
                    this.plugin.settings.dateFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Overwrite Existing Files')
            .setDesc('If checked, existing files will be overwritten. If unchecked, a new file with a number appended will be created.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.overwriteExisting)
                .onChange(async (value) => {
                    this.plugin.settings.overwriteExisting = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Import Tags')
            .setDesc('If checked, tags from the Obsidian note will be imported into the Quarto file.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.importTags)
                .onChange(async (value) => {
                    this.plugin.settings.importTags = value;
                    await this.plugin.saveSettings();
                }));
    }
}

declare module 'obsidian' {
    interface App {
        vault: Vault;
        workspace: Workspace;
        metadataCache: MetadataCache;
    }
}
