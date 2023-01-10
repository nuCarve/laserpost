/**************************************************************************************
 *
 * LaserPost module: lightburn.js
 *
 * LightBurn file syntax services
 *
 *************************************************************************************/

/**
 * Adjust the coordinate translation to match the users preferences for LightBurn
 * machine origin
 */
function onTranslateSetup() {
  let orientation = getProperty(
    'machine0050Orientation',
    MACHINE_ORIENTATION_DEFAULT
  );

  if (
    orientation == MACHINE_ORIENTATION_BOTTOM_RIGHT ||
    orientation == MACHINE_ORIENTATION_TOP_RIGHT
  )
    project.translate.x = true;
  if (
    orientation == MACHINE_ORIENTATION_TOP_LEFT ||
    orientation == MACHINE_ORIENTATION_TOP_RIGHT
  )
    project.translate.y = true;
}

/**
 * Writes the LightBurn (.lbrn) XML header (the `<?xml...?>` tag) along with the
 * LightBurn file headers and thumbnail.  These must be written before any extensive
 * comments due to a bug in LightBurn that causes it to corrupt if the thumbnail is
 * not near the top of the file.
 *
 * @param layer Layer (cutSetting) being generated (-1 for all layers)
 */
function onFileCreate(layer) {
  // locate the first section and extract the stock origin information to define the LightBurn mirror X/Y header
  const section = getSection(0);
  let mirror;

  switch (getProperty('machine0500Orientation', MACHINE_ORIENTATION_DEFAULT)) {
    case MACHINE_ORIENTATION_BOTTOM_LEFT:
      mirror = {
        x: false,
        y: false,
      };
      break;
    case MACHINE_ORIENTATION_BOTTOM_RIGHT:
      mirror = {
        x: true,
        y: false,
      };
      break;
    case MACHINE_ORIENTATION_TOP_LEFT:
      mirror = {
        x: false,
        y: true,
      };
      break;
    case MACHINE_ORIENTATION_TOP_RIGHT:
      mirror = {
        x: true,
        y: true,
      };
      break;
  }
  writeln('<?xml version="1.0" encoding="UTF-8"?>');
  writeXML(
    'LightBurnProject',
    {
      AppVersion: '1.2.04',
      FormatVersion: 0,
      MaterialHeight: 0,
      MirrorX: mirror.x,
      MirrorY: mirror.y,
    },
    true
  );

  writeXML('Thumbnail', {
    Source: lightburnThumbnail(),
  });

  writeln('');
}

/**
 * Writes the LightBurn (.lbrn) header information
 *
 * @param layer Layer (cutSetting) being generated (-1 for all layers)
 */
function onWriteHeader(layer) {
  // output notes, including layer notes, to the header
  const headerNotes = notes.concat(generateLayerNotes(layer));
  for (let noteIndex = 0; noteIndex < headerNotes.length; ++noteIndex)
    writeCommentLine(headerNotes[noteIndex]);
  writeln('');

  writeXML('VariableText', {}, true);
  writeXML('Start', { Value: '0' });
  writeXML('End', { Value: '999' });
  writeXML('Current', { Value: '0' });
  writeXML('Increment', { Value: '1' });
  writeXML('AutoAdvance', { Value: '0' });
  writeXMLClose();

  writeXML('UIPrefs', {}, true);
  writeXML('Optimize_ByLayer', { Value: 1 });
  writeXML('Optimize_ByGroup', { Value: -1 });
  writeXML('Optimize_ByPriority', { Value: 0 });
  writeXML('Optimize_WhichDirection', { Value: 0 });
  writeXML('Optimize_InnerToOuter', { Value: 1 });
  writeXML('Optimize_ByDirection', { Value: 0 });
  writeXML('Optimize_ReduceTravel', { Value: 1 });
  writeXML('Optimize_HideBacklash', { Value: 0 });
  writeXML('Optimize_ReduceDirChanges', { Value: 0 });
  writeXML('Optimize_ChooseCorners', { Value: 0 });
  writeXML('Optimize_AllowReverse', { Value: 1 });
  writeXML('Optimize_RemoveOverlaps', { Value: 0 });
  writeXML('Optimize_OptimalEntryPoint', { Value: 1 });
  writeXMLClose();

  // add LightBurn CutSettings
  writeCutSettings(layer);
}

/**
 * Writes the shapes (<Shape>) to the LightBurn file, including grouping as necessary
 *
 * @param layer Layer (cutSetting) being generated
 */
