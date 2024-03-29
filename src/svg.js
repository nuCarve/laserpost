/**************************************************************************************
 *
 * LaserPost module: svg.js
 *
 * SVG file syntax services
 *
 *************************************************************************************/

// shared object to track the in-progress path
let activePath;

/**
 * Adjust the coordinate translation to match working space of SVG
 */
function onTranslateSetup() {
  project.translate.x = false;
  project.translate.y = true;
}

/**
 * Write the generic SVG file header
 *
 * @param layer Layer (cutSetting) being generated (-1 for all layers)
 */
function onFileCreate(layer) {
  writeln('<?xml version="1.0" encoding="utf-8"?>');
}

/**
 * Writes the SVG (.svg) header information
 *
 * @param layer Layer (cutSetting) being generated (-1 for all layers)
 */
function onWriteHeader(layer) {
  let maxX = project.box.maxX + getProperty('work0200OffsetX', OFFSET_X_AXIS_DEFAULT);
  let maxY = project.box.maxY + getProperty('work0300OffsetY', OFFSET_X_AXIS_DEFAULT);

  // output notes, including layer notes, to the header
  const headerNotes = projectNotes.concat(
    globalNotes.concat(generateLayerNotes(layer, false))
  );
  debugLog('');
  for (let noteIndex = 0; noteIndex < headerNotes.length; ++noteIndex)
    debugLog(headerNotes[noteIndex]);
  debugLog('');

  // write the header, with X and Y flipped to match SVG coordinate space
  writeXML(
    'svg',
    {
      version: '1.1',
      xmlns: 'http://www.w3.org/2000/svg',
      xmlns_xlink: 'http://www.w3.org/1999/xlink',
      width: mmFormatWithUnits(maxX + 1),
      height: mmFormatWithUnits(maxY + 1),
      viewbox: format('{minX} {minY} {maxX} {maxY}', {
        minX: 0,
        minY: 0,
        maxX: mmFormat(maxX + 1),
        maxY: mmFormat(maxY + 1),
      }),
    },
    true
  );
  writeXML('desc', { content: generatedBy });
  writeln('');

  activePath = { path: '', cutSetting: { index: -1 } };
}

/**
 * Writes the shapes (<Shape>) to the SVG file, including grouping as necessary
 *
 * @param layer Layer (cutSetting) being generated
 */
function onWriteShapes(layer) {
  const projLayer = project.layers[layer];
  const useGroups = !!getProperty(
    'laserpost0200GroupShapes',
    GROUP_SHAPES_DEFAULT
  );

  // create a group if there is more than one item in the layer, we are grouping by layer and
  // we are not redirecting (and using grouping)
  if (
    projLayer.operationSets.length > 1 &&
    projLayer.index != -1 &&
    useGroups
  ) {
    debugLog(localize('Layer group: "{name}"'), {
      name: projLayer.name,
    });

    writeXML('g', { id: safeId(projLayer.name) }, true);
    writeXML('desc', {
      content: format(localize('Layer group: "{name}"'), {
        name: projLayer.name,
      }),
    });
  }

  // process all operation groups.  These are groups of operations and generate a grouping for
  // SVG when there is more than one operation in the group (when the group name property has
  // been used by the user)
  for (
    let setIndex = 0;
    setIndex < projLayer.operationSets.length;
    ++setIndex
  ) {
    const opGroup = projLayer.operationSets[setIndex];

    // do we have more than one operation in this group?  If so, and enabled, go ahead and group it
    if (opGroup.operations.length > 1 && useGroups) {
      debugLog(localize('Operation group: "{name}"'), {
        name: opGroup.groupName,
      });

      writeXML('g', { id: safeId(opGroup.groupName) }, true);
      writeXML('desc', {
        content: format(localize('Operation group: "{name}"'), {
          name: opGroup.groupName,
        }),
      });
    }

    // process all operations within the group
    for (
      let operationIndex = 0;
      operationIndex < opGroup.operations.length;
      ++operationIndex
    ) {
      const operation = opGroup.operations[operationIndex];

      debugLog(localize('Operation: {name}'), {
        name: operation.operationName,
      });

      // add groups around operations if allowed (note: we do not look at number of shape sets,
      // because those generally all get merged into one 'path' element, but having the grouping
      // helps because it adds the 'desc' property)
      if (useGroups) {
        writeXML('g', { id: safeId(operation.operationName) }, true);
        writeXML('desc', {
          content: format(localize('Operation: {name}'), {
            name: operation.operationName,
          }),
        });
      }

      // loop through all shapes within this operation
      for (
        let shapeSetsIndex = 0;
        shapeSetsIndex < operation.shapeSets.length;
        ++shapeSetsIndex
      ) {
        const shape = operation.shapeSets[shapeSetsIndex];

        // set the name and id for the path
        activePath.name = operation.operationName;
        activePath.id = 1;

        // write the shape, based on it's type
        if (shape.type == SHAPE_TYPE_ELLIPSE) writeShapeEllipse(shape);
        else writeShapePath(shape);
      }
      closeShapePath();

      // if we grouped the shapes, close the group
      if (useGroups) writeXMLClose();
    }

    // if we grouped these operations, close the group now
    if (opGroup.operations.length > 1 && useGroups) writeXMLClose();
  }

  // close the layer group if created
  if (
    projLayer.operationSets.length > 1 &&
    projLayer.index != -1 &&
    useGroups
  ) {
    writeXMLClose();
  }
}

