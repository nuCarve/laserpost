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
 * Write the generic SVG file header
 */
function writeFileHeader() {
  writeln('<?xml version="1.0" encoding="utf-8"?>');

  writeComment('');
  writeCommentAndNote(generatedBy);
  writeCommentAndNote('');
}

/**
 * Writes the SVG (.svg) header information
 */
function writeHeader() {
  // let minX = getGlobalParameter('stock-lower-x');
  // let minY = getGlobalParameter('stock-lower-y');
  let maxX = getGlobalParameter('stock-upper-x');
  let maxY = getGlobalParameter('stock-upper-y');

  writeXML(
    'svg',
    {
      version: '1.1',
      xmlns: 'http://www.w3.org/2000/svg',
      xmlns_xlink: 'http://www.w3.org/1999/xlink',
      width: mmFormat(maxX),
      height: mmFormat(maxY),
      viewbox: '0 0 ' + mmFormat(maxX) + ' ' + mmFormat(maxY),
    },
    true
  );
  writeXML('desc', { content: generatedBy });
  writeln('');
  // writeCommentAndNote(localize('Post processor: {description} ({version})'), {
  //   description: description,
  //   version: semVer,
  // });
  // writeCommentAndNote(codeMoreInformation);
  // writeCommentAndNote('');

  // writeXML(
  //   'g',
  //   {
  //     id: 'flip-x',
  //     transform$origin: mmFormat(maxX/2) + " " + mmFormat(maxY/2),
  //     transform: 'scale(-1, 1)',
  //   },
  //   true
  // );
  // writeXML('title', { content: 'Title test' });
  // writeXML('desc', { content: 'desc test' });

  activePath = { path: '' };
}

/**
 * Writes the shapes (<Shape>) to the SVG file, including grouping as necessary
 */
