# Kripta Studios: StarUML <-> PlantUML Converter

This repository contains a bidirectional plugin to convert StarUML models to PlantUML diagrams, and seamlessly import PlantUML code back into StarUML structural visual nodes. It's a simple, fast, and easy-to-use tool built natively for the StarUML Editor.

## Features

- **Bidirectional Support**: Export models to textual PlantUML syntax, and Import textual PlantUML syntax to StarUML nodes.
- Extracts and reads **UML Packages** with unlimited nesting.
- Supports **UML Classes, Interfaces, Abstract Classes, Enumerations (with Literals), Actors, and UseCases**.
- Maps class **Attributes**, **Operations** (with parameters and return types), and their visibility modifiers.
- Supports all core **Relations**: Associations, Generalizations, Interface Realizations, Dependencies, Extends, and Includes.
- Supports multiplicities mappings on relations.
- Includes element documentation natively.
- **Auto-Detect Diagram Type**: Automatically detects if the imported PlantUML snippet describes Use Cases or Classes, and builds the optimal StarUML Diagram (UseCaseDiagram or ClassDiagram) dynamically.
- **Auto-Grid Layout**: Nodes imported from PlantUML text are automatically placed using an organized grid layout and connected with their respective structural relations.

## How to use

### Exporting to PlantUML
1. Install the plugin by copying the `timewarp-export-plantuml` folder inside your StarUML `extensions/user` path.
2. Open your StarUML model.
3. Select the elements you want to include in the PlantUML diagram from the Model Explorer.
4. Press `Ctrl+Cmd+Shift+C` on Windows/macOS or select the menu item "Tools > Export Selected to PlantUML".
5. The PlantUML syntax will be copied to your clipboard.

### Importing from PlantUML
1. Copy any valid PlantUML diagram definition to your clipboard (e.g. from ChatGPT or a text file).
2. Inside StarUML, select the target Model or Package in the Model Explorer where you want the elements to reside.
3. Press `Ctrl+Shift+V` on Windows/Linux or `Cmd+Shift+V` on macOS, or select the menu item "Tools > Import PlantUML from Clipboard".
4. The requested UML elements will be automatically instantiated in the Model Explorer! Drag them to a diagram to visualize.

## Limitations

- The parser focuses on structural mappings. Detailed graphical formatting or layout positioning from PlantUML (notes, specific colors) are not currently persisted inside StarUML.

## License & Credits

Developed and Maintained by **Kripta Studios**.
Licensed under the MIT License.
