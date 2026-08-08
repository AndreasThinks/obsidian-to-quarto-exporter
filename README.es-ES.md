

# Exportador de Obsidian a Quarto

Este complemento para Obsidian (https://obsidian.md) te permite exportar tus notas de Obsidian a archivos QMD compatibles con Quarto. Ofrece varias opciones para personalizar el proceso de exportación, incluido el formato de fecha, el manejo de etiquetas y la gestión de archivos de salida.

## Características

- Exporta notas de Obsidian al formato QMD compatible con Quarto
- Añade la fecha de creación o modificación a los archivos exportados
- Personaliza el formato de fecha
- Opción para incluir o excluir etiquetas de las notas de Obsidian
- Especifica la carpeta de salida para los archivos exportados
- Elige sobrescribir archivos existentes o crear nuevos
- Convierte la sintaxis específica de Obsidian a un formato compatible con Quarto:
  - Wikilinks (`[[Page]]`, `[[Page|Display]]`) → enlaces de Markdown
  - Notas incrustadas (`![[Note]]`, con referencias de encabezado `#` y bloque `^`)
  - Imágenes (`![[photo.png|200]]`) → sintaxis de imagen de Markdown
  - Diagramas Mermaid (````mermaid` → ````{mermaid}`)
  - Anclas de bloque (`^id`) → etiquetas pandoc-crossref (`{#fig:|tbl:|lst:id}`)
  - Referencias cruzadas (`[#^id]`, `[#^id](#^id)`, `[text](#^id)`) → pandoc-crossref (`@fig:|tbl:|lst:id`)
  - Callouts (`> [!note]`) → callouts de Quarto (`::: {.callout-note}`)
  - Sintaxis de resaltado (`==text==`) → etiquetas `<mark>`
  - Matemáticas en pantalla (`$$...$$` en una sola línea) → formato de varias líneas de Quarto

## Instalación

### Desde los Complementos de la Comunidad de Obsidian

1. Abre Configuración de Obsidian > Complementos de la comunidad
2. Desactiva el Modo Seguro
3. Haz clic en Explorar complementos de la comunidad
4. Busca "Quarto Exporter"
5. Haz clic en Instalar
6. Una vez instalado, cierra la ventana de complementos de la comunidad y activa el complemento recién instalado

### Instalación manual

1. Descarga `main.js` y `manifest.json` desde la última versión en GitHub.
2. Crea una carpeta llamada `quarto-exporter` en tu bóveda: `<vault>/.obsidian/plugins/quarto-exporter/`
3. Copia `main.js` y `manifest.json` en esa carpeta.
4. Recarga Obsidian y habilita el complemento en Configuración > Complementos de la comunidad.

## Uso

1. Abre la nota de Obsidian que deseas exportar.
2. Usa la paleta de comandos (Ctrl/Cmd + P) y busca "Export to Quarto QMD".
3. El complemento creará un nuevo archivo QMD según tu configuración.

## Configuración

- **Opción de fecha**: Elige añadir la fecha de creación, la fecha de modificación o ninguna fecha al archivo exportado.
- **Formato de fecha**: Especifica el formato para la fecha (p. ej., AAAA-MM-DD).
- **Carpeta de salida**: Establece una carpeta específica para los archivos exportados, o déjalo en blanco para usar la misma carpeta que la nota original.
- **Sobrescribir archivos existentes**: Elige si deseas sobrescribir archivos existentes o crear nuevos con nombres incrementados.
- **Importar etiquetas**: Decide si incluir las etiquetas de la nota de Obsidian en el archivo Quarto exportado.

## Desarrollo

Si deseas contribuir al desarrollo de este complemento, sigue estos pasos:

1. Clona este repositorio.
2. Ejecuta `npm i` para instalar las dependencias.
3. Ejecuta `npm run dev` para iniciar la compilación en modo observación (watch).

## Soporte

Si encuentras algún problema o tienes solicitudes de características, por favor preséntalas en la sección de Issues del repositorio de GitHub.

## Licencia

[MIT](LICENSE)
