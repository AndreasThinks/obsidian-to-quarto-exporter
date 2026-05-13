# Obsidian to Quarto Exporter

This plugin for Obsidian (https://obsidian.md) allows you to export your Obsidian notes to Quarto-compatible QMD files. It provides various options to customize the export process, including date formatting, tag handling, and output file management.

## Features

- Export Obsidian notes to Quarto-compatible QMD format
- Add creation or modification date to exported files
- Customize date format
- Option to include or exclude tags from Obsidian notes
- Specify output folder for exported files
- Choose to overwrite existing files or create new ones
- Converts Obsidian-specific syntax to Quarto-compatible format:
  - Wikilinks (`[[Page]]`, `[[Page|Display]]`) → Markdown links
  - Embedded notes (`![[Note]]`, with header `#` and block `^` references)
  - Images (`![[photo.png|200]]`) → Markdown image syntax
  - Mermaid diagrams (````mermaid` → ````{mermaid}`)
  - Block anchors (`^id`) → pandoc-crossref labels (`{#fig:|tbl:|lst:id}`)
  - Cross-references (`[#^id]`, `[#^id](#^id)`, `[text](#^id)`) → pandoc-crossref (`@fig:|tbl:|lst:id`)
  - Callouts (`> [!note]`) → Quarto callouts (`::: {.callout-note}`)
  - Highlight syntax (`==text==`) → `<mark>` tags
  - Display math (`$$...$$` on single line) → multi-line Quarto format

## Installation

### From the Obsidian Community Plugins

1. Open Obsidian Settings > Community Plugins
2. Disable Safe Mode
3. Click Browse community plugins
4. Search for "Quarto Exporter"
5. Click Install
6. Once installed, close the community plugins window and activate the newly installed plugin

### Manual Installation

1. Download `main.js` and `manifest.json` from the latest release on GitHub.
2. Create a folder named `quarto-exporter` in your vault: `<vault>/.obsidian/plugins/quarto-exporter/`
3. Copy `main.js` and `manifest.json` into that folder.
4. Reload Obsidian and enable the plugin in Settings > Community Plugins.

## Usage

1. Open the Obsidian note you want to export.
2. Use the command palette (Ctrl/Cmd + P) and search for "Export to Quarto QMD".
3. The plugin will create a new QMD file based on your settings.

## Settings

- **Date Option**: Choose to add creation date, modification date, or no date to the exported file.
- **Date Format**: Specify the format for the date (e.g., YYYY-MM-DD).
- **Output Folder**: Set a specific folder for exported files, or leave blank to use the same folder as the original note.
- **Overwrite Existing Files**: Choose whether to overwrite existing files or create new ones with incremented names.
- **Import Tags**: Decide whether to include tags from the Obsidian note in the exported Quarto file.

## Development

If you want to contribute to the development of this plugin, follow these steps:

1. Clone this repository.
2. Run `npm i` to install dependencies.
3. Run `npm run dev` to start compilation in watch mode.

## Support

If you encounter any issues or have feature requests, please file them in the Issues section of the GitHub repository.

## License

[MIT](LICENSE)