/**
 * Writes the SVG trailer information by closing off the XML opened in `onWriteHeader`.
 *
 * @param layer Layer (cutSetting) being generated (-1 for all layers)
 */
function onWriteTrailer(layer) {
  writeXMLClose();
}

/**
 * Project complete (all files written) - use this event to write the final setup notes file
 *
 * @param redirect `true` if redirecting for layer-per-file, `false` if one file holds everything
 */
function onProjectComplete(redirect) {
  // determine if we include the setup notes file
  const includeNotes = getProperty(
    'laserpost0400IncludeNotes',
    INCLUDE_NOTES_DEFAULT
  );
  if (includeNotes != INCLUDE_NOTES_NONE) {
    // determine if we should tell the user via a warning dialog that the notes are available
    let showNotesWarning = false;
    if (includeNotes == INCLUDE_NOTES_SHOW_IMPORTANT)
      showNotesWarning = notesImportant;
    else if (includeNotes == INCLUDE_NOTES_SHOW) showNotesWarning = true;

    // write notes to the <programName>-setup.txt file (we could write to svg using <text>, but
    // many laser programs either render these poorly or fail to load them at all)
    const path = FileSystem.getCombinedPath(
      FileSystem.getFolderPath(getOutputPath()),
      programName + '-setup.txt'
    );
    redirectToFile2(path);
    const setupNotes = projectNotes.concat(
      globalNotes.concat(generateLayerNotes(-1, redirect))
    );
    for (let noteIndex = 0; noteIndex < setupNotes.length; ++noteIndex)
      writeln(setupNotes[noteIndex]);
    closeRedirection2();

    // tell the user if they requested it
    if (notesImportant)
      showWarning(
        localize(
          'There are important notes you should review in the generated job setup file.  Please see:\n\n{path}'
        ),
        { path: path }
      );
    else if (showNotesWarning)
      showWarning(
        localize(
          'Job setup information has been generated in the file:\n\n{path}'
        ),
        { path: path }
      );
  }
}

/**
 * Write a comment formatted for XML to the file including a newine at the end.  Supports template
 * strings (see `format`)
 *
 * @param template Message to write to the XML file as a comment (or blank line if empty or blank)
 * @param parameters Optional key/value dictionary with parameters from template (such as {name})
 */
function writeCommentLine(template, parameters) {
  let text = format(template, parameters);
  text = text.replace(/[ \n]+$/, '');

  if (text == '') writeln('');
  else writeBlock('<!-- ' + text + ' -->');
}

