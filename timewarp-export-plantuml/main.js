const { clipboard } = require('electron');

function convertToPlantUML(elements) {
  let plantUML = '@startuml\n';

  elements.forEach((element) => {
    // Include element documentation as comments
    if (element.documentation && element.documentation.trim() !== '') {
      plantUML += `' ${element.documentation.split('\n').join('\n\' ')}\n`;
    }

    // Include AI tag information as comments
    const aiTag = element.tags.find(tag => tag.name === 'AI');
    if (aiTag && aiTag.value) {
      plantUML += `' AI_CMD: ${aiTag.value}\n`;
    }

    if (element instanceof type.UMLClass) {
      plantUML += `class ${element.name} {\n`;

      element.attributes.forEach((attribute) => {
        plantUML += `  ${attribute.visibility || ''} ${attribute.name}: ${attribute.type}\n`;
      });

      element.operations.forEach((operation) => {
        plantUML += `  ${operation.visibility || ''} ${operation.name}(${operation.parameters.map(param => param.name + ': ' + param.type).join(', ')}): ${operation.returnType}\n`;
      });

      plantUML += '}\n';
    } else if (element instanceof type.UMLAssociation) {
      const end1 = element.end1;
      const end2 = element.end2;
      plantUML += `${end1.reference.name} ${end1.multiplicity ? `"${end1.multiplicity}"` : ''} -- ${end2.multiplicity ? `"${end2.multiplicity}"` : ''} ${end2.reference.name}`;

      if (element.name) {
        plantUML += ` : ${element.name}`;
      }

      plantUML += '\n';

    }
  });

  plantUML += '@enduml';

  return plantUML;
}



function copySelectedToClipboard() {
  // Get the currently selected elements using the StarUML API
  const selectedModels = app.selections.getSelectedModels();

  // Convert the selected elements to PlantUML syntax
  const plantUMLCode = convertToPlantUML(selectedModels);

  // Copy the generated PlantUML code to the clipboard
  clipboard.writeText(plantUMLCode);
}

