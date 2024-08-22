# Obsidian to Quarto Exporter

This plugin for Obsidian (https://obsidian.md) allows you to export your Obsidian notes to Quarto-compatible QMD files. It provides various options to customize the export process, including date formatting, tag handling, and output file management.

## Features

- Export Obsidian notes to Quarto-compatible QMD format
- Add creation or modification date to exported files
- Customize date format
- Option to include or exclude tags from Obsidian notes
- Specify output folder for exported files
- Choose to overwrite existing files or create new ones
- Converts Obsidian-specific syntax to Quarto-compatible format

## Installation

1. Download the latest release from the GitHub releases page.
2. Extract the plugin folder from the zip to your vault's plugins folder: `<vault>/.obsidian/plugins/`
3. Reload Obsidian
4. If prompted about Safe Mode, you can disable safe mode and enable the plugin.
   Otherwise, head to Settings, third-party plugins, make sure safe mode is off and
   enable the plugin from there.

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

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-to-quarto-exporter/`.

## Support

If you encounter any issues or have feature requests, please file them in the Issues section of the GitHub repository.

## License

[MIT](LICENSE)