function onWriteShapes(layer) {
  const projLayer = project.layers[layer];

  // create a group if there is more than one item in the layer, we are grouping by layer and
  // we are not redirecting
  if (projLayer.operationSets.length > 1 && projLayer.index != -1) {
    writeCommentLine(localize('Layer group: "{name}"'), {
      name: projLayer.name,
    });

    writeXML('Shape', { Type: 'Group' }, true);
    writeXML('XForm', { content: '1 0 0 1 0 0' });
    writeXML('Children', {}, true);
  }

  // process all operation groups.  These are groups of operations and generate a grouping for
  // LightBurn when there is more than one operation in the group (when the group name property has
  // been used by the user)
  for (
    let setIndex = 0;
    setIndex < projLayer.operationSets.length;
    ++setIndex
  ) {
    const opGroup = projLayer.operationSets[setIndex];

    // do we have more than one operation in this group?  If so, and enabled, go ahead and group it
    if (opGroup.operations.length > 1) {
      writeCommentLine(localize('Operation group: "{name}"'), {
        name: opGroup.groupName,
      });

      writeXML('Shape', { Type: 'Group' }, true);
      writeXML('XForm', { content: '1 0 0 1 0 0' });
      writeXML('Children', {}, true);
    }

    // process all operations within the group
    for (
      let operationIndex = 0;
      operationIndex < opGroup.operations.length;
      ++operationIndex
    ) {
      const operation = opGroup.operations[operationIndex];

      writeCommentLine(localize('Operation: {name}'), {
        name: operation.operationName,
      });

      // do we need to group shapes within our operation?
      if (
        operation.shapeSets.length > 1 &&
        getProperty('laserpost0200GroupShapes')
      ) {
        writeXML('Shape', { Type: 'Group' }, true);
        writeXML('XForm', { content: '1 0 0 1 0 0' });
        writeXML('Children', {}, true);
      }

      // loop through all shapes within this operation
      for (
        let shapeSetsIndex = 0;
        shapeSetsIndex < operation.shapeSets.length;
        ++shapeSetsIndex
      ) {
        const shape = operation.shapeSets[shapeSetsIndex];

        // write the shape, based on it's type
        if (shape.type == SHAPE_TYPE_ELLIPSE) writeShapeEllipse(shape);
        else writeShapePath(shape);
      }

      // if we grouped the shapes, close the group
      if (
        operation.shapeSets.length > 1 &&
        getProperty('laserpost0200GroupShapes')
      ) {
        writeXMLClose();
        writeXMLClose();
      }
    }

    // if we grouped these operations, close the group now
    if (
      opGroup.operations.length > 1 &&
      getProperty('lightburn0500GroupOperations')
    ) {
      writeXMLClose();
      writeXMLClose();
    }
  }

  // close the layer group if created
  if (projLayer.operationSets.length > 1 && projLayer.index != -1) {
    writeXMLClose();
    writeXMLClose();
  }
}

/**
 * Writes the LightBurn (.lbrn) trailer information, including optionally adding notes and
 * closing off the LightBurnProject section opened in `onWriteHeader`.
 *
 * @param layer Layer (cutSetting) being generated (-1 for all layers)
 */
function onWriteTrailer(layer) {
  const includeNotes = getProperty('laserpost0400IncludeNotes');
  if (includeNotes != INCLUDE_NOTES_NONE && notes != '') {
    // determine if we cause LightBurn to show notes on file load
    let showOnLoad = false;
    if (includeNotes == INCLUDE_NOTES_SHOW_IMPORTANT)
      showOnLoad = notesImportant;
    else if (includeNotes == INCLUDE_NOTES_SHOW) showOnLoad = true;

    const setupNotes = notes.concat(generateLayerNotes(layer));
    writeXML('Notes', {
      ShowOnLoad: showOnLoad ? 1 : 0,
      Notes: setupNotes.join('\n'),
    });
  }

  writeXMLClose();
}

/**
 * Write a comment formatted for XML to the file including a newine at the end.  Supports template
 * strings (see `format`)
 *
 * @param template Message to write to the XML file as a comment (or blank line if empty or blank)
 * @param parameters Optional key/value dictionary with parameters from template (such as {name})
 */
function writeCommentLine(template, parameters) {
  const text = format(template, parameters);
  text = text.replace(/[ \n]+$/, '');

  if (text == '') writeln('');
  else writeBlock('<!-- ' + text + ' -->');
}

