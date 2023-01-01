/**************************************************************************************
 *
 * LaserPost module: debug.js
 *
 * Debugging and simple UI support
 *
 *************************************************************************************/

/**
 * Display a simple warning message with a single OK button to continue.
 *
 * @param message Message that has been localized, with optional {arguments}
 * @param keyValue Object to resolve any {arguments} in message
 */
function showWarning(message, keyValue) {
  alert(
    format(localize('{description} ({version})'), {
      description: description,
      version: semVer,
    }),
    format(message, keyValue)
  );
}

/**
 * Dumps the contents of the groups (CAM based pathing) to comments in the file.
 */
function dumpGroups() {
  writeComment(
    'Dump: Groups ({groupCount} groups):',
    { groupCount: groups.length },
    COMMENT_DEBUG
  );
  for (let groupsIndex = 0; groupsIndex < groups.length; ++groupsIndex) {
    const group = groups[groupsIndex];

    writeComment(
      '  Group "{name}" ({opCount} operations)',
      {
        name: group.groupName ? group.groupName : '(none)',
        opCount: group.operations.length,
      },
      COMMENT_DEBUG
    );
    for (let groupOperationsIndex = 0; groupOperationsIndex < group.operations.length; ++groupOperationsIndex) {
      const operation = group.operations[groupOperationsIndex];

      writeComment(
        '    Operation "{name}" ({min}-{max}% power, power scale {powerScale}%, layer mode {layerMode} ({pathCount} paths)',
        {
          name: operation.operationName,
          min: operation.minPower,
          max: operation.maxPower,
          powerScale: operation.powerScale,
          layerMode: operation.layerMode,
          pathCount: operation.paths.length,
        },
        COMMENT_DEBUG
      );
      for (let pathIndex = 0; pathIndex < operation.paths.length; ++pathIndex) {
        const path = operation.paths[pathIndex];

        switch (path.type) {
          case PATH_TYPE_LINEAR:
            writeComment(
              '      Path #{pathId}: LINEAR [{x}, {y}] at {feed} mm/min',
              {
                pathId: pathIndex,
                x: formatPosition.format(path.x),
                y: formatPosition.format(path.y),
                feed: formatSpeed.format(path.feed),
              },
              COMMENT_INSANE
            );
            break;
          case PATH_TYPE_SEMICIRCLE:
          case PATH_TYPE_CIRCLE:
            writeComment(
              '      Path #{pathId}: {pathType} ({direction}) [{x}, {y}] centered on [{centerX}, {centerY}] at {feed} mm/min',
              {
                pathId: pathIndex,
                pathType:
                  path.type == PATH_TYPE_SEMICIRCLE ? 'SEMI-CIRCLE' : 'CIRCLE',
                centerX: formatPosition.format(path.centerX),
                centerY: formatPosition.format(path.centerY),
                x: formatPosition.format(path.x),
                y: formatPosition.format(path.y),
                direction: path.clockwise ? 'CW' : 'CCW',
                feed: formatSpeed.format(path.feed),
              },
              COMMENT_INSANE
            );
            break;
          case PATH_TYPE_MOVE:
            writeComment(
              '      Path #{pathId}: MOVE [{x}, {y}]',
              {
                pathId: pathIndex,
                x: formatPosition.format(path.x),
                y: formatPosition.format(path.y),
                feed: formatSpeed.format(path.feed),
              },
              COMMENT_INSANE
            );
            break;
        }
      }
    }
  }
}

/**
 * Dump the contents of the project (LightBurn style shapes) to comments in the file.
 */