function writeShapes() {
  // process all operation groups.  These are groups of operations and generate a grouping for
  // LightBurn when there is more than one operation in the group (when the group name property has
  // been used by the user)
  for (let setIndex = 0; setIndex < project.operationSets.length; ++setIndex) {
    const opGroup = project.operationSets[setIndex];

    // do we have more than one operation in this group?  If so, and enabled, go ahead and group it
    if (
      opGroup.operations.length > 1 &&
      getProperty('lightburn0500GroupOperations')
    ) {
      writeComment(localize('Group: "{name}"'), { group: opGroup.groupName });

      writeXML('g', { id: opGroup.groupName }, true);
      writeXML('desc', { content: localize('Group: "{name}", { group: opGroup.groupName ')});
    }

    // process all operations within the group
    for (
      let operationIndex = 0;
      operationIndex < opGroup.operations.length;
      ++operationIndex
    ) {
      const operation = opGroup.operations[operationIndex];

      writeComment(localize('Operation: {name}'), {
        name: operation.operationName,
      });

      // do we need to group shapes within our operation?
      if (
        operation.shapeSets.length > 1 &&
        getProperty('lightburn0600GroupShapes')
      ) {
        writeXML('g', { id: operation.operationName }, true);
        writeXML('desc', { content: format(localize('Operation: {name}'), {
          name: operation.operationName,
        })});
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
      if (
        operation.shapeSets.length > 1 &&
        getProperty('lightburn0600GroupShapes')
      ) {
        writeXMLClose();
      }
    }

    // if we grouped these operations, close the group now
    if (
      opGroup.operations.length > 1 &&
      getProperty('lightburn0500GroupOperations')
    ) {
      writeXMLClose();
    }
  }
}

/**
 * Writes the SVG trailer information, including optionally adding notes and
 * closing off the XML opened in `writeHeader`.
 *
 * Notes are injected (if requested in post preferences by the user) using the `notes` variable.
 */
function writeTrailer() {
  if (includeNotes != INCLUDE_NOTES_NONE && notes != '') {
    // determine if we should tell the user via a warning dialog that the notes are available
    let showNotesWarning = false;
    if (includeNotes == INCLUDE_NOTES_SHOW_IMPORTANT)
      showNotesWarning = notesImportant;
    else if (includeNotes == INCLUDE_NOTES_SHOW) showNotesWarning = true;

    // add layer properties to notes
    writeCutSettings();

    // write notes to the <programName>-notes.txt file (we could write to svg using <text>, but
    // many laser programs either render these poorly or fail to load them at all)
    // todo: adjusting "show on load" (etc) naming, and remove "hidden" (for SVG)
    // todo: Consider changing default for show to always for svg only
    // todo: Move show notes out of machine and onto post
    // todo: See if we can get tool and cut setting name for improved description ("MDF 3mm cut")
    var path = FileSystem.getCombinedPath(FileSystem.getFolderPath(getOutputPath()), programName + "-notes.txt");
    redirectToFile(path);
    writeln(notes);
    closeRedirection();

    // tell the user if they requested it
    if (showNotesWarning)
      if (notesImportant)
        showWarning(localize("There are important notes available from the post, please see:\n\n{path}"), { path: path });
      else
        showWarning(localize("Layer setup notes have been generated in the file:\n\n{path}"), { path: path });

  }

  // writeXMLClose();
  writeXMLClose();
}

/**
 * Add a line to the LightBurn notes field.
 *
 * @param template Template comment to format and write to the notes field
 * @param parameters Optional key/value dictionary with parameters from template (such as {name})
 * @param important If the note is "important" (show notes in LightBurn when INCLUDE_NOTES_SHOW_IMPORTANT); optional, default `false`
 */
function writeNote(template, parameters, important) {
  if (important === true) notesImportant = true;
  const text = format(template, parameters);
  notes += text + '\n';
}

/**
 * Write a line to the comments as well as add it to LightBurn file notes
 *
 * @param template Template comment to format and write to the comments and notes field
 * @param parameters Optional key/value dictionary with parameters from template (such as {name})
 */
function writeCommentAndNote(template, parameters) {
  const text = format(template, parameters);
  writeComment(text);
  writeNote(text);
}

/**
 * Write a comment formatted for XML to the file including a newine at the end.  User preferences
 * determines the detail level of comments.  Supports template strings (see `format`)
 *
 * @param text Message to write to the XML file as a comment (or blank line if empty or blank)
 */
function writeCommentLine(text) {
  if (text == '\n' || text == '') writeln('');
  else writeBlock('<!-- ' + text + ' -->');
}

/**
 * Adds the CutSettings (layer) information to the notes.
 */
function writeCutSettings() {
  writeNote('');
  writeNote('Layers:', false);

  for (
    let cutSettingsIndex = 0;
    cutSettingsIndex < project.cutSettings.length;
    ++cutSettingsIndex
  ) {
    const cutSetting = project.cutSettings[cutSettingsIndex];

    writeNote('  ' + localize('Layer {layer} ({color}): {name}'), {
      layer: cutSetting.index,
      color: cutIndexToColorName(cutSetting.index),
      name: cutSetting.name,
    });

    if (cutSetting.customCutSetting) {
      writeNote(
        '    ' + localize('Settings overridden with custom CutSetting property')
      );
      // todo: remove all CutSetting stuff from SVG
      writeComment(
        localize(
          'Layer {layer}: Settings overridden with custom CutSetting property'
        ),
        {
          layer: formatLeadingZero.format(cutSetting.index),
        },
        COMMENT_DETAIL
      );
    } else {
      const laserNames = {};
      laserNames[LASER_ENABLE_OFF] = localize('lasers off');
      laserNames[LASER_ENABLE_1] = localize('laser 1');
      laserNames[LASER_ENABLE_2] = localize('laser 2');
      laserNames[LASER_ENABLE_BOTH] = localize('lasers 1 and 2');

      if (cutSetting.laserEnable !== LASER_ENABLE_OFF) {
        writeNote(
          '    ' +
            localize(
              'Power {min}-{max}% at {speed} using {lasers} (air {air}, Z offset {zOffset}, passes {passes}, z-step {zStep})'
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
          }
        );
      } else {
        // laser is off
        writeNote('    ' + localize('Output turned off'));
      }
      // format for comments
      writeComment(
        'Layer {id} ({color}): power {min}-{max}% at {speed} using {lasers} (air {air}, Z offset {zOffset}, passes {passes}, z step {zStep}) [inherited from {source}]',
        {
          id: cutSetting.index,
          color: cutIndexToColorName(cutSetting.index),
          min: cutSetting.minPower,
          max: cutSetting.maxPower,
          source: cutSetting.powerSource,
          speed: speedToUnits(cutSetting.speed),
          lasers: laserNames[cutSetting.laserEnable],
          air: cutSetting.useAir ? localize('on') : localize('off'),
          zOffset: cutSetting.zOffset,
          passes: cutSetting.passes,
          zStep: cutSetting.zStep,
        },
        COMMENT_DETAIL
      );
    }
  }
}

/**
 * Write an ellipse (a closed circle) to the LightBurn file
 *
 * @param shape Shape information (cutSetting, radius, centerX, centerY) to write
 */
function writeShapeEllipse(shape) {
  // // close out any partially completed shape
  // closeShapePath();
  // // generate the ellipse
  // writeXML(
  //   'ellipse',
  //   {
  //     // CutIndex: shape.cutSetting.index,
  //     cx: mmFormat(shape.centerX),
  //     cy: mmFormat(shape.centerY),
  //     rx: mmFormat(shape.radius),
  //     ry: mmFormat(shape.radius),
  //   },
  //   false
  // );

  // if different layer specs are used, close the shape and save the new layer index
  if (shape.cutSetting.index != activePath.cutIndex) {
    closeShapePath();
    activePath.cutIndex = shape.cutSetting.index;
  }

  // transform our coordinates
  const start = transform({
    x: shape.centerX + shape.radius,
    y: shape.centerY,
  });

  // construct the ellipse using two have arcs
  activePath.path +=
    (activePath.path == '' ? '' : ' ') +
    'M ' +
    mmFormat(start.x) +
    ',' +
    mmFormat(start.y) +
    ' a ' +
    mmFormat(shape.radius) +
    ',' +
    mmFormat(shape.radius) +
    ' 0 1,0 ' +
    mmFormat(shape.radius * 2) +
    ',0' +
    ' a ' +
    mmFormat(shape.radius) +
    ',' +
    mmFormat(shape.radius) +
    ' 0 1,0 ' +
    mmFormat(-shape.radius * 2) +
    ',0';
}

/**
 * Write a path (lines and beziers) to the LightBurn file.  Skips shapes that are not closed yet
 * have been set up to use fill modes, as LightBurn won't render these.
 *
 * @param shape Shape information (cutSetting, vectors[], primitives[]) to write
 */
function writeShapePath(shape) {
  // if different layer specs are used, close the shape and save the new layer index
  if (shape.cutSetting.index != activePath.cutIndex) {
    closeShapePath();
    activePath.cutIndex = shape.cutSetting.index;
  }

  // check if this shape uses a fill mode (any mode other than line), and also if the
  // shape is not closed.  If so, drop the shape but add a comment to explain why (because LightBurn
  // will not render unclosed shapes).  Almost always this is due to unnecessary extra lines, such
  // as from complex SVG extrudes or lead-in/lead-out operations (for which using etch usually
  // fixes this)
  // let commentOutShape = false;
  // todo: decide if this logic is useful in SVG or not...
  // if (shape.cutSetting.layerMode != LAYER_MODE_LINE && !shape.closed) {
  //   writeComment(
  //     'Removing shape as LightBurn generates warnings and removes unclosed fill shapes'
  //   );
  //   commentOutShape = true;
  // }

  // transform our start coordinate
  const start = transform(shape.vectors[0]);

  // walk all primtives to build up an SVG path string
  activePath.path +=
    (activePath.path == '' ? '' : ' ') +
    'M ' +
    mmFormat(start.x) +
    ',' +
    mmFormat(start.y);
  for (
    let shapePrimitiveIndex = 0;
    shapePrimitiveIndex < shape.primitives.length;
    ++shapePrimitiveIndex
  ) {
    const primitive = shape.primitives[shapePrimitiveIndex];
    const endXY = transform(shape.vectors[primitive.end]);

    if (primitive.type == PRIMITIVE_TYPE_LINE)
      activePath.path += ' L ' + mmFormat(endXY.x) + ',' + mmFormat(endXY.y);
    else {
      const startXY = transform(shape.vectors[primitive.start]);
      const c0 = transform({
        x: shape.vectors[primitive.start].c0x,
        y: shape.vectors[primitive.start].c0y,
      });
      const c1 = transform({
        x: shape.vectors[primitive.end].c1x,
        y: shape.vectors[primitive.end].c1y,
      });

      const bezier1 = {
        x: c0.x ? c0.x : startXY.x,
        y: c0.y ? c0.y : startXY.y,
      };
      const bezier2 = {
        x: c1.x ? c1.x : endXY.x,
        y: c1.y ? c1.y : endXY.y,
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
  }
}

/**
 * Path shape properties are enqueued in the `activePath` global so that we can generate them as a single path
 * element, allowing for improved fill-modes to handle details such as interior shapes on letters.  The actual
 * writing of the path element is done here, if any path is pending.
 */
function closeShapePath() {
  if (activePath.path != '') {
    // get our layer cut settings
    const cutSetting = project.cutSettings[activePath.cutIndex];

    if (cutSetting.layerMode == LAYER_MODE_LINE)
      writeXML('path', {
        id: activePath.name + '-' + activePath.id,
        d: activePath.path,
        stroke: cutIndexToRGBColor(activePath.cutIndex),
        stroke$width: mmFormat(cutSetting.kerf),
        fill: 'none',
      });
    else
      writeXML('path', {
        id: activePath.name + '-' + activePath.id,
        d: activePath.path,
        stroke: cutSetting.layerMode == LAYER_MODE_FILL ? 'none' : cutIndexToRGBColor(activePath.cutIndex),
        fill: cutIndexToRGBColor(activePath.cutIndex),
        fill$mode: 'evenodd',
      });
    activePath.id++;

    activePath.path = '';
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
  return '#' + layerColorMap[layerColors[Math.min(cutIndex, layerColors.length - 1)]].hex;
}

/**
 * Converts a cut index (layer number) to the color name, such as 'orange'.  If the cut index exceeds the
 * total number of known colors, the last color is reused.
 * 
 * @param cutIndex Cut index (layer number) to convert to a color name
 * @returns Name of the color for the layer (localized)
 */
function cutIndexToColorName(cutIndex) {
  return layerColorMap[layerColors[Math.min(cutIndex, layerColors.length - 1)]].name;
}

/**
 * Formats a mm value for output to the SVG file.
 *
 * This will take a mm value, convert it to pixels, and format it to reduce the number of digits.
 * We use pixels instead of "mm" units directly in SVG because some products (I'm looking
 * at you, LightBurn) fail to load svg files that use "mm" units.
 *
 * @param mm Number in millimeters
 * @returns String with formatted value
 */
function mmFormat(mm) {
  return formatPosition.format(mm * 3.779527559);
}

/**
 * Perform transformation of coordinates to flip the coordinate space so the SVG file is correctly rendered.  This
 * could have been done using the svg transform w/scale(-1, 1), but not all laser programs correctly handle the
 * translation (I'm looking at you, LaserWeb)
 *
 * @param xy Object with `x` and `y` properties to translate
 * returns Object with same properties, but now translated
 */
function transform(xy) {
  // let minX = getGlobalParameter('stock-lower-x');
  // let minY = getGlobalParameter('stock-lower-y');
  let maxX = getGlobalParameter('stock-upper-x');
  // let maxY = getGlobalParameter('stock-upper-y');

  return { x: maxX - xy.x, y: xy.y };
}
