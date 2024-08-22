import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, Vault, Workspace, MetadataCache } from 'obsidian';

interface ObsidianToQuartoSettings {
    dateOption: 'none' | 'created' | 'modified';
    dateFormat: string;
    outputFolder: string;
    overwriteExisting: boolean;
    importTags: boolean;
}

const DEFAULT_SETTINGS: ObsidianToQuartoSettings = {
    dateOption: 'none',
    dateFormat: 'YYYY-MM-DD',
    outputFolder: '',
    overwriteExisting: false,
    importTags: true
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
            
            const outputFolder = this.settings.outputFolder || activeFile.parent.path;
            let newFileName = activeFile.basename + '.qmd';
            let newPath = `${outputFolder}/${newFileName}`;

            await this.app.vault.adapter.mkdir(outputFolder);
            
            // Check if file exists and handle accordingly
            if (await this.app.vault.adapter.exists(newPath)) {
                if (this.settings.overwriteExisting) {
                    await this.app.vault.adapter.remove(newPath);
                } else {
                    let counter = 1;
                    while (await this.app.vault.adapter.exists(newPath)) {
                        newFileName = `${activeFile.basename}_${counter}.qmd`;
                        newPath = `${outputFolder}/${newFileName}`;
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
        } catch (error) {
            console.error('Error in exportToQuarto:', error);
            new Notice('Failed to export to Quarto QMD. Check console for details.');
        }
    }

    async convertToQuarto(content: string, file: TFile): Promise<string> {
        let convertedContent = content;

        // Add title and date to frontmatter
        const title = file.basename;
        let frontmatter = `---\ntitle: "${title}"\n`;

        if (this.settings.dateOption !== 'none') {
            const date = await this.getFileDate(file);
            frontmatter += `date: "${date}"\n`;
        }

        // Add tags if enabled
        if (this.settings.importTags) {
            const fileTags = this.getFileTags(file);
            if (fileTags.length > 0) {
                frontmatter += `tags: [${fileTags.map(tag => `"${tag}"`).join(', ')}]\n`;
            }
        }

        frontmatter += '---\n\n';

        // Replace existing frontmatter or add new frontmatter
        if (/^---\n/.test(convertedContent)) {
            convertedContent = convertedContent.replace(/^---\n[\s\S]*?---\n/, frontmatter);
        } else {
            convertedContent = frontmatter + convertedContent;
        }

        convertedContent = await this.convertEmbeddedNotes(convertedContent);

        // Add line breaks before headers
        convertedContent = convertedContent.replace(/^(#+\s.*)/gm, '\n$1');

        // Convert Obsidian callouts to Quarto callouts
        convertedContent = convertedContent.replace(
            /> \[!(\w+)\](.*?)\n((?:>.*\n?)*)/g,
            (_, type, title, content) => {
                const quartoType = this.mapCalloutType(type);
                return `::: {.callout-${quartoType}}\n${title.trim() ? `## ${title.trim()}\n` : ''}${content.replace(/^>/gm, '').trim()}\n:::\n\n`;
            }
        );
        return convertedContent;
    }

    getFileTags(file: TFile): string[] {
        const fileCache = this.app.metadataCache.getFileCache(file);
        const tags: string[] = [];
        if (fileCache?.tags) {
            tags.push(...fileCache.tags.map(t => t.tag.replace('#', '')));
        }
        if (fileCache?.frontmatter?.tags) {
            if (Array.isArray(fileCache.frontmatter.tags)) {
                tags.push(...fileCache.frontmatter.tags);
            } else if (typeof fileCache.frontmatter.tags === 'string') {
                tags.push(fileCache.frontmatter.tags);
            }
        }
        return [...new Set(tags)]; // Remove duplicates
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
        const embeddedNoteRegex = /!\[\[([^\]]+)\]\]/g;
        const embedPromises: Promise<string>[] = [];

        content.replace(embeddedNoteRegex, (match, noteName) => {
            embedPromises.push(this.getEmbeddedNoteContent(noteName));
            return match; // This is necessary for the replace function, but we're not using its result
        });

        const embeddedContents = await Promise.all(embedPromises);

        return content.replace(embeddedNoteRegex, () => embeddedContents.shift() || '');
    }

    async getEmbeddedNoteContent(noteName: string): Promise<string> {
        const file = this.app.metadataCache.getFirstLinkpathDest(noteName, '');
        if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            return `\n\n## Embedded note: ${noteName}\n\n${content}\n\n`;
        } else {
            return `\n\n> [!warning] Embedded note not found: ${noteName}\n\n`;
        }
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

    private slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
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
            .setName('Output Folder')
            .setDesc('Specify the folder where QMD files should be saved (leave blank to use the same folder as the original file)')
            .addText(text => text
                .setPlaceholder('Enter folder path')
                .setValue(this.plugin.settings.outputFolder)
                .onChange(async (value) => {
                    this.plugin.settings.outputFolder = value;
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