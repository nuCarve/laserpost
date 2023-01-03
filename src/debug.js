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
  debugLog(
    'Dump: Groups ({groupCount} groups):',
    { groupCount: groups.length },
    COMMENT_DEBUG
  );
  for (let groupsIndex = 0; groupsIndex < groups.length; ++groupsIndex) {
    const group = groups[groupsIndex];

    debugLog(
      '  Group "{name}" ({opCount} operations)',
      {
        name: group.groupName ? group.groupName : '(none)',
        opCount: group.operations.length,
      },
      COMMENT_DEBUG
    );
    for (
      let groupOperationsIndex = 0;
      groupOperationsIndex < group.operations.length;
      ++groupOperationsIndex
    ) {
      const operation = group.operations[groupOperationsIndex];

      debugLog(
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
            debugLog(
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
            debugLog(
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
            debugLog(
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
 * Dump the contents of the project to comments in the file.
 */
function dumpProject() {
  debugLog('Project organization:', {}, COMMENT_DEBUG);
  debugLog('  Cut settings:', {}, COMMENT_DEBUG);
  for (
    let cutSettingsIndex = 0;
    cutSettingsIndex < project.cutSettings.length;
    ++cutSettingsIndex
  ) {
    const cutSetting = project.cutSettings[cutSettingsIndex];
    if (cutSetting.customCutSettingXML)
      debugLog(
        '    #{id}: "{name}" index={index}, priority={priority}, customCutSettingXML:\n{xml}',
        {
          id: cutSettingsIndex,
          name: cutSetting.name,
          index: cutSetting.index,
          priority: cutSetting.priority,
          xml: cutSetting.customCutSettingXML,
        },
        COMMENT_DEBUG
      );
    else
      debugLog(
        '    #{id}: "{name}" {minPower}-{maxPower}% power at {speed} mm/min, index={index}, priority={priority}, layerMode={layerMode}, laserEnable={laserEnable}',
        {
          id: cutSettingsIndex,
          name: cutSetting.name,
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

  // process all layers
  for (
    let projLayerIndex = 0;
    projLayerIndex < project.layers.length;
    ++projLayerIndex
  ) {
    const projLayer = project.layers[projLayerIndex];

    debugLog(
      '  Layer #{id}: "{name}" ({count} operation sets):',
      {
        id: projLayerIndex,
        name: projLayer.name,
        count: projLayer.operationSets.length,
      },
      COMMENT_DEBUG
    );

    // process all operation groups within the layer
    for (
      let operationSetsIndex = 0;
      operationSetsIndex < projLayer.operationSets.length;
      ++operationSetsIndex
    ) {
      debugLog(
        '    Operation group #{id}:',
        { id: operationSetsIndex },
        COMMENT_DEBUG
      );
      for (
        let operationIndex = 0;
        operationIndex <
        projLayer.operationSets[operationSetsIndex].operations.length;
        ++operationIndex
      ) {
        debugLog(
          '      Operation #{id}: "{name}"',
          { id: operationIndex,
            name: projLayer.operationSets[operationSetsIndex].operations[operationIndex].operationName,
          },
          COMMENT_DEBUG
        );
        debugLog('        Shape groups:', {}, COMMENT_DEBUG);
        for (
          let shapeSetIndex = 0;
          shapeSetIndex <
          projLayer.operationSets[operationSetsIndex].operations[operationIndex]
            .shapeSets.length;
          ++shapeSetIndex
        ) {
          const shape =
            projLayer.operationSets[operationSetsIndex].operations[
              operationIndex
            ].shapeSets[shapeSetIndex];

          if (shape.type == SHAPE_TYPE_ELLIPSE) {
            debugLog(
              '          Shape (type={type}, layer={cutIndex}, powerScale={powerScale})',
              {
                type: shape.type,
                cutIndex: shape.cutSetting.index,
                powerScale: shape.powerScale,
              },
              COMMENT_DEBUG
            );
            debugLog(
              '            Circle center=[{centerX}, {centerY}], radius={radius}',
              {
                centerX: formatPosition.format(shape.centerX),
                centerY: formatPosition.format(shape.centerY),
                radius: formatRadius.format(shape.radius),
              },
              COMMENT_INSANE
            );
          } else {
            debugLog(
              '          Shape (type={type}, layer={cutIndex}, powerScale={powerScale}, vectors={vectors})',
              {
                type: shape.type,
                cutIndex: shape.cutSetting.index,
                powerScale: shape.powerScale,
                vectors: shape.vectors.length
              },
              COMMENT_DEBUG
            );
            debugLog('          Vector list:', {}, COMMENT_INSANE);
            for (
              let shapeVectorIndex = 0;
              shapeVectorIndex < shape.vectors.length;
              ++shapeVectorIndex
            )
              debugLog(
                '          Vector #{id}: point=[{x}, {y}]{c0}{c1}',
                {
                  id: shapeVectorIndex,
                  x: formatPosition.format(shape.vectors[shapeVectorIndex].x),
                  y: formatPosition.format(shape.vectors[shapeVectorIndex].y),
                  c0:
                    shape.vectors[shapeVectorIndex].c0x !== undefined
                      ? format(' c0=[{x}, {y}]', {
                          x: formatPosition.format(
                            shape.vectors[shapeVectorIndex].c0x
                          ),
                          y: formatPosition.format(
                            shape.vectors[shapeVectorIndex].c0y
                          ),
                        })
                      : ' c0=n/a',
                  c1:
                    shape.vectors[shapeVectorIndex].c1x !== undefined
                      ? format(', c1=[{x}, {y}]', {
                          x: formatPosition.format(
                            shape.vectors[shapeVectorIndex].c1x
                          ),
                          y: formatPosition.format(
                            shape.vectors[shapeVectorIndex].c1y
                          ),
                        })
                      : ' c1=n/a',
                },
                COMMENT_INSANE
              );

            debugLog('          Primitive list:', {}, COMMENT_INSANE);
            for (
              let shapePrimitiveIndex = 0;
              shapePrimitiveIndex < shape.primitives.length;
              ++shapePrimitiveIndex
            )
              debugLog(
                '            Primitive #{id}: type={type}, start={start}, end={end}',
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
}

/**
 * Helper method to dump the CAM tool table into comments
 */
function dumpToolTable() {
  // add comments for tool information
  var tools = getToolTable();
  if (tools.getNumberOfTools() > 0) {
    debugLog(localize('Tools'));
    for (var toolIndex = 0; toolIndex < tools.getNumberOfTools(); ++toolIndex) {
      var tool = tools.getTool(toolIndex);
      const useAir =
        tool.assistGas.toLowerCase() != localize('none') &&
        tool.assistGas.toLowerCase() != localize('off') &&
        tool.assistGas != '';

      debugLog(
        '  ' +
          localize(
            'Tool #{num}: {desc} [{type}], min power (pierce)={pierce}%, max power (cut)={cut}%, {air}, kerf width={kerf}mm'
          ),
        {
          num: tool.number,
          desc: tool.getDescription(),
          type: getToolTypeName(tool.type),
          pierce: tool.piercePower,
          cut: tool.cutPower,
          kerf: tool.getKerfWidth(),
          air: useAir ? localize('air on') : localize('air off'),
        }
      );
    }
  }
}
