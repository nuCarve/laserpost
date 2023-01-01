/**************************************************************************************
 *
 * LaserPost module: camConversion.js
 *
 * Group and Project services.  Handles the heavy lifting of converting CAM paths
 * to LightBurn objects (layers, vectors and primitives), including grouping and path closures.
 *
 *************************************************************************************/

/**
 * Converts the `groups` array into the `project` array, converting CAM style paths metrics into
 * LightBurn CutSettings and Shapes objects.
 *
 * This must be called after all CAM operations are complete, and prior to accessing any information
 * in the `project` array.
 */
function groupsToProject() {
  // loop through all groups
  for (let groupIndex = 0; groupIndex < groups.length; ++groupIndex) {
    const group = groups[groupIndex];

    // create a new operation set in the project to collect all the operations together in LightBurn
    // that share the same group name
    project.operationSets.push({
      groupName: group.groupName,
      operations: [],
    });
    const projOpSet = project.operationSets[project.operationSets.length - 1];

    // loop through all operations on this group
    for (
      let operationIndex = 0;
      operationIndex < group.operations.length;
      ++operationIndex
    ) {
      const groupOperation = group.operations[operationIndex];

      // if no points, skip this one
      if (groupOperation.paths.length == 0) continue;

      // set up a project operation inside the project set (each operation is grouped to make managing them in LightBurn easier)
      const index = projOpSet.operations.push({
        shapeSets: [],
        operationName: groupOperation.operationName,
      });
      const projOperation = projOpSet.operations[index - 1];

      // determine the feedrate to use.  CAM specifies feedrate at the operation level, but only delivers it
      // during individual movements.  Technically three feedrates are available - cutting, lead-in and lead-out.
      // Eventually we may build out a unique layer for each speed, but for now we just use the cutting speed.
      // To find the cutting speed, we pull the value from the interior of the path, as lead-in and lead-out are
      // always out the "outside" edges. We also scan until we find a value as we may have a MOVE path type which
      // might not have a feedrate
      let feedrate = 0;
      for (
        pathIndex = Math.floor(groupOperation.paths.length / 2);
        pathIndex < groupOperation.paths.length;
        ++pathIndex
      ) {
        if (groupOperation.paths[pathIndex].feed > 0) {
          feedrate = groupOperation.paths[pathIndex].feed;
          break;
        }
      }

      // find (or create) a layer (<CutSetting>) for this operation (all shapes within
      // a CAM operation share the same cut setting)
      const cutSetting = getCutSetting({
        name: groupOperation.operationName,
        minPower: groupOperation.minPower,
        maxPower: groupOperation.maxPower,
        speed: feedrate / 60, // LightBurn is mm/sec, CAM is mm/min
        layerMode: groupOperation.layerMode,
        laserEnable: groupOperation.laserEnable,
        powerSource: groupOperation.powerSource,
        useAir: groupOperation.useAir,
        zOffset: groupOperation.zOffset,
        passes: groupOperation.passes,
        zStep: groupOperation.zStep,
        kerf: groupOperation.kerf,
        customCutSettingXML: groupOperation.customCutSettingXML,
        customCutSetting: groupOperation.customCutSetting,
      });

      // convert the group (paths) into segments (groups of shapes)
      const segments = identifySegments(groupOperation);

      // build out shapes for each segments
      generateShapesFromSegments(
        groupOperation,
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
 * matches the start point of the geometry), we search across all the paths in the operation, and break them
 * into unique path sets - where each set is a contiguous path from start to end and broken out into a separate set whenever
 * the geometry can be closed (to define a fillable shape in LightBurn).
 *
 * @param operation Operation containing the path points
 * @returns Array of start/end indexes (of operation paths) and if the shape is closed ([{start, end, closed}])
 */
function identifySegments(operation) {
  const segments = [];

  // all operations must start with a PATH_TYPE_MOVE to set the starting position
  if (operation.paths[0].type !== PATH_TYPE_MOVE) {
    error(localize('CAM operations error: Missing starting position'));
    return [];
  }

  // two "passes": First we find operation defined segments (where a set of laser-on movements are grouped separated
  // by laser-off periods, or where natural full ellipse segments exist).  Then, for non-ellipse segments, we
  // then scan that area to see if we can find the largest closed segment available and break it out from any
  // prior/ending non-closed segments.
  let opSegmentStart = 0;

  for (
    let opSegmentIndex = 0;
    opSegmentIndex <= operation.paths.length;
    ++opSegmentIndex
  ) {
    // get a reference to the segment path, except if at the very end (past the last path segment) as we
    // simulate a MOVE operation so we can see if there is anything to break off
    const opSegmentPath =
      opSegmentIndex < operation.paths.length
        ? operation.paths[opSegmentIndex]
        : { type: PATH_TYPE_MOVE };

    if (
      opSegmentPath.type == PATH_TYPE_MOVE ||
      opSegmentPath.type == PATH_TYPE_CIRCLE
    ) {
      // we have a natural break from opSegmentStart thru (opSegmentIndex - 1)
      if (opSegmentStart < opSegmentIndex) {
        const independentSegments = scanSegmentForClosure(
          opSegmentStart,
          opSegmentIndex - 1,
          operation
        );

        for (let indSegIndex = 0; indSegIndex < independentSegments.length; ++indSegIndex) {
          const nextSegment = independentSegments[indSegIndex];
          segments.push({
            start: nextSegment.start,
            end: nextSegment.end,
            closed: nextSegment.closed,
            type: SEGMENT_TYPE_PATH,
          });
        }
      }

      if (opSegmentPath.type == PATH_TYPE_CIRCLE) {
        // break off the circle itself
        segments.push({
          start: opSegmentIndex - 1,
          end: opSegmentIndex,
          closed: true,
          type: SEGMENT_TYPE_CIRCLE,
        });

        writeComment(
          'identifySegments: Breaking off closed segment (circle): {start} to {end}',
          {
            start: opSegmentIndex - 1,
            end: opSegmentIndex,
          },
          COMMENT_INSANE
        );

      }

      // set segment start to this segment
      opSegmentStart = opSegmentIndex;
    }
  }

  // dump the segments into insane comments
  writeComment('identifySegments: Segmentation list:', {}, COMMENT_INSANE);
  for (let segmentIndex = 0; segmentIndex < segments.length; ++segmentIndex) {
    let type;
    switch (segments[segmentIndex].type) {
      case SEGMENT_TYPE_CIRCLE:
        type = 'CIRCLE';
        break;
      case SEGMENT_TYPE_PATH:
        type = 'PATH';
        break;
      default:
        type = format('Unknown ({type})', {
          type: segments[segmentIndex].type,
        });
        break;
    }
    writeComment(
      '  #{num}: {type} {start} to {end} ({openClosed})',
      {
        num: segmentIndex,
        start: segments[segmentIndex].start,
        end: segments[segmentIndex].end,
        openClosed: segments[segmentIndex].closed ? 'closed' : 'open',
        type: type,
      },
      COMMENT_INSANE
    );
  }

  return segments;
}


/**
 * Scans a segment (of paths) to find the largest closure (if any).  Returns an array of segmentations, which
 * may be a single element array if no closures found (or a single perfect closure), and could contain as much
 * as three elements - one for a non-closed starting segment, one for a closed segment, and one for the non-closed
 * ending segment.
 * 
 * @param startIndex Starting index within the operation to scan
 * @param endIndex Ending index within the operation to scan
 * @param operation Operation entry with all paths
 * @returns Array containing the object {start, end, closed}
 */
function scanSegmentForClosure(startIndex, endIndex, operation) {
  // scan this natural operation segment to see if we can find a closure, using points from the end of the
  // segment and comparing them to the start of the segment and close out way inwards.  This helps to break
  // off any lead-in/lead-outs while finding the largest shape closure we can
  for (let endScanIndex = endIndex; endScanIndex > startIndex; --endScanIndex) {
    const endSegmentPath = operation.paths[endScanIndex];

    // now scan from start and come forwards looking for a closure
    for (
      let startScanIndex = startIndex;
      startScanIndex < endScanIndex;
      ++startScanIndex
    ) {
      const startSegmentPath = operation.paths[startScanIndex];

      // do an approximate comparison to see if we have a closure
      if (
        closeEquals(startSegmentPath.x, endSegmentPath.x) &&
        closeEquals(startSegmentPath.y, endSegmentPath.y)
      ) {
        // closure found, so break this operation apart
        const result = [];

        // break off prior if available
        if (startScanIndex > startIndex) {
          result.push({
            start: startIndex,
            end: startScanIndex,
            closed: false,
          });
          writeComment(
            'scanSegmentForClosure: Break off open segment (before closure): {start} to {end}',
            { start: startIndex, end: startScanIndex },
            COMMENT_INSANE
          );
        }

        // break off this closed segment
        result.push({ start: startScanIndex, end: endScanIndex, closed: true });
        writeComment(
          'scanSegmentForClosure: Break off closed segment: {start} to {end}',
          { start: startScanIndex, end: endScanIndex },
          COMMENT_INSANE
        );

        // break off trailing if available
        if (endScanIndex < endIndex) {
          result.push({
            start: endScanIndex,
            end: endIndex,
            closed: false,
          });
          writeComment(
            'scanSegmentForClosure: Break off open segment (after closure): {start} to {end}',
            { start: endScanIndex, end: endIndex },
            COMMENT_INSANE
          );
        }
        return result;
      }
    }
  }
  // none found
  writeComment(
    'scanSegmentForClosure: Fully open segment: {start} to {end}',
    { start: startIndex, end: endIndex },
    COMMENT_INSANE
  );
  return [{ start: startIndex, end: endIndex, closed: false }];
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
  for (let segmentIndex = 0; segmentIndex < segments.length; ++segmentIndex) {
    const segment = segments[segmentIndex];

    // create a new shape in our shape set for this operation (to organize the shapes together by operation)
    projOperation.shapeSets.push({
      cutSetting: cutSetting,
    });
    const shape = projOperation.shapeSets[projOperation.shapeSets.length - 1];

    // build out the shape
    switch (segment.type) {
      case SEGMENT_TYPE_CIRCLE:
        // circles create LightBurn ellipses (no vertex/primitive)
        generateEllipseShape(
          shape,
          operation,
          segment.start,
          segment.end,
          operation.powerScale
        );
        break;
      case SEGMENT_TYPE_PATH:
        generatePathShape(
          shape,
          operation,
          segment.start,
          segment.end,
          segment.closed,
          operation.powerScale
        );
        break;
    }
  }
}

/**
 * Generates a LightBurn Ellipse, from a full circle CAM operation
 *
 * Converts the CAM style path (start xy and center xy) into LightBurn style
 * ellipse of center xy and radius.
 *
 * @param shape Shape object to complete with the ellipse information
 * @param operation Path data for all shapes within this operation
 * @param segmentStart Index into operation to the circle that starts this position
 * @param segmentEnd Index into operation to the circle that defines the shape
 * @param powerScale Power scale to use for this shape
 */
function generateEllipseShape(
  shape,
  operation,
  segmentStart,
  segmentEnd,
  powerScale
) {
  // gather the positions being used for the circle
  const center = {
    x: operation.paths[segmentEnd].centerX,
    y: operation.paths[segmentEnd].centerY,
  };
  const start = {
    x: operation.paths[segmentEnd].x,
    y: operation.paths[segmentEnd].y,
  };

  // determine the radius of this circle
  const deltaX = start.x - center.x;
  const deltaY = start.y - center.y;
  const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  // add the shape
  shape.type = SHAPE_TYPE_ELLIPSE;
  shape.centerX = center.x;
  shape.centerY = center.y;
  shape.radius = radius;
  shape.powerScale = powerScale;
  shape.closed = true;

  // debug info
  writeComment(
    'generateEllipseShape: converting to circle on segments {segmentStart}-{segmentEnd}: [{startX}, {startY}] center [{centerX}, {centerY}] with radius {radius}',
    {
      startX: formatPosition.format(start.x),
      startY: formatPosition.format(start.y),
      centerX: formatPosition.format(shape.centerX),
      centerY: formatPosition.format(shape.centerY),
      radius: formatRadius.format(shape.radius),
      segmentStart: segmentStart,
      segmentEnd: segmentEnd,
    },
    COMMENT_INSANE
  );
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
  shape.closed = segmentClosed;

  // debug info
  writeComment(
    'generatePathShape: converting to paths on segments {segmentStart}-{segmentEnd}',
    {
      segmentStart: segmentStart,
      segmentEnd: segmentEnd,
    },
    COMMENT_INSANE
  );

  // define a variable to track the entry bezier control point into the next vector
  let c1 = undefined;

  // capture our starting position
  let position = {
    x: operation.paths[segmentStart].x,
    y: operation.paths[segmentStart].y,
  };

  // gather all points from the segment (from start to end) into vectors (the individual points) and primitives (the connection between vectors)
  // this is also where we do the conversion of circular paths into bezier curves for LightBurn
  let firstSegment = true;
  for (
    let segmentIndex = segmentStart + 1;
    segmentIndex <= segmentEnd;
    ++segmentIndex, firstSegment = false
  ) {
    const path = operation.paths[segmentIndex];

    switch (path.type) {
      case PATH_TYPE_MOVE:
        break;
      case PATH_TYPE_LINEAR:
        writeComment(
          'LINEAR Vector push: [{x}, {y}]',
          {
            x: formatPosition.format(position.x),
            y: formatPosition.format(position.y),
          },
          COMMENT_INSANE
        );
        shape.vectors.push({
          x: position.x,
          y: position.y,
          c1x: c1 ? c1.x : undefined, // there may be a bezier control point from the last curve that needs to be applied
          c1y: c1 ? c1.y : undefined,
        });

        // add a primitive connecting the vectors, except if we are on the first one (we don't have a line yet)
        if (!firstSegment) {
          writeComment(
            'LINEAR Primitive push: {start}-{end}',
            {
              start: formatPosition.format(shape.vectors.length - 2),
              end: formatPosition.format(shape.vectors.length - 1),
            },
            COMMENT_INSANE
          );
          shape.primitives.push({
            type: c1 ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
            start: shape.vectors.length - 2,
            end: shape.vectors.length - 1,
          });
        }
        // clear the bezier control point as we have now consumed it (if it was in use)
        c1 = undefined;

        break;
      case PATH_TYPE_SEMICIRCLE:
        writeComment(
          'Semicircle, start {clockwise} [{startX},{startY}], end [{x}, {y}], center [{centerX}, {centerY}]',
          {
            startX: formatPosition.format(position.x),
            startY: formatPosition.format(position.y),
            x: formatPosition.format(path.x),
            y: formatPosition.format(path.y),
            centerX: formatPosition.format(path.centerX),
            centerY: formatPosition.format(path.centerY),
            clockwise: path.clockwise ? 'CW' : 'CCW',
          },
          COMMENT_INSANE
        );
        // convert the path style curvature (start, end, centerpoint) into bezier vectors - which can result in more vectors to make the curve
        const curves = circularToBezier(
          { x: position.x, y: position.y },
          { x: path.x, y: path.y },
          { x: path.centerX, y: path.centerY },
          path.clockwise
        );

        // debug info
        writeComment(
          'generatePathShape: converting to bezier [{startX}, {startY}] to [{x}, {y}] center [{centerX}, {centerY}]',
          {
            startX: formatPosition.format(position.x),
            startY: formatPosition.format(position.y),
            x: formatPosition.format(path.x),
            y: formatPosition.format(path.y),
            centerX: formatPosition.format(path.centerX),
            centerY: formatPosition.format(path.centerY),
          },
          COMMENT_INSANE
        );

        // process all curves
        let curvePosition = { x: position.x, y: position.y };

        for (
          let curveIndex = 0;
          curveIndex < curves.length;
          ++curveIndex, firstSegment = false
        ) {
          // set up the control points for exiting this vector
          let c0 = { x: curves[curveIndex].x1, y: curves[curveIndex].y1 };

          // push this vector into the list
          writeComment(
            'CURVE Vector push: [{x}, {y}]',
            {
              x: formatPosition.format(curvePosition.x),
              y: formatPosition.format(curvePosition.y),
            },
            COMMENT_INSANE
          );
          shape.vectors.push({
            x: curvePosition.x,
            y: curvePosition.y,
            c0x: c0.x,
            c0y: c0.y,
            c1x: c1 ? c1.x : undefined, // include the entry control point if the prior vector had left it for us
            c1y: c1 ? c1.y : undefined,
          });

          // add a primitive to connect them, except if we are on the first one (we don't have a line yet)
          if (!firstSegment) {
            writeComment(
              'CURVE Primitive push: {start}-{end}',
              {
                start: formatPosition.format(shape.vectors.length - 2),
                end: formatPosition.format(shape.vectors.length - 1),
              },
              COMMENT_INSANE
            );
            shape.primitives.push({
              type: c1 ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
              start: shape.vectors.length - 2,
              end: shape.vectors.length - 1,
            });
          }

          // set up the control point for entering the next vector
          c1 = { x: curves[curveIndex].x2, y: curves[curveIndex].y2 };

          // update start position to reflect where this curve ended
          curvePosition = { x: curves[curveIndex].x, y: curves[curveIndex].y };
        }
        break;
    }

    // update our position
    position = { x: path.x, y: path.y };
  }
  // if this is a closed segment, add a primitive to connect the last to the first, and update
  // the starting vector to have the entry bezier control point if we have one.  If an open
  // segment, add the final vector and primitive to connect them.
  if (segmentClosed) {
    // closed - so connect primitive to start vector as our ending point
    writeComment(
      'CLOSE Primitive push: {start}-{end}',
      { start: formatPosition.format(shape.vectors.length - 1), end: 0 },
      COMMENT_INSANE
    );
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
      x: operation.paths[segmentEnd].x,
      y: operation.paths[segmentEnd].y,
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
  // determine distance of lines from center to start and end (resulting in center at 0,0)
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
  if (angleStartCenterEnd >= Math.PI) angleStartCenterEnd -= Math.PI * 2;
  if (angleStartCenterEnd < 0) angleStartCenterEnd += Math.PI * 2;

  // if our clockwise direction is the long way, set largeArcFlag so bezier generates the long way around
  // determine if we have a long or short CCW angle, and then adjust for the desired CW/CCW
  const ccwLargeArc = angleStartCenterEnd > Math.PI;
  const largeArcFlag = clockwise ? !ccwLargeArc : ccwLargeArc;

  writeComment(
    'circularToBezier: [{px}, {py}]-[{cx},{cy}], {largeArcFlag} arc',
    {
      px: formatPosition.format(startPoint.x),
      py: formatPosition.format(startPoint.y),
      cx: formatPosition.format(endPoint.x),
      cy: formatPosition.format(endPoint.y),
      rx: formatRadius.format(radius),
      ry: formatRadius.format(radius),
      xAxisRotation: 0,
      largeArcFlag: largeArcFlag ? 'LARGE' : 'SMALL',
      sweepFlag: !clockwise,
    },
    COMMENT_INSANE
  );

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
 * Gets a group object by name.  If the group does not already exist (in the `groups` array)
 * it is instantiated.  `defaults` is an object that defines the settings for the group should the
 * group not already exist.
 *
 * @param groupName Name of group to locate or instantiate (undefined if stand alone group)
 * @param defaults Object containing default values for the group if new one needs to be created.
 * @returns An individual group from the `groups` array (new or existing)
 */
function getGroupByName(groupName, defaults) {
  let group = undefined;

  if (groupName)
    for (let groupIndex = 0; groupIndex < groups.length; ++groupIndex) {
      if (
        groups[groupIndex].groupName &&
        groups[groupIndex].groupName.toLowerCase() == groupName.toLowerCase()
      ) {
        group = groups[groupIndex];
        break;
      }
    }
  if (!group) {
    writeComment(
      'getGroupByName: Create new group "{group}"',
      { group: groupName },
      COMMENT_DEBUG
    );
    groups.push(defaults);
    group = groups[groups.length - 1];
  } else
    writeComment(
      'getGroupByName: Join existing group "{group}"',
      { group: groupName },
      COMMENT_DEBUG
    );
  return group;
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
  for (
    let cutSettingsIndex = 0;
    cutSettingsIndex < project.cutSettings.length;
    ++cutSettingsIndex
  ) {
    const cutSetting = project.cutSettings[cutSettingsIndex];
    let matchFound = false;

    // look to see if we already have a matching cutsetting, based on the custom XML if provided,
    // otherwise the properties of the setting
    if (cutSettingSpecs.customCutSettingXML)
      // if custom cut is used, we expect a perfect string match.  This might someday be
      // improved with a deep object comparison (preceeded by filtering out unwanted fields)
      matchFound =
        cutSetting.customCutSettingXML == cutSettingSpecs.customCutSettingXML;
    else {
      // standard properties - see if we match
      matchFound =
        cutSetting.minPower == cutSettingSpecs.minPower &&
        cutSetting.maxPower == cutSettingSpecs.maxPower &&
        cutSetting.speed == cutSettingSpecs.speed &&
        cutSetting.layerMode == cutSettingSpecs.layerMode &&
        cutSetting.laserEnable == cutSettingSpecs.laserEnable &&
        cutSetting.powerScale == cutSettingSpecs.powerScale &&
        cutSetting.useAir == cutSettingSpecs.useAir &&
        cutSetting.zOffset == cutSettingSpecs.zOffset &&
        cutSetting.passes == cutSettingSpecs.passes &&
        cutSetting.zStep == cutSettingSpecs.zStep &&
        cutSetting.customCutSetting == undefined;
    }

    // do we have a match?
    if (matchFound) {
      // add this name to the list of operation names that this combined setting is being used for
      cutSetting.operationNames.push(cutSettingSpecs.name);

      // combine operation names for the layer name
      cutSetting.name = cutSetting.operationNames.join(', ');

      // move this layer to the end of the layer list, which helps to ensure the last cutting operation doesn't
      // end up happening too early, as often that operation makes the material less stable
      project.cutSettings.splice(cutSettingsIndex, 1);
      project.cutSettings.push(cutSetting);
      for (
        let newIndex = 0;
        newIndex < project.cutSettings.length;
        ++newIndex
      ) {
        project.cutSettings[newIndex].index = newIndex;
        project.cutSettings[newIndex].priority = newIndex;
      }

      // return the found setting
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
  currentGroup = getGroupByName(STOCK_GROUP_NAME, {
    groupName: STOCK_GROUP_NAME,
    operations: [],
  });

  // set up an operation to contain the stock outline
  const paths = [];
  currentGroup.operations.push({
    operationName: STOCK_GROUP_NAME,
    minPower: 100,
    maxPower: 100,
    speed: STOCK_FEED_RATE,
    zOffset: 0,
    passes: 1,
    zStep: 0,
    useAir: USE_AIR_OFF,
    laserEnable: LASER_ENABLE_OFF,
    layerMode: LAYER_MODE_LINE,
    powerScale: 100,
    powerSource: localize('stock dimensions'),
    customCutSettingXML: '',
    kerf: 0.1,
    paths: paths,
  });

  // add a path outlining the stock
  paths.push({
    type: PATH_TYPE_MOVE,
    x: stock.minX + workspaceOffsets.x,
    y: stock.minY + workspaceOffsets.y,
    feed: STOCK_FEED_RATE,
  });
  paths.push({
    type: PATH_TYPE_LINEAR,
    x: stock.maxX + workspaceOffsets.x,
    y: stock.minY + workspaceOffsets.y,
    feed: STOCK_FEED_RATE,
  });
  paths.push({
    type: PATH_TYPE_LINEAR,
    x: stock.maxX + workspaceOffsets.x,
    y: stock.maxY + workspaceOffsets.y,
    feed: STOCK_FEED_RATE,
  });
  paths.push({
    type: PATH_TYPE_LINEAR,
    x: stock.minX + workspaceOffsets.x,
    y: stock.maxY + workspaceOffsets.y,
    feed: STOCK_FEED_RATE,
  });
  paths.push({
    type: PATH_TYPE_LINEAR,
    x: stock.minX + workspaceOffsets.x,
    y: stock.minY + workspaceOffsets.y,
    feed: STOCK_FEED_RATE,
  });
}

/**
 * Compare two numbers to see if they are nearly equal, based on the accuracy defined by `accuracyInMM`
 *
 * @param a First numeric value to compare
 * @param b Second numeric value to compare
 * @returns `true` if they are the same, within the accuracy defined by the global constant `accuracyInMM`
 */
function closeEquals(a, b) {
  return Math.abs(a - b) <= accuracyInMM;
  // return Math.round(a / accuracyInMM) == Math.round(b / accuracyInMM);
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

  if (text == '\n' || text == '') writeCommentLine('');
  else {
    var commentPrefix = '';
    if (level == COMMENT_DEBUG) commentPrefix = '+ ';
    else if (level == COMMENT_INSANE) commentPrefix = '! ';
    writeCommentLine(commentPrefix + text);
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
