# Video Storyboard for StarUML to PlantUML Converter

## 1. Introduction
- Briefly introduce the StarUML <-> PlantUML Converter plugin and its bidirectional purpose.
- Highlight the key value proposition: Bridging the gap between the visual structural design of StarUML and the textual, AI-friendly format of PlantUML.

## 2. Exporting from StarUML to PlantUML
- Open a sample StarUML model with various elements (Classes, Interfaces, attributes, operations, and associations).
- Showcase adding documentation to elements and AI tags to specific components.
- Select the targeted elements in the Model Explorer and export them using the hotkey (`Ctrl+Cmd+Shift+C`) or the menu.
- Paste the generated PlantUML syntax into a text editor or the PlantUML Online Server to show the perfectly replicated textual syntax.

## 3. Powering up with AI (ChatGPT / Claude)
- Paste the generated PlantUML text into an LLM interface (e.g., ChatGPT).
- Ask the AI to: "Based on these domain classes, please generate a PlantUML UseCase diagram proposing the core system interactions and actors."
- Wait for the LLM to output the textual PlantUML UseCase diagram code.

## 4. Importing back into StarUML (The Magic)
- Copy the AI-generated PlantUML UseCase diagram code to the clipboard.
- Switch back to StarUML, select the project root, and press the Import hotkey (`Ctrl+Shift+V`).
- Show the magic: The plugin immediately analyzes the text, **Auto-Detects** that it's a UseCase diagram, creates the proper Diagram view, instantiates all Actors and UseCases, **Auto-Layouts** them in a grid, and draws the association arrows correctly.

## 5. Round Tripping & Conclusion
- Demonstrate how users can freely move between graphical UML (StarUML) and textual UML (PlantUML) to leverage AI generation seamlessly.
- Recap the core features: Nested Packages, Attributes, Operations, Relations, multiplicities, Auto-Diagram Type, and Auto-Grid.
- Point to the GitHub repo to download the plugin.
