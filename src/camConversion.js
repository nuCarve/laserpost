/**************************************************************************************
 *
 * LaserPost module: camConversion.js
 * 
 * Group and Project services.  Handles the heavy lifting of converting CAM paths
 * to LightBurn objects (layers, vectors and primitives), including grouping and path closures.
 *
 *************************************************************************************/

/**
 * Gets a group object by name.  If the group does not already exist (in the `groups` array)
 * it is instantiated.  `defaults` is an object that defines the settings for the group should the
 * group not already exist.
 *
 * @param groupName Name of group to locate or instantiate (undefined if stand alone group)
 * @param defaults Object containing default values for the group if new one needs to be created.
 * @returns An individual group from the `groups` array (new or existing)
 */
 function getGroup(groupName, defaults) {
    let group = undefined;
    if (groupName)
      for (let l = 0; l < groups.length; ++l) {
        if (
          groups[l].groupName &&
          groups[l].groupName.toLowerCase() == groupName.toLowerCase()
        ) {
          group = groups[l];
          break;
        }
      }
    if (!group) {
      writeComment(
        'getGroup: Create new group "{group}"',
        { group: groupName },
        COMMENT_DEBUG
      );
      groups.push(defaults);
      group = groups[groups.length - 1];
    } else
      writeComment(
        'getGroup: Join existing group "{group}"',
        { group: groupName },
        COMMENT_DEBUG
      );
    return group;
  }
  
  /**
   * Converts the `groups` array into the `project` array, converting CAM style paths metrics into
   * LightBurn CutSettings and Shapes objects.
   *
   * This must be called after all CAM operations are complete, and prior to accessing any information
   * in the `project` array.
   */
  function groupsToProject() {
    // loop through all groups
    for (let g = 0; g < groups.length; ++g) {
      const group = groups[g];
  
      // create a new operationGroup in the project to group all the operations together in LightBurn
      // that share the same group name
      project.operationGroups.push({
        groupName: group.groupName,
        operations: [],
      });
      const projOpGroup =
        project.operationGroups[project.operationGroups.length - 1];
  
      // loop through all operations on this group
      for (let o = 0; o < group.operations.length; ++o) {
        const operation = group.operations[o];
  
        // if no points, skip this one
        if (operation.paths.length == 0) continue;
  
        // set up a project operation inside the project group (each operation is grouped to make managing them in LightBurn easier)
        const index = projOpGroup.operations.push({
          shapeGroups: [],
          operationName: operation.operationName,
        });
        const projOperation = projOpGroup.operations[index - 1];
  
        // find (or create) a layer (<CutSetting>) for this operation (all shapes within
        // a CAM operation share the same cut setting)
        const cutSetting = getCutSetting({
          name: operation.operationName,
          minPower: operation.minPower,
          maxPower: operation.maxPower,
          speed: operation.paths[0].feed / 60, // LightBurn is mm/sec, CAM is mm/min
          layerMode: operation.layerMode,
          laserEnable: operation.laserEnable,
          powerSource: operation.powerSource,
          useAir: operation.useAir,
          zOffset: operation.zOffset,
          passes: operation.passes,
          zStep: operation.zStep,
          customCutSettingXML: operation.customCutSettingXML,
          customCutSetting: operation.customCutSetting,
        });
  
        // convert the group (paths) into segments (groups of shapes)
        const segments = identifySegments(operation, cutSetting);
  
        // build out shapes for each segments
        generateShapesFromSegments(
          operation,
          segments,
          cutSetting,
          projOperation
        );
      }
    }
  
    // dump the project to comments to assist with debugging problems
    dumpProject();
  }
  
  /**
   * Identifies from operation (paths) the groupings of segments (start/end/type) to define LightBurn shapes
   *
   * Breaks apart individual paths into logical segments open paths (series of lines), closed paths (where start and end
   * point are the same), and circles (by definition, a closed path).
   *
   * Paths from CAM sometimes have segments as lead-ins (for example, a through cut adds a short cut to ensure a full cut
   * at the start / end of the geometry), and so to make sure we can close shapes whenever possible (when end point of a cut
   * matches the start point of the geometry), we need to search across all the paths in the operation, and break them
   * into unique path sets - where each set is a contiguous path from start to end and broken out into a separate set whenever
   * the geometry can be closed (to define a fillable shape in LightBurn).
   *
   * @param operation Operation containing the path points
   * @param cutSetting The cutSetting to use with this operation
   * @returns Array of start/end indexes (of operation paths) and if the shape is closed ([{start, end, closed}]
   */
  function identifySegments(operation, cutSetting) {
    const segments = [];
    let startSegment = 0;
    for (
      let currentSegment = 0;
      currentSegment < operation.paths.length;
      ++currentSegment
    ) {
      startPath = operation.paths[startSegment];
      const currentPath = operation.paths[currentSegment];
  
      // if this is a circle, break it off as circles are single point closed shapes
      if (currentPath.type == PATH_TYPE_CIRCLE) {
        if (startSegment != currentSegment) {
          // break off the prior elements
          segments.push({
            start: startSegment,
            end: currentSegment - 1,
            closed: false,
          });
          writeComment(
            'groupsToProject: Breaking off open segment (due to next circle): {start} to {end}',
            { start: startSegment, end: currentSegment - 1 },
            COMMENT_INSANE
          );
        }
        // break off the circle itself
        segments.push({
          start: currentSegment,
          end: currentSegment,
          closed: true,
        });
        writeComment(
          'groupsToProject: Breaking off closed segment (circle): {start} to {end}',
          {
            start: currentSegment,
            end: currentSegment,
          },
          COMMENT_INSANE
        );
        startSegment = currentSegment + 1;
        continue;
      }
  
      // other than circle, the first segment can be ignored as decisions are made based on the segments that follow it
      if (startSegment != currentSegment) {
        // is our end point the same as any prior start point in this segment?  If so, we need to connect them,
        // and may need to break apart the segment if it isn't at the first path
        for (let i = startSegment; i < currentSegment; ++i) {
          const checkPath = operation.paths[i];
          if (
            currentPath.endX == checkPath.startX &&
            currentPath.endY == checkPath.startY
          ) {
            // we have a closure - so we need to take the paths prior to this new segment and save them
            // as one segment (including this ending point), and then take our new paths and save as another segment.
            if (startSegment != i) {
              segments.push({ start: startSegment, end: i - 1, closed: false });
              writeComment(
                'groupsToProject: Breaking off open segment (due to next closure): {start} to {end}',
                { start: startSegment, end: i - 1 },
                COMMENT_INSANE
              );
            }
            segments.push({ start: i, end: currentSegment, closed: true });
            writeComment(
              'groupsToProject: Breaking off closed segment: {start} to {end}',
              { start: i, end: currentSegment },
              COMMENT_INSANE
            );
            startSegment = currentSegment + 1;
            break;
          }
        }
        // if we closed out this segment, go back to do the next one
        if (startSegment == currentSegment + 1) continue;
        // is our current path not the same as our prior end?  If so, we have a move operation so we need to start a new segment
        const priorPath = operation.paths[currentSegment - 1];
        if (
          currentPath.startX != priorPath.endX ||
          currentPath.startY != priorPath.endY
        ) {
          segments.push({
            start: startSegment,
            end: currentSegment - 1,
            closed: false,
          });
          writeComment(
            'groupsToProject: Breaking off open segment (due to move): {start} to {end}',
            { start: startSegment, end: currentSegment - 1 },
            COMMENT_INSANE
          );
          startSegment = currentSegment;
        }
      }
      // is this the last segment?  Break off what remains
      if (currentSegment == operation.paths.length - 1) {
        segments.push({
          start: startSegment,
          end: currentSegment,
          closed: false,
        });
        writeComment(
          'groupsToProject: Breaking off open segment (due to last segment): {start} to {end}',
          { start: startSegment, end: currentSegment },
          COMMENT_INSANE
        );
      }
    }
  
    // dump the segments into insane comments
    writeComment('groupsToProject: Segmentation list:', {}, COMMENT_INSANE);
    for (let i = 0; i < segments.length; ++i)
      writeComment(
        '  #{num}: {start} to {end} ({openClosed})',
        {
          num: i,
          start: segments[i].start,
          end: segments[i].end,
          openClosed: segments[i].closed ? 'closed' : 'open',
        },
        COMMENT_INSANE
      );
  
    return segments;
  }
  
  /**
   * Constructs LightBurn style shapes from a series of segments.
   *
   * Walks all segments and builds LightBurn shapes for each of them.  Handles the conversion of CAM style paths
   * to LightBurn style shapes (including bezier and circle conversions).
   *
   * @param operation The CAM operation, where the path metrics can be found
   * @param segments The segmentation index of each shape (which references operation for the metrics)
   * @param cutSetting The cutSettings (aka LightBurn layer) that will be used for these shapes
   * @param projOperation The project operation object, where the resolved shapes are added for grouping
   */
  function generateShapesFromSegments(
    operation,
    segments,
    cutSetting,
    projOperation
  ) {
    // process all segments and convert them into shapes (vectors and primities), including conversion of
    // non-linear paths from circular (start/end/center points) to bezier (center point, with two control points)
    for (let i = 0; i < segments.length; ++i) {
      const segment = segments[i];
  
      // create a new shape in our shapeGroup for this operation (to group the shapes together by operation)
      projOperation.shapeGroups.push({
        cutIndex: cutSetting.index,
      });
      const shape =
        projOperation.shapeGroups[projOperation.shapeGroups.length - 1];
  
      // build out the shape.
      if (operation.paths[segment.start].type == PATH_TYPE_CIRCLE)
        // cirlces create LightBurn elipses (no vertex/primitive)
        generateElipseShape(
          shape,
          operation.paths[segment.start],
          operation.powerScale
        );
      // all other shapes (linear, semicircle) become LightBurn Paths using vertex/primitives
      else
        generatePathShape(
          shape,
          operation,
          segment.start,
          segment.end,
          segment.closed,
          operation.powerScale
        );
    }
  }
  
  /**
   * Generates a LightBurn Elipse, from a full circle CAM operation
   *
   * Converts the CAM style path (start xy and center xy) into LightBurn style
   * elipse of center xy and radius.
   *
   * @param shape Shape object to complete with the elipse information
   * @param path Path data for the CAM full circle
   * @param powerScale Power scale to use for this shape
   */
  function generateElipseShape(shape, path, powerScale) {
    // determine the radius of this circle
    const deltaX = path.startX - path.centerX;
    const deltaY = path.startY - path.centerY;
    const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
    // add the shape
    shape.type = SHAPE_TYPE_ELIPSE;
    shape.centerX = path.centerX;
    shape.centerY = path.centerY;
    shape.radius = radius;
    shape.powerScale = powerScale;
  }
  
  /**
   * Generates a LightBurn Path, from CAM operations
   *
   * Handles the creation of a LightBurn Path shape, including the conversion of CAM style paths (center, start and
   * end points) into LightBurn style paths (cubic bezier vectors and primitives that connect them).
   *
   * @param shape Shape object to complete with the path information
   * @param operation Path data for all shapes within this operation
   * @param segmentStart Index into operation to the path that starts this shape
   * @param segmentEnd Index into operation to the path that completes this shape
   * @param segmentClosed `true` if this is a closed shape, `false` if it is an open shape
   * @param powerScale Power scale to use for this shape
   */
  function generatePathShape(
    shape,
    operation,
    segmentStart,
    segmentEnd,
    segmentClosed,
    powerScale
  ) {
    // regular path shape (any combination of PATH_TYPE_LINEAR and PATH_TYPE_SEMICIRCLE)
    shape.type = SHAPE_TYPE_PATH;
    shape.vectors = [];
    shape.primitives = [];
    shape.powerScale = powerScale;
  
    // define a variable to track the entry bezier control point into the next vector
    let c1 = undefined;
  
    // gather all points from the segment (from start to end) into vectors (the individual points) and primitives (the connection between vectors)
    // this is also where we do the conversion of circular paths into bezier curves for LightBurn
    for (p = segmentStart; p <= segmentEnd; ++p) {
      const path = operation.paths[p];
  
      switch (path.type) {
        case PATH_TYPE_LINEAR:
          shape.vectors.push({
            x: path.startX,
            y: path.startY,
            c1x: c1 ? c1.x : undefined, // there may be a bezier control point from the last curve that needs to be applied
            c1y: c1 ? c1.y : undefined,
          });
  
          // add a primitive connecting the vectors, except if we are on the first one (we don't have a line yet)
          if (p != segmentStart)
            shape.primitives.push({
              type: c1 ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
              start: shape.vectors.length - 2,
              end: shape.vectors.length - 1,
            });
  
          // clear the bezier control point as we have now consumed it (if it was in use)
          c1 = undefined;
  
          break;
        case PATH_TYPE_SEMICIRCLE:
          // convert the path style curvature (start, end, centerpoint) into bezier vectors - which can result in more vectors to make the curve
          const curves = circularToBezier(
            { x: path.startX, y: path.startY },
            { x: path.endX, y: path.endY },
            { x: path.centerX, y: path.centerY },
            path.clockwise
          );
  
          // debug info
          writeComment(
            'generatePathShape: converting to bezier [{startX}, {startY}] to [{endX}, {endY}] center [{centerX}, {centerY}]',
            {
              startX: formatPosition.format(path.startX),
              startY: formatPosition.format(path.startY),
              endX: formatPosition.format(path.endX),
              endY: formatPosition.format(path.endY),
              centerX: formatPosition.format(path.centerX),
              centerY: formatPosition.format(path.centerY),
            },
            COMMENT_INSANE
          );
  
          // process all curves
          let startX = path.startX;
          let startY = path.startY;
  
          for (let i = 0; i < curves.length; ++i) {
            // debug
            writeComment(
              '  #{num}: end=[{x}, {y}], 1=[{x1}, {y1}], 2=[{x2}, {y2}]',
              {
                num: i,
                x: formatPosition.format(curves[i].x),
                y: formatPosition.format(curves[i].y),
                x1: formatPosition.format(curves[i].x1),
                y1: formatPosition.format(curves[i].y1),
                x2: formatPosition.format(curves[i].x2),
                y2: formatPosition.format(curves[i].y2),
              },
              COMMENT_INSANE
            );
  
            // set up the control points for exiting this vector
            let c0 = { x: curves[i].x1, y: curves[i].y1 };
  
            // push this vector into the list
            shape.vectors.push({
              x: startX,
              y: startY,
              c0x: c0.x,
              c0y: c0.y,
              c1x: c1 ? c1.x : undefined, // include the entry control point if the prior vector had left it for us
              c1y: c1 ? c1.y : undefined,
            });
  
            // add a primitive to connect them, except if we are on the first one (we don't have a line yet)
            if (p + i != segmentStart)
              shape.primitives.push({
                type: c1 ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
                start: shape.vectors.length - 2,
                end: shape.vectors.length - 1,
              });
  
            // set up the control point for entering the next vector
            c1 = { x: curves[i].x2, y: curves[i].y2 };
  
            // update start position to reflect where this curve ended
            startX = curves[i].x;
            startY = curves[i].y;
          }
          break;
      }
    }
    // if this is a closed segment, add a primitive to connect the last to the first, and update
    // the starting vector to have the entry bezier control point if we have one.  If an open
    // segment, add the final vector and primitive to connect them.
    if (segmentClosed) {
      // closed - so connect primitive to start vector as our ending point
      shape.primitives.push({
        type: c1 ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
        start: shape.vectors.length - 1,
        end: 0,
      });
      shape.vectors[0].c1x = c1 ? c1.x : undefined;
      shape.vectors[0].c1y = c1 ? c1.y : undefined;
    } else {
      // open - so add the final vector and connect them
      shape.vectors.push({
        x: operation.paths[segmentEnd].endX,
        y: operation.paths[segmentEnd].endY,
        c0x: undefined,
        c0y: undefined,
        c1x: c1 ? c1.x : undefined, // include the entry control point if the prior vector had left it for us
        c1y: c1 ? c1.y : undefined,
      });
      shape.primitives.push({
        type: c1 ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
        start: shape.vectors.length - 2,
        end: shape.vectors.length - 1,
      });
    }
  }
  
  /**
   * Converts a circular coordinate system (such as used CAM onCircular, and gcode G2/G3) into a bezier curve (as
   * used by LightBurn).  Accepts a start point, end point, center point of the circle, and a flag indicating if
   * we are moving clockwise or counterclockwise.  Returns an array of curves, containing {x, y, x1, y1, x2, y2}
   * where x/y is the end point of the curve, x1/y1 are the starting control points for the bezier, and x2/y2 are
   * the ending control points for the bezier.
   *
   * @param startPoint Start position {x, y}
   * @param endPoint  End position {x, y}
   * @param centerPoint Center point of the circle {x, y}
   * @param clockwise `true` if moving clockwise, `false` if counterclockwise
   * @returns Array of curves
   */
  function circularToBezier(startPoint, endPoint, centerPoint, clockwise) {
    // determine distance of lines from center to start and end
    const startCenterDelta = {
      x: startPoint.x - centerPoint.x,
      y: startPoint.y - centerPoint.y,
    };
    const endCenterDelta = {
      x: endPoint.x - centerPoint.x,
      y: endPoint.y - centerPoint.y,
    };
  
    // determine the radius of the arc
    const radius = Math.sqrt(
      startCenterDelta.x * startCenterDelta.x +
        startCenterDelta.y * startCenterDelta.y
    );
  
    // determine the angle of the center-to-start and center-to-end lines (radians)
    const angleCenterStart = Math.atan2(startCenterDelta.y, startCenterDelta.x);
    const angleCenterEnd = Math.atan2(endCenterDelta.y, endCenterDelta.x);
  
    // determine the angle from the center/start to the center/end, which is used to determine if we
    // are going clockwise or counterclockwise the short or long way
    let angleStartCenterEnd = angleCenterEnd - angleCenterStart;
    // let TEMPBEFORE = angleStartCenterEnd;
    if (angleStartCenterEnd >= Math.PI) angleStartCenterEnd -= Math.PI * 2;
    if (angleStartCenterEnd < 0) angleStartCenterEnd += Math.PI * 2;
  
    // if our clockwise direction is the long way, set largeArcFlag so bezier generates the long way around
    const largeArcFlag = clockwise == angleStartCenterEnd <= Math.PI / 2;
  
    // convert circular (points/radius) to bezier
    const curves = arcToBezier({
      px: startPoint.x,
      py: startPoint.y,
      cx: endPoint.x,
      cy: endPoint.y,
      rx: radius,
      ry: radius,
      xAxisRotation: 0,
      largeArcFlag: largeArcFlag,
      sweepFlag: !clockwise,
    });
  
    return curves;
  }
  
  /**
   * Gets a cutSetting object that matches the specifications provided in the `cutSettingSpecs` parameter.  Scans all existing cutSettings in the
   * current project array and if an exact match is found, it returns that object (potentially doing a name change).  If none exist yet, it creates a new
   * entry using the provided specs and returns that.
   *
   * @param cutSettingSpecs Cut settings object, including parameters such as minPower, maxPower and layerMode.
   * @returns The cutSetting object from the project that matches the specs (creating one if a match isn't found)
   */
  function getCutSetting(cutSettingSpecs) {
    for (let c = 0; c < project.cutSettings.length; ++c) {
      const cutSetting = project.cutSettings[c];
      let matchFound = false;
  
      // look to see if we already have a matching cutsetting, based on the custom XML if provided,
      // otherwise the properties of the setting
      if (cutSettingSpecs.customCutSettingXML)
        // if custom cut is used, we expect a perfect string match.  This might someday be
        // improved with a deep object comparison (preceeded by filtering out unwanted fields)
        matchFound =
          cutSetting.customCutSettingXML == cutSettingSpecs.customCutSettingXML;
      // standard properties - see if we match
      else
        matchFound =
          cutSetting.minPower == cutSettingSpecs.minPower &&
          cutSetting.maxPower == cutSettingSpecs.maxPower &&
          cutSetting.speed == cutSettingSpecs.speed &&
          cutSetting.layerMode == cutSettingSpecs.layerMode &&
          cutSetting.laserEnable == cutSettingSpecs.laserEable &&
          cutSetting.useAir == cutSettingSpecs.useAir &&
          cutSetting.zOffset == cutSettingSpecs.zOffset &&
          cutSetting.passes == cutSettingSpecs.passes &&
          cutSetting.zStep == cutSettingSpecs.zStep &&
          cutSetting.customCutSetting === undefined;
  
      // do we have a match?
      if (matchFound) {
        // add this name to the list of operation names that this combined setting is being used for
        cutSetting.operationNames.push(cutSettingSpecs.name);
  
        // combine operation names for the layer name
        cutSetting.name = cutSetting.operationNames.join(', ');
        return cutSetting;
      }
    }
  
    // none exist that match, so create a new one
    cutSettingSpecs.index = project.cutSettings.length;
    cutSettingSpecs.priority = project.cutSettings.length;
    cutSettingSpecs.operationNames = [cutSettingSpecs.name];
    const cutLength = project.cutSettings.push(cutSettingSpecs);
    return project.cutSettings[cutLength - 1];
  }
  
  /**
   * Creates a stock outline with the laser disabled using a pseudo-operation that traces the four
   * sides of the stock
   */
  function traceStockOutline() {
    // get the stock dimensions
    const stock = {
      minX: getGlobalParameter('stock-lower-x'),
      minY: getGlobalParameter('stock-lower-y'),
      maxX: getGlobalParameter('stock-upper-x'),
      maxY: getGlobalParameter('stock-upper-y'),
    };
  
    // set up a private group
    currentGroup = getGroup(STOCK_GROUP_NAME, {
      groupName: STOCK_GROUP_NAME,
      operations: [],
    });
  
    // set up an operation to contain the stock outline
    const paths = [];
    currentGroup.operations.push({
      operationName: STOCK_GROUP_NAME,
      minPower: 100,
      maxPower: 100,
      laserEnable: LASER_ENABLE_OFF,
      layerMode: LAYER_MODE_LINE,
      powerScale: 100,
      powerSource: localize('stock dimensions'),
      customCutSettingXML: '',
      paths: paths,
    });
  
    // add a path outlining the stock
    paths.push({
      type: PATH_TYPE_LINEAR,
      startX: stock.minX + workspaceOffsets.x,
      startY: stock.minY + workspaceOffsets.y,
      endX: stock.maxX + workspaceOffsets.x,
      endY: stock.minY + workspaceOffsets.y,
      feed: STOCK_FEED_RATE,
    });
    paths.push({
      type: PATH_TYPE_LINEAR,
      startX: stock.maxX + workspaceOffsets.x,
      startY: stock.minY + workspaceOffsets.y,
      endX: stock.maxX + workspaceOffsets.x,
      endY: stock.maxY + workspaceOffsets.y,
      feed: STOCK_FEED_RATE,
    });
    paths.push({
      type: PATH_TYPE_LINEAR,
      startX: stock.maxX + workspaceOffsets.x,
      startY: stock.maxY + workspaceOffsets.y,
      endX: stock.minX + workspaceOffsets.x,
      endY: stock.maxY + workspaceOffsets.y,
      feed: STOCK_FEED_RATE,
    });
    paths.push({
      type: PATH_TYPE_LINEAR,
      startX: stock.minX + workspaceOffsets.x,
      startY: stock.maxY + workspaceOffsets.y,
      endX: stock.minX + workspaceOffsets.x,
      endY: stock.minY + workspaceOffsets.y,
      feed: STOCK_FEED_RATE,
    });
  }
  