/**
 * Adds the <CutSetting> tags for all LightBurn layers as well as update notes to describe
 * the
 *
 * @param layer Layer (cutSetting) being generated (-1 for all layers)
 */
function generateLayerNotes(layer) {
  const result = [];

  // get access to the cutSettings based on the layer
  const cutSettings =
    layer == -1 ? project.cutSettings : project.layers[layer].cutSettings;

  result.push('Layers:');

  for (
    let cutSettingsIndex = 0;
    cutSettingsIndex < cutSettings.length;
    ++cutSettingsIndex
  ) {
    const cutSetting = cutSettings[cutSettingsIndex];

    result.push(
      format('  ' + localize('{layer}: {name}'), {
        layer: formatLeadingZero.format(cutSetting.index),
        name: cutSetting.name,
      })
    );

    if (cutSetting.customCutSetting) {
      result.push(
        format(
          '    ' +
            localize('Settings overridden with custom CutSetting property')
        )
      );
    } else {
      const laserNames = {};
      laserNames[LASER_ENABLE_OFF] = localize('lasers off');
      laserNames[LASER_ENABLE_1] = localize('laser 1');
      laserNames[LASER_ENABLE_2] = localize('laser 2');
      laserNames[LASER_ENABLE_BOTH] = localize('lasers 1 and 2');

      let layerMode;
      switch (cutSetting.layerMode) {
        case LAYER_MODE_LINE:
          layerMode = localize('line');
          break;
        case LAYER_MODE_FILL:
          layerMode = localize('fill');
          break;
        case LAYER_MODE_OFFSET_FILL:
          layerMode = localize('offset fill');
          break;
      }

      if (cutSetting.laserEnable !== LASER_ENABLE_OFF) {
        result.push(
          format(
            '    ' +
              localize(
                'Fill "{mode}" at power {min}-{max}% (scale {scale}%) and {speed} using {lasers} (air {air}, Z offset {zOffset}, passes {passes}, z-step {zStep})'
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
        result.push(format('    ' + localize('Output turned off')));
      }
    }
  }
  return result;
}

/**
 * Adds the <CutSetting> tags for all LightBurn layers as well as update notes to describe
 * the layers
 *
 * @param layer Layer (cutSetting) being generated (-1 for all layers)
 */
function writeCutSettings(layer) {
  // get access to the cutSettings based on the layer
  const cutSettings =
    layer == -1 ? project.cutSettings : project.layers[layer].cutSettings;

  for (
    let cutSettingsIndex = 0;
    cutSettingsIndex < cutSettings.length;
    ++cutSettingsIndex
  ) {
    const cutSetting = cutSettings[cutSettingsIndex];

    // if not custom, generate the cut setting
    if (!cutSetting.customCutSetting) {
      // determine our cut setting type
      let types = {};
      types[LAYER_MODE_LINE] = 'Cut';
      types[LAYER_MODE_FILL] = 'Scan';
      types[LAYER_MODE_OFFSET_FILL] = 'Offset';

      writeXML('CutSetting', { type: types[cutSetting.layerMode] }, true);

      writeXML('index', { Value: cutSetting.index });
      writeXML('name', { Value: cutSetting.name });
      writeXML('minPower', { Value: cutSetting.minPower });
      writeXML('maxPower', { Value: cutSetting.maxPower });
      writeXML('minPower2', { Value: cutSetting.minPower });
      writeXML('maxPower2', { Value: cutSetting.maxPower });
      writeXML('speed', { Value: formatSpeed.format(cutSetting.speed) });
      writeXML('priority', { Value: cutSetting.priority });
      writeXML('runBlower', { Value: cutSetting.useAir ? 1 : 0 });
      writeXML('zOffset', { Value: cutSetting.zOffset });
      writeXML('numPasses', { Value: cutSetting.passes });
      writeXML('zPerPass', { Value: cutSetting.zStep });

      // write the settings for select select and output enable/disable
      switch (cutSetting.laserEnable) {
        case LASER_ENABLE_OFF:
          writeXML('doOutput', { Value: '0' });
          break;
        case LASER_ENABLE_1:
          writeXML('enableLaser1', { Value: '1' });
          writeXML('enableLaser2', { Value: '0' });
          if (cutSetting.shuttleLaser1)
            writeXML('uOffset', { Value: cutSetting.shuttleLaser1 });
          break;
        case LASER_ENABLE_2:
          writeXML('enableLaser1', { Value: '0' });
          writeXML('enableLaser2', { Value: '1' });
          if (cutSetting.shuttleLaser2)
            writeXML('uOffset', { Value: cutSetting.shuttleLaser2 });
          break;
        case LASER_ENABLE_BOTH:
          writeXML('enableLaser1', { Value: '1' });
          writeXML('enableLaser2', { Value: '1' });
          break;
      }
      writeXMLClose();
    } else {
      // adjust the properties that we must override on custom
      const custom = cutSetting.customCutSetting.CutSetting;
      custom.index = { Value: cutSetting.index };
      custom.priority = { Value: cutSetting.priority };
      custom.name = { Value: cutSetting.name };
      writeXMLObject('CutSetting', custom);
    }
  }
}

/**
 * Write an ellipse (a closed circle) to the LightBurn file
 *
 * @param shape Shape information (cutSetting, radius, centerX, centerY) to write
 */
function writeShapeEllipse(shape) {
  writeXML(
    'Shape',
    {
      Type: 'Ellipse',
      CutIndex: shape.cutSetting.index,
      Rx: formatRadius.format(shape.radius),
      Ry: formatRadius.format(shape.radius),
    },
    true
  );
  writeXML('XForm', {
    content:
      '1 0 0 1 ' +
      formatPosition.format(shape.centerX) +
      ' ' +
      formatPosition.format(shape.centerY),
  });
  writeXMLClose();
}

/**
 * Write a path (lines and beziers) to the LightBurn file.  Skips shapes that are not closed yet
 * have been set up to use fill modes, as LightBurn won't render these.
 *
 * @param shape Shape information (cutSetting, vectors[], primitives[]) to write
 */
function writeShapePath(shape) {
  // check if this shape uses a fill mode (any mode other than line), and also if the
  // shape is not closed.  If so, drop the shape but add a comment to explain why (because LightBurn
  // will not render unclosed shapes).  Almost always this is due to unnecessary extra lines, such
  // as from complex SVG extrudes or lead-in/lead-out operations (for which using etch usually
  // fixes this)
  let commentOutShape = false;
  if (shape.cutSetting.layerMode != LAYER_MODE_LINE && !shape.closed) {
    writeCommentLine(
      'Removing shape as LightBurn generates warnings and removes unclosed fill shapes'
    );
    commentOutShape = true;
  }

  writeXML(
    'Shape',
    { Type: 'Path', CutIndex: shape.cutSetting.index },
    true,
    commentOutShape
  );
  writeXML('XForm', { content: '1 0 0 1 0 0' });

  // output the vectors
  for (
    let shapeVectorIndex = 0;
    shapeVectorIndex < shape.vectors.length;
    ++shapeVectorIndex
  ) {
    const vector = shape.vectors[shapeVectorIndex];

    writeXML('V', {
      vx: formatPosition.format(vector.x),
      vy: formatPosition.format(vector.y),
      c0x:
        vector.c0x !== undefined
          ? formatPosition.format(vector.c0x)
          : undefined,
      c0y:
        vector.c0y != undefined ? formatPosition.format(vector.c0y) : undefined,
      c1x:
        vector.c1x != undefined ? formatPosition.format(vector.c1x) : undefined,
      c1y:
        vector.c1y != undefined ? formatPosition.format(vector.c1y) : undefined,
    });
  }

  // output the primitives
  for (
    let shapePrimitiveIndex = 0;
    shapePrimitiveIndex < shape.primitives.length;
    ++shapePrimitiveIndex
  ) {
    const primitive = shape.primitives[shapePrimitiveIndex];

    writeXML('P', {
      T: primitive.type == PRIMITIVE_TYPE_LINE ? 'L' : 'B',
      p0: primitive.start,
      p1: primitive.end,
    });
  }

  // close the shape
  writeXMLClose();
}

/**
 * Gets an encoded string for the Lightburn thumbnail image.
 *
 * @returns String containing the encoded lightburn thumbnail image
 */
function lightburnThumbnail() {
  return 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAC9FBMVEU2CAmeGBtwERM8CQo1CAniIyfcIibbIibWISXVISXQICTPICS0HB+tGx6oGh2nGh2iGRycGBuaGBt7ExV0EhRtERNpEBJBCgs6CQpmEBJTDQ5MDA1FCww/Cgs5CQodBAUqBgdYDQ9RDA5LCw0+CQs3CAopBgciBQYbBAXmIyjhIifaISbZISbOHyTMHyTHHiPFHiLAHSG/HSG5HCCyGx+mGR2lGR2fGByYFxuSFhmRFhmMFRiLFRiGFBeFFBd/ExZ9ExZ3EhVwERRkDxFjDxFcDhBXDQ9PDA5JCw1CCgwhBQbrJCnoJCnlIyjjIyjfIifSICXKHyPCHiLBHiK9HSG7HSG2HCCwGx+qGh6WFxqUFxqPFhmNFhmIFRiHFRiDFBeBFBd7ExZbDhBUDQ9NDA4nBgeTFxplEBJfDxFZDhAyCAksBwgrBwgWAwQxBwkVAwQPAgMJAQICAgEEAwEKBwMTDQYdEwksHQ5gPx84JRJkQiEzIhEnGg0bEgkYEAgPCgUMCAQJBgMGBAIyIBC2djutcDhpRCJdPR5XOBxELBZBKhUfFArNhUPHgUHCfj/BfT+8ej27ej23dzy1dTuxczqucTmlazajajWfZzScZTONXC6HWCx4Tid3TSd1TCZ0SyZoQyJZOh1NMhk9KBQ6JhM0IhErHA4oGg0lGAzNhkTNhUTLg0PLhEPDfkC/fD++ez+8ej65eD21dTypbjimbDeaZDOXYjKMWy6JWS2GVyyCVCt/Uip8UCl5TyhzSyZqRSNnQyJkQSFYOR1MMRlJLxhGLhfJgkPAfUCrbzmZYzOKWi6EVixvSSVUNxxCKxY/KRUzIRF9USpiQCFQNBtBKxY7JxQvHxAjFwwgFQsaEQkjFgsQCgUvHg8WDgc3IxJwSCVGLRdAKRWSXjEwHxAqGw4nGQ0kFwweEwoUDQcRCwYLBwQSCwYIBQMFAwICAAAIAQEZBAQlBgYfBQUSAwMMAgIGAQEXBAQRAwMKAgIEAQEAAAD///+QlUPNAAAA/HRSTlP//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wDUesd+AAAACXBIWXMAAC4jAAAuIwF4pT92AAAI2ElEQVR4nO2be1BU1x3HP3cXhIUF5CkSOcszFQVqrPGBmviKGqudNG3TpGptZmpNxunUPmI1U9s0qY1VU+tQja3jZJJYbTVJOzW2xjFR1PjARwRFKwrLHkBBUJEFltey/ePuLuwKelcI+Mf+/ti997fn/r6f+zuPe87ZXaWNgTXdAOv7AQjoeuLoH02lB4B+kgdHV4SATm8/WhcEndvVv+bW0w2MfqfigPcCFaD/E+DWfDgyMBAJcKk+HBnwA/gB/AB+AD+AH8AP4AcYSAu4fxFPe/XFmsgbKAdCb6/pEwClDV/mhCXXLgyVIKSQwfWLI3qp7TPAirm1SIQEAcjkU6/3HsCXNrDxubMAhojoyLAbEsyjD/S+GnzIwEeViRJ95PgUAD6whSEx1K7shTb40ghXZzsk2ckm5+m3KckDW+yD6zspNGdgWyNiyAQP16FCRNQTD67tE8DJkzAl28tZdUIK+7d6BaC1ClYkCm566/OnRLjzoPqq6X+trVx4eYRsHa8evx6yK189nOGovNO6Z9oH1NRsjqvZMB14dejmvLiazXl5eXGbRwXfM6biC4C+KCLhewAUfdFYoVOsX4wAGHamQ9hySs6Wtre235wXAZgutRpK2+PjWw2lhuHG+wNoHAdWfijkTQBOXLGBEBcrKwDIEjKacpBI8gHOgQAJAvFnDZE1Aiyxw1iAVflSEhSE4PRqgFRJK+l6vU4ICcATCJIT9YnJ2gJrBTiFVP4OkCJQpi+ZHQ/8AOAYDLlzprL+BZ0UalEpdTn76/efG6YtssZe4IDk84AlEsaORBn/HvLKK8CTn2PJ/RW8ORKZAICQ/HUlrAGpJbLGDOSg3l8IEA9ggIyVwGGkCWABuDIgWABYEaIPAbY6a/htiegAcIDifBqrw1iZS064blxTAnydEWUK2K6qCovTpzhfnYLSfeN9WQUL3MGk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';
}