/**
 * Generates a string array with notes about the layer setup
 *
 * @param layer Layer (cutSetting) being generated (-1 for all layers)
 * @param showFilename `true` to show filename with layers, `false` to show colors
 * @returns String array with layer notes
 */
function generateLayerNotes(layer, showFilename) {
  const result = [];

  // determine which layers to generated based on `layer` and showFilename properties
  // When layer is >= 0, we do that specific layer.  When layer == -1, we are doing
  // all layers ... but we do only a single top-level loop when showFilename is false
  // because the layers are shared by a single file, but when showFilename is true we
  // need to loop for all layers to individually show their settings
  const startLayer = layer == -1 ? 0 : layer;
  const endLayer =
    layer == -1 ? (showFilename ? project.layers.length : 1) : layer + 1;

  // include header based on organization by file/layer or just layer
  if (showFilename) result.push(localize('Files:'));
  else result.push(localize('Layers:'));

  // process requested layers
  for (let layerIndex = startLayer; layerIndex < endLayer; ++layerIndex) {
    const cutSettings = project.layers[layerIndex].cutSettings;

    // break out into filename per layer section if requested
    if (showFilename)
      result.push(
        format('  ' + localize('File {file}:'), {
          file: project.layers[layerIndex].filename,
        })
      );

    // scan the top-level cutSettings (on project) as this contains all layers and not the per-layer settings
    // (since this file is shared across all generated files)
    for (
      let cutSettingsIndex = 0;
      cutSettingsIndex < cutSettings.length;
      ++cutSettingsIndex
    ) {
      const cutSetting = cutSettings[cutSettingsIndex];

      // include layer details
      result.push(
        format(
          '  ' +
            (showFilename ? '  ' : '') +
            localize('Layer {layer} ({color}): {name}'),
          {
            layer: cutSettingsIndex,
            color: cutIndexToColorName(cutSetting.index),
            name: cutSetting.name,
          }
        )
      );

      const laserNames = {};
      laserNames[LASER_ENABLE_OFF] = localize('lasers off');
      laserNames[LASER_ENABLE_1] = localize('laser 1');
      laserNames[LASER_ENABLE_2] = localize('laser 2');
      laserNames[LASER_ENABLE_BOTH] = localize('lasers 1 and 2');

      let layerMode;
      switch (cutSetting.layerMode) {
        case LAYER_MODE_LINE:
          layerMode = localize('cut');
          break;
        case LAYER_MODE_FILL:
          layerMode = localize('fill');
          break;
        case LAYER_MODE_OFFSET_FILL:
          layerMode = localize('outline fill');
          break;
      }

      if (cutSetting.laserEnable !== LASER_ENABLE_OFF) {
        if (advancedFeature())
            result.push(
              format(
                '    ' +
                (showFilename ? '  ' : '') +
                localize(
                    'Laser "{mode}" at power {min}-{max}% (scale {scale}%) and {speed} using {lasers} (air {air}, Z offset {zOffset}, passes {passes}, z-step {zStep})'
                ),
                {
                min: cutSetting.minPower,
                max: cutSetting.maxPower,
                speed: speedToUnits(cutSetting.speed),
                lasers: laserNames[cutSetting.laserEnable],
                air: cutSetting.useAir ? localize('on') : localize('off'),
                zOffset: cutSetting.zOffset,
                passes: cutSetting.passes,
                zStep: cutSetting.zStep,
                scale: cutSetting.powerScale,
                mode: layerMode,
                }
            )
        );
      } else {
        // laser is off
        result.push(
          format(
            '    ' + (showFilename ? '  ' : '') + localize('Laser turned off')
          )
        );
      }
    }
  }

  return result;
}

/**
 * Write an ellipse (a closed circle) to the SVG file
 *
 * @param shape Shape information (cutSetting, radius, centerX, centerY) to write
 */