function dumpProject() {
  writeComment(
    'Dump: Project ({groupCount} operation groups):',
    { groupCount: project.operationSets.length },
    COMMENT_DEBUG
  );
  writeComment('  Cut settings:', {}, COMMENT_DEBUG);
  for (let cutSettingsIndex = 0; cutSettingsIndex < project.cutSettings.length; ++cutSettingsIndex) {
    const cutSetting = project.cutSettings[cutSettingsIndex];
    if (cutSetting.customCutSettingXML)
      writeComment(
        '    #{id}: index={index}, priority={priority}, customCutSettingXML:\n{xml}',
        {
          id: cutSettingsIndex,
          index: cutSetting.index,
          priority: cutSetting.priority,
          xml: cutSetting.customCutSettingXML,
        },
        COMMENT_DEBUG
      );
    else
      writeComment(
        '    #{id}: {minPower}-{maxPower}% power at {speed} mm/min, index={index}, priority={priority}, layerMode={layerMode}, laserEnable={laserEnable}',
        {
          id: cutSettingsIndex,
          index: cutSetting.index,
          priority: cutSetting.priority,
          minPower: cutSetting.minPower,
          maxPower: cutSetting.maxPower,
          speed: formatSpeed.format(cutSetting.speed),
          layerMode: cutSetting.layerMode,
          laserEnable: cutSetting.laserEnable,
        },
        COMMENT_DEBUG
      );
  }

  for (let operationSetsIndex = 0; operationSetsIndex < project.operationSets.length; ++operationSetsIndex) {
    writeComment('  Operation group #{id}:', { id: operationSetsIndex }, COMMENT_DEBUG);
    for (let operationIndex = 0; operationIndex < project.operationSets[operationSetsIndex].operations.length; ++operationIndex) {
      writeComment('    Operation #{id}:', { id: operationIndex }, COMMENT_DEBUG);
      writeComment('      Shape groups:', {}, COMMENT_DEBUG);
      for (
        let shapeSetIndex = 0;
        shapeSetIndex < project.operationSets[operationSetsIndex].operations[operationIndex].shapeSets.length;
        ++shapeSetIndex
      ) {
        const shape = project.operationSets[operationSetsIndex].operations[operationIndex].shapeSets[shapeSetIndex];

        // dump the shape into insane comments
        writeComment(
          '        Shape (type={type}, layer={cutIndex}, powerScale={powerScale})',
          {
            type: shape.type,
            cutIndex: shape.cutSetting.index,
            powerScale: shape.powerScale,
          },
          COMMENT_DEBUG
        );
        if (shape.type == SHAPE_TYPE_ELLIPSE) {
          writeComment(
            '          Circle center=[{centerX}, {centerY}], radius={radius}',
            {
              centerX: formatPosition.format(shape.centerX),
              centerY: formatPosition.format(shape.centerY),
              radius: formatRadius.format(shape.radius),
            },
            COMMENT_INSANE
          );
        } else {
          writeComment('        Vector list:', {}, COMMENT_INSANE);
          for (let shapeVectorIndex = 0; shapeVectorIndex < shape.vectors.length; ++shapeVectorIndex)
            writeComment(
              '        Vector #{id}: point=[{x}, {y}]{c0}{c1}',
              {
                id: shapeVectorIndex,
                x: formatPosition.format(shape.vectors[shapeVectorIndex].x),
                y: formatPosition.format(shape.vectors[shapeVectorIndex].y),
                c0:
                  shape.vectors[shapeVectorIndex].c0x !== undefined
                    ? format(' c0=[{x}, {y}]', {
                        x: formatPosition.format(shape.vectors[shapeVectorIndex].c0x),
                        y: formatPosition.format(shape.vectors[shapeVectorIndex].c0y),
                      })
                    : ' c0=n/a',
                c1:
                  shape.vectors[shapeVectorIndex].c1x !== undefined
                    ? format(', c1=[{x}, {y}]', {
                        x: formatPosition.format(shape.vectors[shapeVectorIndex].c1x),
                        y: formatPosition.format(shape.vectors[shapeVectorIndex].c1y),
                      })
                    : ' c1=n/a',
              },
              COMMENT_INSANE
            );

          writeComment('        Primitive list:', {}, COMMENT_INSANE);
          for (let shapePrimitiveIndex = 0; shapePrimitiveIndex < shape.primitives.length; ++shapePrimitiveIndex)
            writeComment(
              '          Primitive #{id}: type={type}, start={start}, end={end}',
              {
                id: shapePrimitiveIndex,
                type: shape.primitives[shapePrimitiveIndex].type,
                start: shape.primitives[shapePrimitiveIndex].start,
                end: shape.primitives[shapePrimitiveIndex].end,
              },
              COMMENT_INSANE
            );
        }
      }
    }
  }
}
