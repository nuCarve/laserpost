/**************************************************************************************
 *
 * LaserPost module: lightburn.js
 * 
 * LightBurn file syntax services
 *
 *************************************************************************************/

/**
 * Writes the LightBurn (.lbrn) header information
 */
 function writeHeader() {
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
  }
  
  /**
   * Adds the <CutSetting> tags for all LightBurn layers as well as update notes to describe
   * the layers
   */
  function writeCutSettings() {
    writeNote('');
    writeNote('Layers:', false);
  
    for (let i = 0; i < project.cutSettings.length; ++i) {
      const cutSetting = project.cutSettings[i];
  
      writeNote('  ' + localize('{layer}: {name}'), {
        layer: formatLeadingZero.format(cutSetting.index),
        name: cutSetting.name,
      });
  
      if (cutSetting.customCutSetting) {
        writeNote(
          '    ' + localize('Settings overridden with custom CutSetting property')
        );
        writeComment(
          localize(
            'CutSetting (layer) {layer}: Settings overridden with custom CutSetting property'
          ),
          {
            layer: formatLeadingZero.format(cutSetting.index),
          },
          COMMENT_DETAIL
        );
      } else {
        if (cutSetting.laserEnable !== LASER_ENABLE_OFF) {
          const laserNames = {};
          laserNames[LASER_ENABLE_1] = localize('laser 1');
          laserNames[LASER_ENABLE_2] = localize('laser 2');
          laserNames[LASER_ENABLE_BOTH] = localize('lasers 1 and 2');
  
          writeNote(
            '    ' +
              localize(
                'Power {min}-{max}% speed {speed} using {lasers} (air {air}, Z offset {zOffset}, passes {passes}, z step {zStep})'
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
  
          // format for comments
          writeComment(
            'CutSetting (layer) {id}: power {min}-{max}% ({source}), speed {speed} {lasers} (air {air}, Z offset {zOffset}, passes {passes}, z step {zStep})',
            {
              id: formatLeadingZero.format(cutSetting.index),
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
        } else {
          // laser is off
          writeNote('    ' + localize('Output turned off'));
        }
      }
  
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
            break;
          case LASER_ENABLE_2:
            writeXML('enableLaser1', { Value: '0' });
            writeXML('enableLaser2', { Value: '1' });
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
   * Writes the shapes (<Shape>) to the LightBurn file, including grouping as necessary
   */
  function writeShapes() {
    // process all operation groups.  These are groups of operations and generate a grouping for
    // LightBurn when there is more than one operation in the group (when the group name property has
    // been used by the user)
    for (let og = 0; og < project.operationGroups.length; ++og) {
      const opGroup = project.operationGroups[og];
  
      // do we have more than one operation in this group?  If so, and enabled, go ahead and group it
      if (
        opGroup.operations.length > 1 &&
        getProperty('lightburn0500GroupOperations')
      ) {
        writeComment(localize('Group: "{name}"'), { group: opGroup.groupName });
  
        writeXML('Shape', { Type: 'Group' }, true);
        writeXML('XForm', { content: '1 0 0 1 0 0' });
        writeXML('Children', {}, true);
      }
  
      // process all operations within the group
      for (let o = 0; o < opGroup.operations.length; ++o) {
        const operation = opGroup.operations[o];
  
        writeComment(localize('Operation: {name}'), {
          name: operation.operationName,
        });
  
        // do we need to group shapes within our operation?
        if (
          operation.shapeGroups.length > 1 &&
          getProperty('lightburn0600GroupShapes')
        ) {
          writeXML('Shape', { Type: 'Group' }, true);
          writeXML('XForm', { content: '1 0 0 1 0 0' });
          writeXML('Children', {}, true);
        }
  
        // loop through all shapes within this operation
        for (let s = 0; s < operation.shapeGroups.length; ++s) {
          const shape = operation.shapeGroups[s];
  
          // write the shape, based on it's type
          if (shape.type == SHAPE_TYPE_ELIPSE) writeShapeElipse(shape);
          else writeShapePath(shape);
        }
  
        // if we grouped the shapes, close the group
        if (
          operation.shapeGroups.length > 1 &&
          getProperty('lightburn0600GroupShapes')
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
  }
  
  /**
   * Write an elipse (a closed circle) to the LightBurn file
   *
   * @param shape Shape information (cutIndex, radius, centerX, centerY) to write
   */
  function writeShapeElipse(shape) {
    writeXML(
      'Shape',
      {
        Type: 'Ellipse',
        CutIndex: shape.cutIndex,
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
   * Write a path (lines and beziers) to the LightBurn file
   *
   * @param shape Shape information (cutIndex, vectors[], primitives[]) to write
   */
  function writeShapePath(shape) {
    writeXML('Shape', { Type: 'Path', CutIndex: shape.cutIndex }, true);
    writeXML('XForm', { content: '1 0 0 1 0 0' });
  
    // output the vectors
    for (let i = 0; i < shape.vectors.length; ++i) {
      const vector = shape.vectors[i];
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
    for (let i = 0; i < shape.primitives.length; ++i) {
      const primitive = shape.primitives[i];
  
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
   * Writes the LightBurn (.lbrn) XML header (the `<?xml...?>` tag) along with the
   * LightBurn file headers and thumbnail.  These must be written before any extensive
   * comments due to a bug in LightBurn that causes it to corrupt if the thumbnail is
   * not near the top of the file.
   */
  function writeXMLHeader() {
    writeln('<?xml version="1.0" encoding="UTF-8"?>');
    writeXML(
      'LightBurnProject',
      {
        AppVersion: '1.2.04',
        FormatVersion: 0,
        MaterialHeight: 0,
        MirrorX: false,
        MirrorY: false,
      },
      true
    );
  
    writeXML('Thumbnail', {
      Source:
        'iVBORw0KGgoAAAANSUhEUgAAAPoAAAD6CAMAAAC/MqoPAAACiFBMVEX//////8z//5n//2b//zP//wD/zP//zMz/zJn/zGb/zDP/zAD/mf//mcz/mZn/mWb/mTP/mQD/Zv//Zsz/Zpn/Zmb/ZjP/ZgD/M///M8z/M5n/M2b/MzP/MwD/AP//AMz/AJn/AGb/ADP/AADM///M/8zM/5nM/2bM/zPM/wDMzP/MzMzMzJnMzGbMzDPMzADMmf/MmczMmZnMmWbMmTPMmQDMZv/MZszMZpnMZmbMZjPMZgDMM//MM8zMM5nMM2bMMzPMMwDMAP/MAMzMAJnMAGbMADPMAACZ//+Z/8yZ/5mZ/2aZ/zOZ/wCZzP+ZzMyZzJmZzGaZzDOZzACZmf+ZmcyZmZmZmWaZmTOZmQCZZv+ZZsyZZpmZZmaZZjOZZgCZM/+ZM8yZM5mZM2aZMzOZMwCZAP+ZAMyZAJmZAGaZADOZAABm//9m/8xm/5lm/2Zm/zNm/wBmzP9mzMxmzJlmzGZmzDNmzABmmf9mmcxmmZlmmWZmmTNmmQBmZv9mZsxmZplmZmZmZjNmZgBmM/9mM8xmM5lmM2ZmMzNmMwBmAP9mAMxmAJlmAGZmADNmAAAz//8z/8wz/5kz/2Yz/zMz/wAzzP8zzMwzzJkzzGYzzDMzzAAzmf8zmcwzmZkzmWYzmTMzmQAzZv8zZswzZpkzZmYzZjMzZgAzM/8zM8wzM5kzM2YzMzMzMwAzAP8zAMwzAJkzAGYzADMzAAAA//8A/8wA/5kA/2YA/zMA/wAAzP8AzMwAzJkAzGYAzDMAzAAAmf8AmcwAmZkAmWYAmTMAmQAAZv8AZswAZpkAZmYAZjMAZgAAM/8AM8wAM5kAM2YAMzMAMwAAAP8AAMwAAJkAAGYAADMAAAALihLaAAAACXBIWXMAAAsTAAALEwEAmpwYAAA/o2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4wLWMwMDAgNzkuMTcxYzI3ZiwgMjAyMi8wOC8xNi0xODowMjo0MyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1sbnM6aWxsdXN0cmF0b3I9Imh0dHA6Ly9ucy5hZG9iZS5jb20vaWxsdXN0cmF0b3IvMS4wLyIgeG1sbnM6eG1wVFBnPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvdC9wZy8iIHhtbG5zOnN0RGltPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvRGltZW5zaW9ucyMiIHhtbG5zOnhtcEc9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9nLyIgeG1sbnM6cGRmPSJodHRwOi8vbnMuYWRvYmUuY29tL3BkZi8xLjMvIiB4bWxuczpwaG90b3Nob3A9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGhvdG9zaG9wLzEuMC8iIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIiB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHhtcDpNZXRhZGF0YURhdGU9IjIwMjItMTItMDJUMDY6MzA6NTktMDU6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDIyLTEyLTAyVDA2OjMwOjU5LTA1OjAwIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMi0xMi0wMVQxMTowMDo0OC0wNDowMCIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBJbGx1c3RyYXRvciAyNy4wIChXaW5kb3dzKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDphMmFlOGNhNS01YjY1LTliNGEtYWJjYS0yZThlOGU1ZmNiMzciIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDpmNTVhZTg0Zi03NDZmLWQ2NDItYjk3NC03ZGYwYTU4YjAyZDciIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0idXVpZDo1RDIwODkyNDkzQkZEQjExOTE0QTg1OTBEMzE1MDhDOCIgeG1wTU06UmVuZGl0aW9uQ2xhc3M9InByb29mOnBkZiIgaWxsdXN0cmF0b3I6U3RhcnR1cFByb2ZpbGU9IlByaW50IiBpbGx1c3RyYXRvcjpDcmVhdG9yU3ViVG9vbD0iQUlSb2JpbiIgaWxsdXN0cmF0b3I6VHlwZT0iRG9jdW1lbnQiIHhtcFRQZzpIYXNWaXNpYmxlT3ZlcnByaW50PSJGYWxzZSIgeG1wVFBnOkhhc1Zpc2libGVUcmFuc3BhcmVuY3k9IkZhbHNlIiB4bXBUUGc6TlBhZ2VzPSIxIiBwZGY6UHJvZHVjZXI9IkFkb2JlIFBERiBsaWJyYXJ5IDE2LjA3IiBwaG90b3Nob3A6Q29sb3JNb2RlPSIyIiB0aWZmOk9yaWVudGF0aW9uPSIxIiB0aWZmOlhSZXNvbHV0aW9uPSIzMDAwMDAwLzEwMDAwIiB0aWZmOllSZXNvbHV0aW9uPSIzMDAwMDAwLzEwMDAwIiB0aWZmOlJlc29sdXRpb25Vbml0PSIyIiBleGlmOkNvbG9yU3BhY2U9IjY1NTM1IiBleGlmOlBpeGVsWERpbWVuc2lvbj0iMjgwMCIgZXhpZjpQaXhlbFlEaW1lbnNpb249IjI4MDAiPiA8ZGM6dGl0bGU+IDxyZGY6QWx0PiA8cmRmOmxpIHhtbDpsYW5nPSJ4LWRlZmF1bHQiPm51Q2FydmUgTG9nbzwvcmRmOmxpPiA8L3JkZjpBbHQ+IDwvZGM6dGl0bGU+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOmY4MWMyMWEwLTZkYzgtYmM0Yi1iOTExLTk1N2VmM2FjNjA2MCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo1OWIxOThmYS04YTYxLTRhNDgtYmViYi1kY2IxZmMwYzlhOTMiIHN0UmVmOm9yaWdpbmFsRG9jdW1lbnRJRD0idXVpZDo1RDIwODkyNDkzQkZEQjExOTE0QTg1OTBEMzE1MDhDOCIgc3RSZWY6cmVuZGl0aW9uQ2xhc3M9InByb29mOnBkZiIvPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo4MjVmZTk3OC1hMjcxLWUxNDktOGJiZS03OWY3MDFiNzdhMjciIHN0RXZ0OndoZW49IjIwMjItMTItMDFUMDc6NDc6NTUtMDU6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIElsbHVzdHJhdG9yIDI3LjAgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo1OWIxOThmYS04YTYxLTRhNDgtYmViYi1kY2IxZmMwYzlhOTMiIHN0RXZ0OndoZW49IjIwMjItMTItMDFUMTA6NTg6MDItMDU6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIElsbHVzdHJhdG9yIDI3LjAgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjb252ZXJ0ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImZyb20gYXBwbGljYXRpb24vcGRmIHRvIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3AiLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmUwYzY3MTZmLTQwMWItYzE0NC1iZGU4LTEzYTczMWQyNjk2NSIgc3RFdnQ6d2hlbj0iMjAyMi0xMi0wMVQxNDoxOTo0OS0wNTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDI0LjAgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDpmODFjMjFhMC02ZGM4LWJjNGItYjkxMS05NTdlZjNhYzYwNjAiIHN0RXZ0OndoZW49IjIwMjItMTItMDJUMDY6MzA6NTktMDU6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCAyNC4wIChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY29udmVydGVkIiBzdEV2dDpwYXJhbWV0ZXJzPSJmcm9tIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3AgdG8gaW1hZ2UvcG5nIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJkZXJpdmVkIiBzdEV2dDpwYXJhbWV0ZXJzPSJjb252ZXJ0ZWQgZnJvbSBhcHBsaWNhdGlvbi92bmQuYWRvYmUucGhvdG9zaG9wIHRvIGltYWdlL3BuZyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6YTJhZThjYTUtNWI2NS05YjRhLWFiY2EtMmU4ZThlNWZjYjM3IiBzdEV2dDp3aGVuPSIyMDIyLTEyLTAyVDA2OjMwOjU5LTA1OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgMjQuMCAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDx4bXBUUGc6TWF4UGFnZVNpemUgc3REaW06dz0iNTQ0Ljk2OTI0OSIgc3REaW06aD0iMjk2LjUwMDY2NiIgc3REaW06dW5pdD0iUGl4ZWxzIi8+IDx4bXBUUGc6UGxhdGVOYW1lcz4gPHJkZjpTZXE+IDxyZGY6bGk+Q3lhbjwvcmRmOmxpPiA8cmRmOmxpPk1hZ2VudGE8L3JkZjpsaT4gPHJkZjpsaT5ZZWxsb3c8L3JkZjpsaT4gPHJkZjpsaT5CbGFjazwvcmRmOmxpPiA8L3JkZjpTZXE+IDwveG1wVFBnOlBsYXRlTmFtZXM+IDx4bXBUUGc6U3dhdGNoR3JvdXBzPiA8cmRmOlNlcT4gPHJkZjpsaT4gPHJkZjpEZXNjcmlwdGlvbiB4bXBHOmdyb3VwTmFtZT0iRGVmYXVsdCBTd2F0Y2ggR3JvdXAiIHhtcEc6Z3JvdXBUeXBlPSIwIj4gPHhtcEc6Q29sb3JhbnRzPiA8cmRmOlNlcT4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkJsYWNrIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIxMDAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDTVlLIFJlZCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMTAwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjEwMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDTVlLIFllbGxvdyIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIxMDAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQ01ZSyBHcmVlbiIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMTAwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjEwMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDTVlLIEN5YW4iIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjEwMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkNNWUsgQmx1ZSIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMTAwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIxMDAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDTVlLIE1hZ2VudGEiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjEwMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MTUgTT0xMDAgWT05MCBLPTEwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIxNS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMTAwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjkwLjAwMDAwMCIgeG1wRzpibGFjaz0iMTAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTAgTT05MCBZPTg1IEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iOTAuMDAwMDAwIiB4bXBHOnllbGxvdz0iODUuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09ODAgWT05NSBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjgwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9Ijk1LjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTUwIFk9MTAwIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iNTAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMTAwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTM1IFk9ODUgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIzNS4wMDAwMDAiIHhtcEc6eWVsbG93PSI4NS4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTUgTT0wIFk9OTAgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSI1LjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjkwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MjAgTT0wIFk9MTAwIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMTAwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NTAgTT0wIFk9MTAwIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNTAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMTAwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NzUgTT0wIFk9MTAwIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNzUuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMTAwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9ODUgTT0xMCBZPTEwMCBLPTEwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSI4NS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMTAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMTAwLjAwMDAwMCIgeG1wRzpibGFjaz0iMTAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTkwIE09MzAgWT05NSBLPTMwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSI5MC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMzAuMDAwMDAwIiB4bXBHOnllbGxvdz0iOTUuMDAwMDAwIiB4bXBHOmJsYWNrPSIzMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NzUgTT0wIFk9NzUgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSI3NS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSI3NS4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTgwIE09MTAgWT00NSBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjgwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIxMC4wMDAwMDAiIHhtcEc6eWVsbG93PSI0NS4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTcwIE09MTUgWT0wIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNzAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjE1LjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz04NSBNPTUwIFk9MCBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49Ijg1LjAwMDAwMCIgeG1wRzptYWdlbnRhPSI1MC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MTAwIE09OTUgWT01IEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMTAwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI5NS4wMDAwMDAiIHhtcEc6eWVsbG93PSI1LjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MTAwIE09MTAwIFk9MjUgSz0yNSIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMTAwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIxMDAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMjUuMDAwMDAwIiB4bXBHOmJsYWNrPSIyNS4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NzUgTT0xMDAgWT0wIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNzUuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjEwMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NTAgTT0xMDAgWT0wIEs9MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNTAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjEwMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MzUgTT0xMDAgWT0zNSBLPTEwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIzNS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMTAwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjM1LjAwMDAwMCIgeG1wRzpibGFjaz0iMTAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTEwIE09MTAwIFk9NTAgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIxMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMTAwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjUwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTk1IFk9MjAgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI5NS4wMDAwMDAiIHhtcEc6eWVsbG93PSIyMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTI1IE09MjUgWT00MCBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjI1LjAwMDAwMCIgeG1wRzptYWdlbnRhPSIyNS4wMDAwMDAiIHhtcEc6eWVsbG93PSI0MC4wMDAwMDAiIHhtcEc6YmxhY2s9IjAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTQwIE09NDUgWT01MCBLPTUiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjQwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI0NS4wMDAwMDAiIHhtcEc6eWVsbG93PSI1MC4wMDAwMDAiIHhtcEc6YmxhY2s9IjUuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTUwIE09NTAgWT02MCBLPTI1IiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSI1MC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iNTAuMDAwMDAwIiB4bXBHOnllbGxvdz0iNjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIyNS4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NTUgTT02MCBZPTY1IEs9NDAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjU1LjAwMDAwMCIgeG1wRzptYWdlbnRhPSI2MC4wMDAwMDAiIHhtcEc6eWVsbG93PSI2NS4wMDAwMDAiIHhtcEc6YmxhY2s9IjQwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0yNSBNPTQwIFk9NjUgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIyNS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iNDAuMDAwMDAwIiB4bXBHOnllbGxvdz0iNjUuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0zMCBNPTUwIFk9NzUgSz0xMCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMzAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjUwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9Ijc1LjAwMDAwMCIgeG1wRzpibGFjaz0iMTAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTM1IE09NjAgWT04MCBLPTI1IiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIzNS4wMDAwMDAiIHhtcEc6bWFnZW50YT0iNjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iODAuMDAwMDAwIiB4bXBHOmJsYWNrPSIyNS4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NDAgTT02NSBZPTkwIEs9MzUiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjQwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI2NS4wMDAwMDAiIHhtcEc6eWVsbG93PSI5MC4wMDAwMDAiIHhtcEc6YmxhY2s9IjM1LjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz00MCBNPTcwIFk9MTAwIEs9NTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjQwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI3MC4wMDAwMDAiIHhtcEc6eWVsbG93PSIxMDAuMDAwMDAwIiB4bXBHOmJsYWNrPSI1MC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9NTAgTT03MCBZPTgwIEs9NzAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjUwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI3MC4wMDAwMDAiIHhtcEc6eWVsbG93PSI4MC4wMDAwMDAiIHhtcEc6YmxhY2s9IjcwLjAwMDAwMCIvPiA8L3JkZjpTZXE+IDwveG1wRzpDb2xvcmFudHM+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpsaT4gPHJkZjpsaT4gPHJkZjpEZXNjcmlwdGlvbiB4bXBHOmdyb3VwTmFtZT0iR3JheXMiIHhtcEc6Z3JvdXBUeXBlPSIxIj4gPHhtcEc6Q29sb3JhbnRzPiA8cmRmOlNlcT4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTAgWT0wIEs9MTAwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIxMDAuMDAwMDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTAgTT0wIFk9MCBLPTkwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSI4OS45OTk0MDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTAgWT0wIEs9ODAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMC4wMDAwMDAiIHhtcEc6YmxhY2s9Ijc5Ljk5ODgwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09MCBZPTAgSz03MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iNjkuOTk5NzAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTAgTT0wIFk9MCBLPTYwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSI1OS45OTkxMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTAgWT0wIEs9NTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjUwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09MCBZPTAgSz00MCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMzkuOTk5NDAwIi8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJDPTAgTT0wIFk9MCBLPTMwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIyOS45OTg4MDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTAgWT0wIEs9MjAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjAuMDAwMDAwIiB4bXBHOnllbGxvdz0iMC4wMDAwMDAiIHhtcEc6YmxhY2s9IjE5Ljk5OTcwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09MCBZPTAgSz0xMCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iOS45OTkxMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTAgWT0wIEs9NSIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iNC45OTg4MDAiLz4gPC9yZGY6U2VxPiA8L3htcEc6Q29sb3JhbnRzPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6bGk+IDxyZGY6bGk+IDxyZGY6RGVzY3JpcHRpb24geG1wRzpncm91cE5hbWU9IkJyaWdodHMiIHhtcEc6Z3JvdXBUeXBlPSIxIj4gPHhtcEc6Q29sb3JhbnRzPiA8cmRmOlNlcT4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9MCBNPTEwMCBZPTEwMCBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjEwMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIxMDAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09NzUgWT0xMDAgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI3NS4wMDAwMDAiIHhtcEc6eWVsbG93PSIxMDAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0wIE09MTAgWT05NSBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjEwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9Ijk1LjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkM9ODUgTT0xMCBZPTEwMCBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49Ijg1LjAwMDAwMCIgeG1wRzptYWdlbnRhPSIxMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIxMDAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz0xMDAgTT05MCBZPTAgSz0wIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIxMDAuMDAwMDAwIiB4bXBHOm1hZ2VudGE9IjkwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQz02MCBNPTkwIFk9MCBLPTAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOmN5YW49IjYwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSI5MC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMzEwMCIgeG1wRzpibGFjaz0iMC4wMDMxMDAiLz4gPC9yZGY6U2VxPiA8L3htcEc6Q29sb3JhbnRzPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6bGk+IDxyZGY6bGk+IDxyZGY6RGVzY3JpcHRpb24geG1wRzpncm91cE5hbWU9IkNvcnBvcmF0ZSIgeG1wRzpncm91cFR5cGU9IjEiPiA8eG1wRzpDb2xvcmFudHM+IDxyZGY6U2VxPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQ29ycG9yYXRlIExvZ28iIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzp0aW50PSIxMDAuMDAwMDAwIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6Y3lhbj0iMTcuNzA5NjIwIiB4bXBHOm1hZ2VudGE9IjUyLjI0NTM2MSIgeG1wRzp5ZWxsb3c9IjgzLjg5ODY3NSIgeG1wRzpibGFjaz0iMi4wNDQ3MDkiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkNvcnBvcmF0ZSBCcmFuZCIgeG1wRzp0eXBlPSJQUk9DRVNTIiB4bXBHOnRpbnQ9IjEwMC4wMDAwMDAiIHhtcEc6bW9kZT0iQ01ZSyIgeG1wRzpjeWFuPSIwLjc5MDQxNyIgeG1wRzptYWdlbnRhPSI5OC41NDQyODgiIHhtcEc6eWVsbG93PSI5NS4zNDkwNTAiIHhtcEc6YmxhY2s9IjAuMDg4NTAyIi8+IDwvcmRmOlNlcT4gPC94bXBHOkNvbG9yYW50cz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOmxpPiA8cmRmOmxpPiA8cmRmOkRlc2NyaXB0aW9uIHhtcEc6Z3JvdXBOYW1lPSJDb3Jwb3JhdGUgY29weSIgeG1wRzpncm91cFR5cGU9IjEiPiA8eG1wRzpDb2xvcmFudHM+IDxyZGY6U2VxPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQ29ycG9yYXRlIExvZ28gY29weSIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMTcuNzA5NjIwIiB4bXBHOm1hZ2VudGE9IjUyLjI0NTM2MSIgeG1wRzp5ZWxsb3c9IjgzLjg5ODY3NSIgeG1wRzpibGFjaz0iMi4wNDQ3MDkiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IkNvcnBvcmF0ZSBCcmFuZCBjb3B5IiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjc5MDQxNyIgeG1wRzptYWdlbnRhPSI5OC41NDQyODgiIHhtcEc6eWVsbG93PSI5NS4zNDkwNTAiIHhtcEc6YmxhY2s9IjAuMDg4NTAyIi8+IDwvcmRmOlNlcT4gPC94bXBHOkNvbG9yYW50cz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOmxpPiA8cmRmOmxpPiA8cmRmOkRlc2NyaXB0aW9uIHhtcEc6Z3JvdXBOYW1lPSJCbGFjayIgeG1wRzpncm91cFR5cGU9IjEiPiA8eG1wRzpDb2xvcmFudHM+IDxyZGY6U2VxPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iQmxhY2sgTG9nbyIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNzQuOTcyMTQ3IiB4bXBHOm1hZ2VudGE9IjY3LjkxOTQyNyIgeG1wRzp5ZWxsb3c9IjY3LjA0OTY2NCIgeG1wRzpibGFjaz0iOTAuMTQ1NzE5Ii8+IDxyZGY6bGkgeG1wRzpzd2F0Y2hOYW1lPSJCbGFjayBCcmFuZCIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iNzQuOTc1MTk5IiB4bXBHOm1hZ2VudGE9IjY3Ljg1ODM5MiIgeG1wRzp5ZWxsb3c9IjY3LjA0MzU2MSIgeG1wRzpibGFjaz0iOTAuMDQ4MDYzIi8+IDwvcmRmOlNlcT4gPC94bXBHOkNvbG9yYW50cz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOmxpPiA8cmRmOmxpPiA8cmRmOkRlc2NyaXB0aW9uIHhtcEc6Z3JvdXBOYW1lPSJXaGl0ZSIgeG1wRzpncm91cFR5cGU9IjEiPiA8eG1wRzpDb2xvcmFudHM+IDxyZGY6U2VxPiA8cmRmOmxpIHhtcEc6c3dhdGNoTmFtZT0iV2hpdGUgTG9nbyIgeG1wRzptb2RlPSJDTVlLIiB4bXBHOnR5cGU9IlBST0NFU1MiIHhtcEc6Y3lhbj0iMC4wMDAwMDAiIHhtcEc6bWFnZW50YT0iMC4wMDAwMDAiIHhtcEc6eWVsbG93PSIwLjAwMDAwMCIgeG1wRzpibGFjaz0iMC4wMDAwMDAiLz4gPHJkZjpsaSB4bXBHOnN3YXRjaE5hbWU9IldoaXRlIEJyYW5kIiB4bXBHOm1vZGU9IkNNWUsiIHhtcEc6dHlwZT0iUFJPQ0VTUyIgeG1wRzpjeWFuPSIwLjAwMDAwMCIgeG1wRzptYWdlbnRhPSIwLjAwMDAwMCIgeG1wRzp5ZWxsb3c9IjAuMDAwMDAwIiB4bXBHOmJsYWNrPSIwLjAwMDAwMCIvPiA8L3JkZjpTZXE+IDwveG1wRzpDb2xvcmFudHM+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpsaT4gPC9yZGY6U2VxPiA8L3htcFRQZzpTd2F0Y2hHcm91cHM+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+2O+yoAAACmFJREFUeNrtnL2ZqzoQht3BaYAuTESkCHehiGjpwpGcrBoRyZliaOcC+kEjCbC9nL0YDX54dgHz83r06RsJweVCE0000UQTTTTRdOqpP8OU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',
    });
  
    writeln('');
    writeCommentAndNote(localize('Post processor: {description} ({version})'), {
      description: description,
      version: semVer,
    });
    writeCommentAndNote(codeMoreInformation);
    writeCommentAndNote('');
  }
  
  /**
   * Writes the LightBurn (.lbrn) trailer information, including optionally adding notes and
   * closing off the LightBurnProject section opened in `writeHeader`.
   *
   * Notes are injected (if requested in post preferences by the user) using the `notes` variable.
   */
  function writeTrailer() {
    if (includeNotes != INCLUDE_NOTES_NONE && notes != '') {
      // determine if we cause LightBurn to show notes on file load
      let showOnLoad = false;
      if (includeNotes == INCLUDE_NOTES_SHOW_IMPORTANT)
        showOnLoad = notesImportant;
      else if (includeNotes == INCLUDE_NOTES_SHOW) showOnLoad = true;
  
      writeXML('Notes', {
        ShowOnLoad: showOnLoad ? 1 : 0,
        Notes: notes,
      });
    }
  
    writeXMLClose();
  }
  
  /**
   * Writes an XML tag to the output file, including adding indentation, parameters and optionally
   * leaving the tag open or closing it.  If the tag is left open, the tag name is pushed onto a stack
   * so a future call to `writeXMLClose` will close the matching tag.  When tags are left open, the
   * indentation of the XML is increased for pretty alignment.
   *
   * Members of the `parameters` object that are strings, numbers booleans are rendered as attributes for
   * the tag, except for the special property name 'content' (case sensitive) which will be rendered
   * as the content of the xml tag.
   *
   * @param tag Name of the tag
   * @param parameters Object containing key/value pairs for each parameter
   * @param leaveOpen Optional (default false) flag to specify to leave the tag open, pending a future call to `writeXMLClose`
   */
  function writeXML(tag, parameters, leaveOpen) {
    if (parameters === undefined) parameters = {};
    if (leaveOpen === undefined) leaveOpen = false;
  
    let xml = '<' + tag;
    for (key in parameters) {
      if (
        (typeof parameters[key] === 'string' ||
          typeof parameters[key] === 'number' ||
          typeof parameters[key] === 'boolean') &&
        key != 'content'
      ) {
        if (typeof parameters[key] === 'boolean')
          xml += ' ' + key + '="' + (parameters[key] ? 'True' : 'False') + '"';
        else xml += ' ' + key + '="' + encodeXML(parameters[key]) + '"';
      }
    }
  
    // we handle the content a bit differently if we are auto-closing the tag, since the
    // content needs to keep the tag open briefly
    if (leaveOpen) {
      xml += '>';
      if (parameters.content) xml += encodeXML(parameters.content);
    } else {
      if (parameters.content)
        xml += '>' + encodeXML(parameters.content) + '</' + tag + '>';
      else xml += ' />';
    }
  
    writeBlock(xml);
    if (leaveOpen) xmlStack.push(tag);
  }
  
  /**
   * Close a tag previously opened with `writeXML` (with `leaveOpen` set to true).  All calls to open/close must
   * be symmetrical, as the tag name is stored in a stack and closed based on order of execution.  An error will
   * be generated if an attempt is made to close a tag when none exist on the stack.
   */
  function writeXMLClose() {
    if (xmlStack.length === 0) {
      error(
        localize('Internal error: Attempt to close XML tag when none are open.')
      );
      return;
    }
    writeBlock('</' + xmlStack.pop() + '>');
  }
  
  /**
      Write a single line to the file with multiple arguments.
    
      @param arguments Variable number of arguments to write to the file on a single line
    */
  function writeBlock() {
    const spaces = '                                        ';
    write(spaces.slice(0, xmlStack.length * 2));
    for (let i = 0; i < arguments.length; ++i) write(arguments[i]);
    writeln('');
  }
  
  /**
   * Format a string as a comment for XML
   *
   * @param text Text comment to format
   * @returns String with the XML formatted comment
   */
  function formatComment(text) {
    return '<!-- ' + text + ' -->';
  }
  
  /**
   * Write a comment formatted for XML to the file including a newine at the end.  User preferences
   * determines the detail level of comments.  Supports template strings (see `format`)
   *
   * @param template Template comment to format and write to the file
   * @param parameters Optional key/value dictionary with parameters from template (such as {name})
   * @param level Optional level of the comment (COMMENT_NORMAL, COMMENT_DETAIL, COMMENT_DEBUG, COMMENT_INSANE); defaults to COMMENT_NORMAL
   */
  function writeComment(template, parameters, level) {
    const text = format(template, parameters);
    text = text.replace(/[ \n]+$/, '');
  
    if (level === undefined) level = COMMENT_NORMAL;
    switch (includeComments) {
      case INCLUDE_COMMENTS_NONE:
        return;
      case INCLUDE_COMMENTS_NORMAL:
        if (level > COMMENT_NORMAL) return;
        break;
      case INCLUDE_COMMENTS_DETAILED:
        if (level > COMMENT_DETAIL) return;
        break;
      case INCLUDE_COMMENTS_DEBUG:
        if (level > COMMENT_DEBUG) return;
        break;
      case INCLUDE_COMMENTS_INSANE:
        break;
    }
  
    if (text == '\n' || text == '') writeln('');
    else {
      var commentPrefix = '';
      if (level == COMMENT_DEBUG) commentPrefix = '+ ';
      else if (level == COMMENT_INSANE) commentPrefix = '! ';
      writeBlock(formatComment(commentPrefix + text));
    }
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
   * Helper method to encode a string for XML
   *
   * @param string String to encode
   * @returns Encoded version of `str`
   */
  function encodeXML(string) {
    string = string.toString();
    for (key in xmlEncodeMap) {
      while (true) {
        const encoded = string.replace(key, xmlEncodeMap[key]);
        if (encoded === string) break;
        string = encoded;
      }
    }
    return string;
  }
  
  /**
   * Helper method to decode a string encoded for XML
   *
   * @param string String to decode
   * @returns Decoded version of `str`
   */
  function decodeXML(string) {
    for (key in xmlEncodeMap) {
      while (true) {
        const decoded = string.replace(xmlEncodeMap[key], key);
        if (decoded === string) break;
        string = decoded;
      }
    }
    return string;
  }
  
  /**
   * Simple XML parser
   *
   * This limited parser handles nested xml tags with attributes.  It has support
   * only for non-duplicate tag names with attributes and content within a tag.
   * There is no handling of special character codes for xml.  Very limited
   * detection of malformed XML.  Results in a nested object where the name of the
   * tag is the name of the member of the object, and the value of the member is
   * either the value of an attribute, or another object (for nested xml).
   *
   * For example:
   *
   * `<one><two v1="1" v2="2"><three v3="3" /><four>example</four></two></one>`
   *
   * translates to:
   *
   * `{ one: { two: { v1: '1', v2: '2', three: { v3: '3' }, four: { content: 'example' } } } }`
   *
   * @param xml XML string to parse
   * @returns Nested object with members, of undefined if XML could not be parsed.
   */
  function parseXML(xml) {
    let startTagPos = -1;
    let endTagPos = 0;
    let tagEndPosition = 0;
    let objStack = [{}];
  
    while (true) {
      // locate the starting tag and ending of the tag
      startTagPos = xml.indexOf('<', startTagPos + 1);
      if (startTagPos === -1) break;
      endTagPos = xml.indexOf('>', startTagPos + 1);
      if (endTagPos === -1) return undefined;
  
      let xmlElement = xml.substring(startTagPos, endTagPos + 1);
      // ignore processing instructions, such as <?xml?>
      if (xmlElement[1] === '?') continue;
  
      // if this is a closing element pop up to the parent tag/object
      if (xmlElement[1] === '/') {
        objStack.pop();
        continue;
      }
  
      // identify just the tag (name) of the xml element and if it is self-closing
      tagEndPosition = xmlElement.indexOf(' ');
      if (tagEndPosition === -1) tagEndPosition = xmlElement.length - 1;
      let tagName = xmlElement.substring(1, tagEndPosition);
      let selfContainedTag = xmlElement[xmlElement.length - 2] === '/';
  
      // create a new object for this tag
      let currentTagObject = {};
      objStack[objStack.length - 1][tagName] = currentTagObject;
      objStack.push(currentTagObject);
  
      // parse the attributes
      let match = xmlElement.match(/\w+\=\".*?\"/g);
      if (match !== null) {
        for (let i = 0; i < match.length; i++) {
          let index = match[i].indexOf('"');
          let attrName = match[i].substring(0, index - 1);
          let attrValue = match[i].substring(index + 1, match[i].length - 1);
          currentTagObject[attrName] = decodeXML(attrValue);
        }
      }
  
      // if this is a self-contained tag, close it by poping the object off the stack
      if (selfContainedTag) objStack.pop();
      else {
        let nextTagPos = xml.indexOf('<', endTagPos + 1);
        if (nextTagPos > endTagPos + 1) {
          var content = xml.substring(endTagPos + 1, nextTagPos).trim();
          if (content.length) currentTagObject['content'] = decodeXML(content);
        }
      }
    }
  
    // make sure we have decended back to the top element
    if (objStack.length != 1) return undefined;
  
    return objStack[0];
  }
  
  /**
   * Write an object as a nested XML sequence to the file.  Uses the same object format as provided by
   * `parseXML`, where properties that are strings/numbers/booleans are treated as attributes of the
   * tag, and objects are treated as child XML tags to be descended into.
   *
   * @param tag Tag of the parent object
   * @param obj Object to enumerate and write as XML
   */
  function writeXMLObject(tag, obj) {
    let hasChildren = false;
    for (key in obj) {
      if (typeof obj[key] === 'object') {
        hasChildren = true;
        break;
      }
    }
    writeXML(tag, obj, hasChildren);
    if (hasChildren) {
      for (key in obj) {
        if (typeof obj[key] === 'object') writeXMLObject(key, obj[key]);
      }
      writeXMLClose();
    }
  }
  
  /**
   * Converts a speed (in mm/min) to a string used for comments and notes according to the user
   * selected preference.
   *
   * @param speed Speed (already in the correct units)
   * @returns String with "### mm/min" or "### mm/sec"
   */
  function speedToUnits(speedInMMPM) {
    const speedUnits = getProperty('machine0100SpeedUnits');
    if (speedUnits == SPEED_UNITS_MMPM)
      return formatSpeed.format(speedInMMPM) + ' ' + localize('mm/min');
  
    return formatSpeed.format(speedInMMPM) + ' ' + localize('mm/sec');
  }
  
  /**
   * String template service, similar to template literals in more modern javascript engines.  The template
   * string can have parameters in braces, such as "My name is {name}".  The second parameter is an object
   * with named parameters to substitute, in this example {name: "Billy"}.
   *
   * @param template Template string to format
   * @param parameters Key/value dictionary of parameters to substitute
   * @returns Formatted string
   */
  function format(template, parameters) {
    // callback to replace that handles {tag} and swaps parameters[tag] (handling boolean)
    function replaceToken(parameterWithBraces) {
      const parameterName = parameterWithBraces.substring(
        1,
        parameterWithBraces.length - 1
      );
      const replacement = parameters ? parameters[parameterName] : parameterName;
      if (typeof replacement === 'boolean') return replacement ? 'True' : 'False';
      return replacement !== undefined ? replacement : parameterWithBraces;
    }
  
    return template.replace(/{\w+}/g, replaceToken);
  }
  
  