function writeShapeEllipse(shape) {
  // if different layer specs are used, close the shape and save the new layer index
  if (shape.cutSetting.index != activePath.cutSetting.index) {
    closeShapePath();
    activePath.cutSetting = shape.cutSetting;
  }

  const start = { x: shape.centerX, y: shape.centerY };

  // construct the ellipse using two have arcs
  activePath.path +=
    (activePath.path == '' ? '' : ' ') +
    'M ' +
    mmFormat(start.x - shape.radius) +
    ',' +
    mmFormat(start.y) +
    ' A ' +
    mmFormat(shape.radius) +
    ',' +
    mmFormat(shape.radius) +
    ' 0 0 1 ' +
    mmFormat(start.x + shape.radius) +
    ',' +
    mmFormat(start.y) +
    ' A ' +
    mmFormat(shape.radius) +
    ',' +
    mmFormat(shape.radius) +
    ' 0 0 1 ' +
    mmFormat(start.x - shape.radius) +
    ',' +
    mmFormat(start.y);
}

/**
 * Write a path (lines and beziers) to the SVG file.
 *
 * @param shape Shape information (cutSetting, vectors[], primitives[]) to write
 */
function writeShapePath(shape) {
  // if different layer specs are used, close the shape and save the new layer index
  if (shape.cutSetting.index != activePath.cutSetting.index) {
    closeShapePath();
    activePath.cutSetting = shape.cutSetting;
  }

  // track our current position based on the primitive id, to know if we need to do a move
  let currentPrimitive = undefined;

  for (
    let shapePrimitiveIndex = 0;
    shapePrimitiveIndex < shape.primitives.length;
    ++shapePrimitiveIndex
  ) {
    const primitive = shape.primitives[shapePrimitiveIndex];
    const startXY = shape.vectors[primitive.start];
    const endXY = shape.vectors[primitive.end];

    if (currentPrimitive != primitive.start)
      activePath.path +=
        ' M ' + mmFormat(startXY.x) + ',' + mmFormat(startXY.y);

    if (primitive.type == PRIMITIVE_TYPE_LINE)
      activePath.path += ' L ' + mmFormat(endXY.x) + ',' + mmFormat(endXY.y);
    else {
      const c0 = {
        x: shape.vectors[primitive.start].c0x,
        y: shape.vectors[primitive.start].c0y,
      };
      const c1 = {
        x: shape.vectors[primitive.end].c1x,
        y: shape.vectors[primitive.end].c1y,
      };

      const bezier1 = {
        x: c0.x !== undefined ? c0.x : startXY.x,
        y: c0.y !== undefined ? c0.y : startXY.y,
      };
      const bezier2 = {
        x: c1.x !== undefined ? c1.x : endXY.x,
        y: c1.y !== undefined ? c1.y : endXY.y,
      };

      activePath.path +=
        ' C ' +
        mmFormat(bezier1.x) +
        ',' +
        mmFormat(bezier1.y) +
        ' ' +
        mmFormat(bezier2.x) +
        ',' +
        mmFormat(bezier2.y) +
        ' ' +
        mmFormat(endXY.x) +
        ',' +
        mmFormat(endXY.y);
    }

    // reset our current primitive to mark where our path ended
    currentPrimitive = primitive.end;
  }
}

/**
 * Path shape properties are enqueued in the `activePath` global so that we can generate them as a single path
 * element, allowing for improved fill-rule's to handle details such as interior shapes on letters.  The actual
 * writing of the path element is done here, if any path is pending.
 */
function closeShapePath() {
  if (activePath.path != '') {
    if (activePath.cutSetting.layerMode == LAYER_MODE_LINE)
      writeXML('path', {
        id: safeId(activePath.name + '-' + activePath.id),
        d: activePath.path,
        stroke: cutIndexToRGBColor(activePath.cutSetting.index),
        stroke$width: mmFormat(activePath.cutSetting.kerf),
        fill: 'none',
      });
    else
      writeXML('path', {
        id: safeId(activePath.name + '-' + activePath.id),
        d: activePath.path,
        stroke:
          activePath.cutSetting.layerMode == LAYER_MODE_FILL
            ? 'none'
            : cutIndexToRGBColor(activePath.cutSetting.index),
        fill: cutIndexToRGBColor(activePath.cutSetting.index),
        fill$rule: 'evenodd',
      });
    activePath.id++;

    activePath.path = '';
    activePath.cutSetting = { index: -1 };
  }
}