function convertFromPlantUML(plantUML) {
  const lines = plantUML.split('\n');
  let currentContainer = null;
  const elements = {}; // ID/Alias to Model map
  const createdRelationships = []; // Track relationships explicitly for later drawing

  // Auto-detect Diagram Type from PlantUML contents
  let isUseCaseDiagram = false;
  const plantUMLLower = plantUML.toLowerCase();
  if (plantUMLLower.includes("usecase ") || plantUMLLower.includes("usecase\n") || plantUMLLower.includes("actor ")) {
    isUseCaseDiagram = true;
  }

  // Get Target Parent (Selection or Project Root)
  let rootParent = (app.selections.getSelectedModels().length > 0) ? app.selections.getSelectedModels()[0] : app.project.getProject();

  // Phase 0: Validate Active Diagram or Create it
  let activeDiagram = app.diagrams.getCurrentDiagram();
  let expectedDiagramClass = isUseCaseDiagram ? "UMLUseCaseDiagram" : "UMLClassDiagram";

  if (!activeDiagram || activeDiagram.getClassName() !== expectedDiagramClass) {
    // Create a compatible diagram automatically if it doesn't match or doesn't exist
    try {
      activeDiagram = app.factory.createDiagram({
        id: expectedDiagramClass,
        parent: rootParent
      });
      // The creation automatically opens it and focuses it normally, but just to be sure:
      if (activeDiagram) {
        app.diagrams.setCurrentDiagram(activeDiagram);
      }
    } catch (e) {
      console.error("Failed to auto-create Diagram", e);
    }
  }

  // Container stack to support nested packages
  const containerStack = [];
  containerStack.push(rootParent);

  const visibilityMap = {
    '+': 'public',
    '-': 'private',
    '#': 'protected',
    '~': 'package',
    'public': 'public',
    'private': 'private',
    'protected': 'protected',
    'package': 'package'
  };

  lines.forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('@')) return;
    if (line.startsWith("'")) return; // ignore comments
    if (line.startsWith("skinparam") || line.startsWith("top to bottom direction")) return; // ignore diagram configs

    // Current parent is the top of the stack
    const parent = containerStack[containerStack.length - 1];

    // Package match
    let packageMatch = line.match(/^package\s+"?([^"{]+)"?\s*(?:as\s+([a-zA-Z0-9_]+))?\s*\{?/);
    if (packageMatch && !line.includes('}')) {
      let pkgName = packageMatch[1];
      let pkgId = packageMatch[2] || pkgName;
      let newPackage = app.factory.createModel({
        id: "UMLPackage",
        parent: parent,
        field: "ownedElements",
        modelInitializer: function (elem) {
          elem.name = pkgName;
        }
      });
      elements[pkgId] = newPackage;
      containerStack.push(newPackage);
      return;
    }

    // Entity Match (Class, Abstract Class, Interface, Enum, Actor, UseCase)
    // Examples: 
    // class Juego {
    // abstract class ContenedorRecurso {
    // enum TipoRecurso {
    // interface Atacable {
    // actor "Jugador" as J
    // usecase "Iniciar partida" as UC01

    let entityMatch = line.match(/^(abstract\s+class|class|interface|enum|actor|usecase)\s+"?([^"{]+)"?\s*(?:as\s+([a-zA-Z0-9_]+))?\s*\{?/);

    if (entityMatch) {
      let typeStr = entityMatch[1];
      let rawName = entityMatch[2];
      let alias = entityMatch[3] || rawName;

      let elementType = "UMLClass";
      let stereotype = "";
      let isAbstract = false;

      if (typeStr === 'abstract class') {
        isAbstract = true;
      } else if (typeStr === 'interface') {
        elementType = "UMLInterface";
      } else if (typeStr === 'enum') {
        elementType = "UMLEnumeration";
      } else if (typeStr === 'actor') {
        elementType = "UMLActor";
      } else if (typeStr === 'usecase') {
        elementType = "UMLUseCase";
      }

      currentContainer = app.factory.createModel({
        id: elementType,
        parent: parent,
        field: "ownedElements",
        modelInitializer: function (elem) {
          elem.name = rawName;
          if (isAbstract) elem.isAbstract = true;
        }
      });

      if (currentContainer) {
        elements[alias] = currentContainer;
        elements[rawName] = currentContainer; // Store by both names mapping
      }

      // If it's a one-liner (like actor or usecase without {}), don't set currentContainer to wait for attributes
      if (!line.includes('{')) {
        currentContainer = null;
      }
      return;
    }

    // Close block
    if (line === '}') {
      if (currentContainer) {
        currentContainer = null; // Close class/enum/interface
      } else if (containerStack.length > 1) {
        containerStack.pop(); // Close package
      }
      return;
    }

    // Parse contents of Class / Enum / Interface
    if (currentContainer) {
      // If it's an enum, it might just be literal values
      if (currentContainer instanceof type.UMLEnumeration) {
        let literalMatch = line.match(/^([a-zA-Z0-9_]+)$/);
        if (literalMatch) {
          app.factory.createModel({
            id: "UMLEnumerationLiteral",
            parent: currentContainer,
            field: "literals",
            modelInitializer: function (elem) {
              elem.name = literalMatch[1];
            }
          });
          return;
        }
      }

      // Operation match: optional visibility, name, (params), optional : returnType
      let opMatch = line.match(/^(?:([+\-#~]|public|private|protected|package)\s+)?([a-zA-Z0-9_]+)\((.*)\)(?:\s*:\s*(.*))?$/);
      if (opMatch && (currentContainer instanceof type.UMLClass || currentContainer instanceof type.UMLInterface)) {
        let visRaw = opMatch[1];
        let name = opMatch[2];
        let paramsStr = opMatch[3];
        let retType = opMatch[4];

        let op = app.factory.createModel({
          id: "UMLOperation",
          parent: currentContainer,
          field: "operations",
          modelInitializer: function (elem) {
            elem.name = name;
            elem.visibility = (visRaw && visibilityMap[visRaw]) ? visibilityMap[visRaw] : 'public';
          }
        });

        if (op && paramsStr && paramsStr.trim() !== '') {
          let params = paramsStr.split(',');
          params.forEach(p => {
            let pParts = p.split(':');
            let pName = pParts[0].trim();
            let pType = pParts[1] ? pParts[1].trim() : '';
            if (pType === 'undefined' || pType === 'null') pType = '';
            app.factory.createModel({
              id: "UMLParameter",
              parent: op,
              field: "parameters",
              modelInitializer: function (elem) {
                elem.name = pName;
                if (pType) elem.type = pType;
              }
            });
          });
        }

        if (op && retType && retType.trim() !== '' && retType !== 'undefined' && retType !== 'null') {
          app.factory.createModel({
            id: "UMLParameter",
            parent: op,
            field: "parameters",
            modelInitializer: function (elem) {
              elem.type = retType.trim();
              elem.direction = "return";
            }
          });
        }
        return;
      }

      // Attribute match: optional visibility, name, optional : type, optional = default
      let attrMatch = line.match(/^(?:([+\-#~]|public|private|protected|package)\s+)?([a-zA-Z0-9_]+)(?:\s*:\s*([^=]*))?(?:\s*=\s*(.*))?$/);
      if (attrMatch && (currentContainer instanceof type.UMLClass || currentContainer instanceof type.UMLInterface)) {
        let visRaw = attrMatch[1];
        let name = attrMatch[2];
        let typeInfo = attrMatch[3];
        let defaultValue = attrMatch[4];

        if (typeInfo === 'undefined' || typeInfo === 'null') {
          typeInfo = '';
        }

        app.factory.createModel({
          id: "UMLAttribute",
          parent: currentContainer,
          field: "attributes",
          modelInitializer: function (elem) {
            elem.name = name;
            if (typeInfo) elem.type = typeInfo.trim();
            if (defaultValue) elem.defaultValue = defaultValue.trim();
            elem.visibility = (visRaw && visibilityMap[visRaw]) ? visibilityMap[visRaw] : 'public';
          }
        });
        return;
      }
    } else {
      // Relationships match
      // Covers: A -- B, A --> B, A <|-- B, A *-- B, A o-- B, A ..> B, A <|.. B
      // Matches: Source, SourceMult(opt), LinkType, TargetMult(opt), Target, Name(opt)
      // Regex simplified to capture the link symbols correctly
      let relMatch = line.match(/^"?([a-zA-Z0-9_]+)"?\s*(?:"([^"]+)")?\s*([<|.*o+]*--+[-]*[>|.*o+]*|[<|.*o+]*\.\.+[\.]*[>|.*o+]*)\s*(?:"([^"]+)")?\s*"?([a-zA-Z0-9_]+)"?(?:\s*:\s*(.*))?$/);

      if (relMatch) {
        let el1Name = relMatch[1];
        let mult1 = relMatch[2];
        let linkStr = relMatch[3];
        let mult2 = relMatch[4];
        let el2Name = relMatch[5];
        let relName = relMatch[6];

        let el1 = elements[el1Name];
        let el2 = elements[el2Name];

        if (el1 && el2) {
          let relType = "UMLAssociation";
          let agg1 = "none";
          let agg2 = "none";
          let dir1 = false;
          let dir2 = false;

          // Determine relation type based on link string
          if (linkStr.includes("<|--") || linkStr.includes("--|>")) {
            relType = "UMLGeneralization";
            // A <|-- B means B generalizes A (B is subclass of A)
            // In PlantUML, A is the parent. In StarUML, source is child, target is parent.
            if (linkStr.includes("<|--")) {
              // Parent <|-- Child
              let temp = el1; el1 = el2; el2 = temp;
            }
          } else if (linkStr.includes("<|..") || linkStr.includes("..|>")) {
            relType = "UMLInterfaceRealization";
            if (linkStr.includes("<|..")) {
              // Interface <|.. Class
              let temp = el1; el1 = el2; el2 = temp;
            }
          } else if (linkStr.includes("*--") || linkStr.includes("--*")) {
            relType = "UMLAssociation";
            if (linkStr.includes("*--")) agg1 = "composite";
            if (linkStr.includes("--*")) agg2 = "composite";
          } else if (linkStr.includes("o--") || linkStr.includes("--o")) {
            relType = "UMLAssociation";
            if (linkStr.includes("o--")) agg1 = "shared"; // aggregation
            if (linkStr.includes("--o")) agg2 = "shared";
          } else if (linkStr.includes("-->") || linkStr.includes("<--")) {
            // Dependency or Directed Association?
            // For UseCases and Actors, often associations are directed -->
            if (el1 instanceof type.UMLActor || el2 instanceof type.UMLActor ||
              el1 instanceof type.UMLUseCase || el2 instanceof type.UMLUseCase) {
              relType = "UMLAssociation"; // actors/usecases usually just associate
              if (linkStr.includes("-->")) dir2 = true;
              if (linkStr.includes("<--")) dir1 = true;
            } else if (linkStr.includes("..>") || linkStr.includes("<..")) {
              relType = "UMLDependency";
              if (linkStr.includes("<..")) {
                let temp = el1; el1 = el2; el2 = temp;
              }
            } else {
              relType = "UMLAssociation";
              if (linkStr.includes("-->")) dir2 = true;
              if (linkStr.includes("<--")) dir1 = true;
            }
          } else if (linkStr.includes("..>") || linkStr.includes("<..")) {
            relType = "UMLDependency";
            if (linkStr.includes("<..")) {
              let temp = el1; el1 = el2; el2 = temp;
            }
          } else if (linkStr === ".." || linkStr === "--") {
            relType = "UMLAssociation";
          }

          // Note: <<include>> / <<extend>> on dependencies
          let stereotype = null;
          if (relName && relName.includes('<<include>>')) {
            relType = "UMLInclude";
            relName = null;
          } else if (relName && relName.includes('<<extend>>')) {
            relType = "UMLExtend";
            relName = null;
          }

          // Instead of creating the Model immediately which fails on some relational types,
          // we store the blueprint and use createModelAndView during Phase 2.
          createdRelationships.push({
            relType: relType,
            el1: el1,
            el2: el2,
            relName: relName,
            agg1: agg1,
            agg2: agg2,
            dir1: dir1,
            dir2: dir2,
            mult1: mult1,
            mult2: mult2
          });
        }
      }
    }
  });

  // Phase 2: Create Views in the active Diagram
  const currentDiagram = app.diagrams.getCurrentDiagram();
  if (currentDiagram) {
    let currentX = 100;
    let currentY = 100;
    const xSpacing = 800; // Increased horizontal spacing (x4)
    const ySpacing = 400; // Increased vertical spacing (x2)
    const maxRowElements = 6; // slightly wider grid
    let elementsInRow = 0;

    // Extract all root entities we created (Packages, Classes, Interfaces, UseCases, Actors)
    // Exclude simple text relationships, attributes, operations since they belong to containers
    const rootModels = Object.values(elements).filter(model => {
      return (model instanceof type.UMLClass ||
        model instanceof type.UMLInterface ||
        model instanceof type.UMLEnumeration ||
        model instanceof type.UMLActor ||
        model instanceof type.UMLUseCase ||
        model instanceof type.UMLPackage);
    });

    // Deduplicate the list (since elements dictionary might store the same model by alias and rawName)
    const uniqueRootModels = [...new Set(rootModels)];

    let viewsCreated = [];
    let modelToView = {}; // Map to track model -> view for connections

    if (isUseCaseDiagram) {
      // --- SMART USE CASE LAYOUT ---

      const actors = [];
      const useCases = [];
      const others = [];

      // 1. Categorize Models
      uniqueRootModels.forEach(model => {
        if (model instanceof type.UMLActor) actors.push(model);
        else if (model instanceof type.UMLUseCase) useCases.push(model);
        else others.push(model);
      });

      // 2. Map Relationships
      // actorId -> Set of useCaseIds
      const actorToUseCases = {};
      // useCaseId -> Set of actorIds
      const useCaseToActors = {};

      actors.forEach(a => actorToUseCases[a._id] = new Set());
      useCases.forEach(uc => useCaseToActors[uc._id] = new Set());

      createdRelationships.forEach(rel => {
        const id1 = rel.el1._id;
        const id2 = rel.el2._id;

        if (actorToUseCases[id1] && useCaseToActors[id2]) {
          actorToUseCases[id1].add(id2);
          useCaseToActors[id2].add(id1);
        } else if (actorToUseCases[id2] && useCaseToActors[id1]) {
          actorToUseCases[id2].add(id1);
          useCaseToActors[id1].add(id2);
        }
      });

      // 3. Categorize UseCases
      const exclusiveUseCases = {}; // actorId -> Array of useCase models
      const sharedUseCases = [];    // Array of useCase models connected to >1 actor
      const orphanUseCases = [];    // Array of useCase models connected to 0 actors

      actors.forEach(a => exclusiveUseCases[a._id] = []);

      useCases.forEach(uc => {
        const connectedActors = Array.from(useCaseToActors[uc._id]);
        if (connectedActors.length === 1) {
          exclusiveUseCases[connectedActors[0]].push(uc);
        } else if (connectedActors.length > 1) {
          sharedUseCases.push(uc);
        } else {
          orphanUseCases.push(uc);
        }
      });

      // Helper to create view
      const createViewSafe = (model, x, y, containerView = null) => {
        try {
          let options = { model: model, diagram: currentDiagram, x: x, y: y };
          if (containerView) {
            options.containerView = containerView;
          }
          let view = app.factory.createViewOf(options);
          if (view) {
            view.showNamespace = false;
            // Provide a generous width for UseCases based on text length to avoid cropping
            if (model.name && model instanceof type.UMLUseCase) {
              view.width = Math.max(120, model.name.length * 8 + 30);
            }
            if (model.name && model instanceof type.UMLPackage) {
              view.width = Math.max(150, model.name.length * 10 + 40);
              view.height = 100; // Default minimum height
            }
            modelToView[model._id] = view;
            viewsCreated.push(view);
          }
          return view;
        } catch (e) {
          console.error("Failed to create view for", model.name, e);
          return null;
        }
      };

      // Helper to fetch direct owning Package View if any
      const getPackageContainerView = (model) => {
        if (model._parent && model._parent instanceof type.UMLPackage) {
          return modelToView[model._parent._id] || null;
        }
        return null; // Root or other parent
      };

      // Helper to layout a group of usecases (returns height used)
      const layoutUseCaseGroup = (ucs, startX, startY, parentActorId = null) => {
        let maxUcYOffset = 0;
        let ucX = startX;
        let ucY = startY;

        ucs.forEach((uc, index) => {
          let containerView = getPackageContainerView(uc);
          createViewSafe(uc, ucX, ucY, containerView);

          ucX += X_SPACING;
          if (index % 2 !== 0 && index < ucs.length - 1) {
            // New row of use cases
            ucX = startX;
            ucY += Y_SPACING;
            maxUcYOffset += Y_SPACING;
          }
        });
        return maxUcYOffset;
      };

      // 4. Position Layout
      const START_X = 100;
      let currentActorY = 100;
      const ACTOR_X = START_X;
      const Y_SPACING = 150;
      const X_SPACING = 300; // Increased spacing

      // Track Actor Y positions for avergaging shared use cases later
      const actorYPositions = {};


      // Hierarchical Actor Sorting
      const actorHierarchy = {}; // parentId -> array of child models
      const childActors = new Set(); // to identify roots

      actors.forEach(a => actorHierarchy[a._id] = []);

      createdRelationships.forEach(rel => {
        if (rel.relType === "UMLGeneralization") {
          // tail is child (el1), head is parent (el2)
          if (rel.el1 instanceof type.UMLActor && rel.el2 instanceof type.UMLActor) {
            if (actorHierarchy[rel.el2._id]) {
              actorHierarchy[rel.el2._id].push(rel.el1);
              childActors.add(rel.el1._id);
            }
          }
        }
      });

      const rootActors = actors.filter(a => !childActors.has(a._id));
      const sortedActors = [];
      const actorLevels = {};

      const traverseActor = (actor, level) => {
        sortedActors.push(actor);
        actorLevels[actor._id] = level;
        actorHierarchy[actor._id].forEach(child => traverseActor(child, level + 1));
      };

      rootActors.forEach(root => traverseActor(root, 0));
      // Add any actors that might be part of a cycle or disconnected
      actors.forEach(a => {
        if (actorLevels[a._id] === undefined) traverseActor(a, 0);
      });

      // A.0 Draw Packages first (so they act as containers behind the use cases in the Z-order)
      // We will place them initially at a temporary location, then auto-fit them later.
      const packages = others.filter(m => m instanceof type.UMLPackage);
      packages.forEach(pkg => {
        createViewSafe(pkg, 0, 0);
      });

      // A. Draw Actors and their Exclusive UseCases
      let currentExclusiveStartX = START_X + 400; // Base starting X for exclusive use cases
      let maxExclusiveX = currentExclusiveStartX; // Track maximum X reached for placing shared use cases later

      sortedActors.forEach(actor => {
        // Draw Actor with Indentation based on Hierarchy Level
        let level = actorLevels[actor._id] || 0;
        let actX = ACTOR_X + (level * 50);

        let containerView = getPackageContainerView(actor);
        let actorView = createViewSafe(actor, actX, currentActorY, containerView);
        let actorCenterY = currentActorY + 40; // rough center

        if (actorView) {
          actorYPositions[actor._id] = actorCenterY;
        }

        let ucs = exclusiveUseCases[actor._id] || [];
        let ucX = currentExclusiveStartX;
        let ucY = currentActorY; // start drawing ucs aligned with actor top

        let maxUcYOffset = layoutUseCaseGroup(ucs, ucX, ucY, actor._id);

        // Track the maximum X we reach
        let furthestXThisActor = ucX + (ucs.length > 1 ? X_SPACING : 0);
        if (furthestXThisActor > maxExclusiveX) {
          maxExclusiveX = furthestXThisActor;
        }

        // Advance Y for the next Actor
        currentActorY += Math.max(Y_SPACING * 1.5, maxUcYOffset + Y_SPACING);

        // Advance X offset for the next Actor's grid
        if (ucs.length > 0) {
          currentExclusiveStartX += 500;
        }
      });

      // B. Draw Shared Use Cases
      let sharedUcY = 100;
      let SHARED_UC_X = maxExclusiveX + 400; // Dynamically place shared cases to the right of everything

      sharedUseCases.forEach((uc, index) => {
        // Attempt to place it at the average Y of connected actors to minimize crossing
        const connectedActors = Array.from(useCaseToActors[uc._id]);
        let sumY = 0;
        let count = 0;
        connectedActors.forEach(aId => {
          if (actorYPositions[aId] !== undefined) {
            sumY += actorYPositions[aId];
            count++;
          }
        });

        let targetY = count > 0 ? (sumY / count) : sharedUcY;

        if (index > 0 && Math.abs(targetY - sharedUcY) < Y_SPACING) {
          targetY = sharedUcY + Y_SPACING;
        }

        let containerView = getPackageContainerView(uc);
        createViewSafe(uc, SHARED_UC_X, targetY, containerView);
        sharedUcY = targetY; // track last placed
      });

      // C. Draw Orphans and Others
      let orphanX = START_X;
      let orphanY = Math.max(currentActorY, sharedUcY + Y_SPACING);

      [...orphanUseCases, ...others.filter(m => !(m instanceof type.UMLPackage))].forEach(model => {
        let containerView = getPackageContainerView(model);
        createViewSafe(model, orphanX, orphanY, containerView);
        orphanX += X_SPACING;
        if (orphanX > START_X + 1200) {
          orphanX = START_X;
          orphanY += Y_SPACING;
        }
      });

      // D. Auto-size Packages to wrap their children
      // We must do this after all children are placed. StarUML automatically expands containers but
      // sometimes requires an explicit resize command or a manual drag. We'll set a generous size 
      // based on children content.
      packages.forEach(pkg => {
        let pkgView = modelToView[pkg._id];
        if (pkgView) {
          // Manually search all created views for those whose model belongs to this package
          const childViews = viewsCreated.filter(v => v.model && v.model._parent && v.model._parent._id === pkg._id);

          if (childViews.length > 0) {
            let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE, maxX = 0, maxY = 0;
            childViews.forEach(cv => {
              if (cv.left < minX) minX = cv.left;
              if (cv.top < minY) minY = cv.top;
              if (cv.left + cv.width > maxX) maxX = cv.left + cv.width;
              if (cv.top + cv.height > maxY) maxY = cv.top + cv.height;
            });

            // Apply Bounds padding
            pkgView.left = minX - 40;
            pkgView.top = minY - 50;
            pkgView.width = (maxX - minX) + 80;
            pkgView.height = (maxY - minY) + 90;
          } else {
            // If completely empty, at least give it some dimensions
            pkgView.width = 150;
            pkgView.height = 100;
          }
        }
      });

    } else {
      // --- DEFAULT GRID LAYOUT (Classes, etc) ---

      uniqueRootModels.forEach(model => {
        let view = null;
        try {
          view = app.factory.createViewOf({
            model: model,
            diagram: currentDiagram,
            x: currentX,
            y: currentY
          });

          if (view) {
            view.showNamespace = false;
            if (model.name) {
              view.width = Math.max(100, model.name.length * 10);
            }
            modelToView[model._id] = view; // Store mapping for edge tying
          }
        } catch (e) {
          console.error("Failed to create view for", model.name, e);
        }

        if (view) {
          viewsCreated.push(view);

          // Update grid position
          elementsInRow++;
          if (elementsInRow >= maxRowElements) {
            elementsInRow = 0;
            currentX = 100;
            currentY += ySpacing;
          } else {
            currentX += xSpacing;
          }
        }
      });
    }

    // Attempt to automatically draw relations for the new views using createModelAndView
    createdRelationships.forEach(rel => {
      try {
        if (rel.el1 && rel.el2 && modelToView[rel.el1._id] && modelToView[rel.el2._id]) {
          let relView = app.factory.createModelAndView({
            id: rel.relType,
            diagram: currentDiagram,
            tailModel: rel.el1,
            headModel: rel.el2,
            tailView: modelToView[rel.el1._id],
            headView: modelToView[rel.el2._id]
          });

          if (relView && relView.model) {
            let relModel = relView.model;
            if (rel.relName && rel.relName.trim() !== '') {
              relModel.name = rel.relName.trim();
            }
            if (rel.relType === "UMLAssociation") {
              relModel.end1.aggregation = rel.agg1;
              relModel.end1.navigable = rel.dir1;
              if (rel.mult1) relModel.end1.multiplicity = rel.mult1;

              relModel.end2.aggregation = rel.agg2;
              relModel.end2.navigable = rel.dir2;
              if (rel.mult2) relModel.end2.multiplicity = rel.mult2;
            }
          }
        }
      } catch (e) {
        console.error("Failed to draw relationship", e);
      }
    });

    if (app.diagrams.getEditor && app.diagrams.getEditor().canvas) {
      app.diagrams.repaint();
    }
  }
}

function importFromPlantUMLClipboard() {
  const plantUMLCode = clipboard.readText();
  if (plantUMLCode) {
    convertFromPlantUML(plantUMLCode);
  }
}

function init() {
  app.commands.register('export-plantuml:copy-to-clipboard', copySelectedToClipboard);
  app.commands.register('import-plantuml:from-clipboard', importFromPlantUMLClipboard);
}

exports.init = init;