/**
 * Converts a cut index (layer number) to an RGB color string, such as '#123456'.  If the cut index exceeds the
 * total number of known colors, the last color is reused.
 *
 * @param cutIndex Cut index (layer number) to convert to an RGB color
 * @returns RGB color including '#' prefix (such as '#123456')
 */
function cutIndexToRGBColor(cutIndex) {
  return (
    '#' +
    layerColorMap[layerColors[Math.min(cutIndex, layerColors.length - 1)]].hex
  );
}

/**
 * Converts a cut index (layer number) to the color name, such as 'orange'.  If the cut index exceeds the
 * total number of known colors, the last color is reused.
 *
 * @param cutIndex Cut index (layer number) to convert to a color name
 * @returns Name of the color for the layer (localized)
 */
function cutIndexToColorName(cutIndex) {
  return layerColorMap[layerColors[Math.min(cutIndex, layerColors.length - 1)]]
    .name;
}

/**
 * Formats a mm value for output to the SVG file, without any units.
 *
 * This will take a mm value, convert it to the unit required by the SVG file, and format it to reduce the number 
 * of digits. It will specify the units used, unless pixels in which case no units are rendered.  We
 * do this because some laser programs fail to work with units (older LightBurn versions) but others use the
 * incorrect scale factor for pixels (XTool XCS).
 *
 * @param mm Number in millimeters
 * @returns String with formatted value in pixels, without any units specified
 */
function mmFormat(mm) {
  switch (getProperty('machine0090SVGFileUnits', SVG_FILE_UNITS_DEFAULT)) {
    case SVG_FILE_UNITS_INCH:
      // 25.4 mm to an inch
      return formatPosition.format(mm / 25.4);
    case SVG_FILE_UNITS_MM:
      // 1 mm to a mm
      return formatPosition.format(mm);
    case SVG_FILE_UNITS_POINT:
      // a point is 1/72 per inch (but we are in mm's so we convert with 25.4mm/inch)
      return formatPosition.format(mm * 1/25.4*72);
    default:
      // default pixels, or 1/96 per inch (but we are in mm's so we convert with 25.4mm/inch)
      return formatPosition.format(mm * 1/25.4*96);
    }
}

/**
 * Formats a mm value for output to the SVG file, with units
 *
 * Similar to mmFormat, except also includes the units (in, px, etc).  
 *
 * @param mm Number in millimeters
 * @returns String with formatted value according to machine property machine0090SVGFileUnits
 */
function mmFormatWithUnits(mm) {
  switch (getProperty('machine0090SVGFileUnits', SVG_FILE_UNITS_DEFAULT)) {
    case SVG_FILE_UNITS_INCH:
      return mmFormat(mm) + 'in';
    case SVG_FILE_UNITS_MM:
      return mmFormat(mm) + 'mm';
    case SVG_FILE_UNITS_POINT:
      return mmFormat(mm) + 'pt';
    default:
      // since pixels are default, we return pixels without any units specifier as some programs
      // don't import files with units
      return mmFormat(mm);
    }
}

/**
 * Converts a generic string (with spaces, symbols, letters, etc) into an SVG-safe id string.  For
 * example, "Cut 32 holes, outline" becomes "laserpost_cut_32_holes_outline"
 *
 * @param idString String to use to make into an id-safe string
 * @returns ID-safe string
 */
function safeId(idString) {
  return (
    'laserpost_' +
    idString
      .toLowerCase()
      .replace(/\W/g, '_')
      .replace(/_+/g, '_')
      .replace(/_?$/, '')
  );
}
