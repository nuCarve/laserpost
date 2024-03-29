/**************************************************************************************
 *
 * LaserPost module: camConversion.js
 *
 * Group and Project services.  Handles the heavy lifting of converting CAM paths
 * to LaserPost objects (layers, vectors and primitives), including grouping and path closures.
 *
 *************************************************************************************/

/**
 * Converts the `groups` array into the `project` array, converting CAM style paths metrics into
 * CutSettings and Shapes objects.
 *
 * This must be called after all CAM operations are complete, and prior to accessing any information
 * in the `project` array.
 */
function groupsToProject() {
	// define a box that surrounds the part and stock 
	project.box = {
    minX:
      Math.min(getGlobalParameter('stock-lower-x'), hasParameter('part-lower-x') ? getParameter('part-lower-x') : 0),
    minY:
      Math.min(getGlobalParameter('stock-lower-y'), hasParameter('part-lower-y') ? getParameter('part-lower-y') : 0),
    maxX:
      Math.max(getGlobalParameter('stock-upper-x'), hasParameter('part-upper-x') ? getParameter('part-upper-x') : 0),
    maxY:
      Math.max(getGlobalParameter('stock-upper-y'), hasParameter('part-upper-y') ? getParameter('part-upper-y') : 0)
  };

	// default the translation to none
  project.translate = {
    x: false,
    y: false,
    reflect: false,
  };

	// let the writer modify these values as needed
  if (typeof onTranslateSetup == 'function') onTranslateSetup();

  // process all groups and build out the unique layers that are used
  createLayers();

  // construct all top-level layers
  createProjectLayers();

  // add operations to the top-level layer grouping
  populateProjectLayers();

  // add alignment mark(s)
  createAlignmentMark();

  // add filenames and paths for single or multi-file
  populateFilesAndPath();

  // transform the coordinate space
  translateCoordinateSpace();

  // dump the project to comments to assist with debugging problems
  dumpProject();
}

/**
 * Scan all groups and build out the list of unique layers in use, including setting the index for the
 * layer (cutSetting) on the operations in the project.
 */
function createLayers() {
  // loop through all groups
  for (let groupIndex = 0; groupIndex < groups.length; ++groupIndex) {
    const group = groups[groupIndex];
    // loop through all operations on this group
    for (
      let operationIndex = 0;
      operationIndex < group.operations.length;
      ++operationIndex
    ) {
      const groupOperation = group.operations[operationIndex];
      // if no points, skip this one
      if (groupOperation.paths.length == 0) continue;

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
        speed: feedrate / 60,
        layerMode: groupOperation.layerMode,
        laserEnable: groupOperation.laserEnable,
        powerSource: groupOperation.powerSource,
        useAir: groupOperation.useAir,
        zOffset: groupOperation.zOffset,
        passes: groupOperation.passes,
        zStep: groupOperation.zStep,
        kerf: groupOperation.kerf,
        // #if LBRN
        linkPath: groupOperation.linkPath,
        shuttleLaser1: groupOperation.shuttleLaser1,
        shuttleLaser2: groupOperation.shuttleLaser2,
        // #endif
        powerScale: groupOperation.powerScale,
        customCutSettingXML: groupOperation.customCutSettingXML,
        customCutSetting: groupOperation.customCutSetting,
      });

      // add the reference to this cutSetting layer to the operation
      groupOperation.cutSetting = cutSetting;
    }
  }

  // now go back and loop through everything again, this time adjusting
  // the index to cutSetting (as the layer order may have changed as
  // common layers were merged)
  for (let groupIndex = 0; groupIndex < groups.length; ++groupIndex) {
    const group2 = groups[groupIndex];
    // loop through all operations on this group
    for (
      let operationIndex = 0;
      operationIndex < group2.operations.length;
      ++operationIndex
    ) {
      const groupOperation2 = group2.operations[operationIndex];
      groupOperation2.index = groupOperation2.cutSetting.index;
    }
  }
}

/**
 * Creates the top-level project layers, which then will (eventually) contain all operation sets
 * either organized by layer (when grouping by layer), or lumped into a single layer (when not grouping by layer)
 */
function createProjectLayers() {
  // determine if we are grouping by layer or by operation
  const groupByLayer =
    getProperty('laserpost0100Organization', GROUPING_DEFAULT) ==
      ORGANIZATION_BY_LAYER ||
    getProperty('laserpost0100Organization', GROUPING_DEFAULT) ==
      ORGANIZATION_BY_LAYER_FILE;

  // build up the project layers
  project.layers = [];
  if (groupByLayer) {
    for (
      let layerIndex = 0;
      layerIndex < project.cutSettings.length;
      ++layerIndex
    ) {
      const cutSetting = project.cutSettings[layerIndex];

      project.layers.push({
        name: cutSetting.name,
        index: layerIndex,
        cutSettings: [],
        operationSets: [],
      });
    }
  } else
    project.layers.push({
      name: localize('All layers'),
      index: -1,
      cutSettings: [],
      operationSets: [],
    });
}

/**
 * Processes all groups and populates the layers with the operations and shapes for each layer (or if
 * layers are not being grouped, populates them all into the shared top-level layer)
 */
function populateProjectLayers() {
  // loop through all top-level layers
  for (let layerIndex = 0; layerIndex < project.layers.length; ++layerIndex) {
    const layer = project.layers[layerIndex];

    // loop through all groups
    for (let groupIndex = 0; groupIndex < groups.length; ++groupIndex) {
      let projOpSet = undefined;
      const group = groups[groupIndex];

      // loop through all operations on this group
      for (
        let operationIndex = 0;
        operationIndex < group.operations.length;
        ++operationIndex
      ) {
        const groupOperation = group.operations[operationIndex];

        // if no points, skip this one
        if (groupOperation.paths.length == 0) continue;

        // is this operation to be included in our layer?
        if (layer.index !== -1 && layer.index != groupOperation.index) continue;

        // set up our operation set if not already done for this group
        if (projOpSet === undefined) {
          // create a new operation set in the layer to collect all the operations together
          // that share the same group name
          layer.operationSets.push({
            groupName: group.groupName,
            operations: [],
          });
          projOpSet = layer.operationSets[layer.operationSets.length - 1];
        }

        // if a single layer per file, add our cut settings to this layer and remap all layer index
        // to use layer 0 (since there is only one layer per file)
        if (
          getProperty('laserpost0100Organization', GROUPING_DEFAULT) ==
          ORGANIZATION_BY_LAYER_FILE
        ) {
          const originalIndex = groupOperation.index;
          project.cutSettings[originalIndex].index = 0;
          groupOperation.index = 0;
          if (layer.cutSettings.length == 0)
            layer.cutSettings.push(project.cutSettings[originalIndex]);
        }
        // cut settings are shared by all layers when in the same file
        else layer.cutSettings = project.cutSettings;

        // set up a operation inside the layer (each operation is grouped to make managing them easier)
        const index = projOpSet.operations.push({
          shapeSets: [],
          operationName: groupOperation.operationName,
        });
        const projOperation = projOpSet.operations[index - 1];

        // convert the group (paths) into segments (groups of shapes)
        const segments = identifySegments(groupOperation);

        // build out shapes for each segments
        generateShapesFromSegments(
          groupOperation,
          segments,
          projOperation,
          layer.cutSettings
        );
      }
    }
  }
}

/**
 * Populates the filename and path properties of each layer, based on if grouping
 * is set to by layer or all are in one file.
 */
function populateFilesAndPath() {
  // determine if we are doing file redirection
  const redirect =
    getProperty('laserpost0100Organization', GROUPING_DEFAULT) ==
    ORGANIZATION_BY_LAYER_FILE;

  // process all layers
  for (let layerIndex = 0; layerIndex < project.layers.length; ++layerIndex) {
    const layer = project.layers[layerIndex];

    // set the filename for this layer
    if (layerIndex > 0 && redirect)
      // different file per layer
      layer.filename = programName + '-' + layerIndex + '.' + extension;
    // shared file across all layers (or first layer when separate files per layer)
    else layer.filename = programName + '.' + extension;

    // set the path based on the determined filename
    layer.path = FileSystem.getCombinedPath(
      FileSystem.getFolderPath(getOutputPath()),
      layer.filename
    );
  }
}

/**
 * Identifies from operation (paths) the groupings of segments (start/end/type) to define vector shapes
 *
 * Breaks apart individual paths into logical segments open paths (series of lines), closed paths (where start and end
 * point are the same), and circles (by definition, a closed path).
 *
 * Paths from CAM sometimes have segments as lead-ins (for example, a through cut adds a short cut to ensure a full cut
 * at the start / end of the geometry), and so to make sure we can close shapes whenever possible (when end point of a cut
 * matches the start point of the geometry), we search across all the paths in the operation, and break them
 * into unique path sets - where each set is a contiguous path from start to end and broken out into a separate set whenever
 * the geometry can be closed (to define a fillable shape).
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
      if (opSegmentStart < opSegmentIndex - 1) {
        const independentSegments = scanSegmentForClosure(
          opSegmentStart,
          opSegmentIndex - 1,
          operation
        );

        for (
          let indSegIndex = 0;
          indSegIndex < independentSegments.length;
          ++indSegIndex
        ) {
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

        debugLog(
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
  debugLog('identifySegments: Segmentation list:', {}, COMMENT_INSANE);
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
    debugLog(
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
          debugLog(
            'scanSegmentForClosure: Break off open segment (before closure): {start} to {end}',
            { start: startIndex, end: startScanIndex },
            COMMENT_INSANE
          );
        }

        // break off this closed segment
        result.push({ start: startScanIndex, end: endScanIndex, closed: true });
        debugLog(
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
          debugLog(
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
  debugLog(
    'scanSegmentForClosure: Fully open segment: {start} to {end}',
    { start: startIndex, end: endIndex },
    COMMENT_INSANE
  );
  return [{ start: startIndex, end: endIndex, closed: false }];
}

/**
 * Translates the coordinate space according to the project.mirror property.  See the `translate`
 * method for details on this property and how translations work.  This method walks all the
 * elements of the project to ensure all coordinates are translated.  Must be executed after all
 * segments have been generated (including alignment marks) to ensure all coordinates are correctly
 * translated.
 */
function translateCoordinateSpace() {
  // process all layers
  for (let layerIndex = 0; layerIndex < project.layers.length; ++layerIndex) {
    const layer = project.layers[layerIndex];

    // all operationSets within the layer
    for (
      let operationSetIndex = 0;
      operationSetIndex < layer.operationSets.length;
      ++operationSetIndex
    ) {
      const operationSet = layer.operationSets[operationSetIndex];

      // all operations within the operation set
      for (
        let operationIndex = 0;
        operationIndex < operationSet.operations.length;
        ++operationIndex
      ) {
        const operation = operationSet.operations[operationIndex];

        // all shapes within the operation
        for (
          let shapeSetIndex = 0;
          shapeSetIndex < operation.shapeSets.length;
          ++shapeSetIndex
        ) {
          const shape = operation.shapeSets[shapeSetIndex];

          // handle ellipse versus path
          if (shape.type == SHAPE_TYPE_ELLIPSE) {
            // ellipse
            const transformed = translate({
              x: shape.centerX,
              y: shape.centerY,
            });
            shape.centerX = transformed.x;
            shape.centerY = transformed.y;
          } else {
            // path - work through all vectors
            for (
              let vectorIndex = 0;
              vectorIndex < shape.vectors.length;
              ++vectorIndex
            ) {
              let vector = shape.vectors[vectorIndex];

              vector = translate(vector);
              const transformC0 = translate({ x: vector.c0x, y: vector.c0y });
              const transformC1 = translate({ x: vector.c1x, y: vector.c1y });
              vector.c0x = transformC0.x;
              vector.c0y = transformC0.y;
              vector.c1x = transformC1.x;
              vector.c1y = transformC1.y;
            }
          }
        }
      }
    }
  }
}

/**
 * Perform translation of coordinates to match the desired coordinate space.  Starts with
 * project.box that is a union of the stock and part space, and uses that to establish a 0,0
 * reference point.  If the coordinate space needs translation (flip X and/or Y) it uses
 * the project.box dimensions to perform the translation.  Then it applies any workspace
 * offsets the user may have requsted, and finally performs any needed reflection of the
 * coordinate space (flipping X and Y).
 *
 * project.translate properties:
 * - x: boolean; when true transforms X based on project.box
 * - y: boolean; when true transforms Y based on project.box
 * - reflect: boolean, flips X and Y coordinates
 *
 * project.box properties are a union of stock and part
 * - minX: minimum X coordinate 
 * - minY: minimum Y coordinate
 * - maxX: maximum X coordinate 
 * - maxY: maximum Y coordinate
 *
 * @param xy Object with `x` and `y` properties to translate.  Values `undefined` and returned likewise.
 * @returns Object with same properties, but translated according to project.box
 */
function translate(xy) {
	// translate into our box space to establish a 0,0 coordinate root, and then optionally
	// reverse the coordinate space
	if (xy.x !== undefined) {
		xy.x -= project.box.minX;
    if (project.translate.x)
			xy.x = project.box.maxX - project.box.minX - xy.x + project.box.minX;
	}
	if (xy.y !== undefined) {
		xy.y -= project.box.minY;
    if (project.translate.y)
			xy.y = project.box.maxY - project.box.minY - xy.y + project.box.minY;
	}

	// adjust for workspace offsets
	if (xy.x !== undefined) xy.x += getProperty('work0200OffsetX', OFFSET_X_AXIS_DEFAULT);
	if (xy.y !== undefined) xy.y += getProperty('work0300OffsetY', OFFSET_Y_AXIS_DEFAULT);

	// if we need to reflect the coordinate space, do so
  if (project.translate.reflect) {
    const originalX = xy.x;
    xy.x = xy.y;
    xy.y = originalX;
  }

  return xy;
}

/**
 * Constructs vector shapes from a series of segments.
 *
 * Walks all segments and builds shapes for each of them.  Handles the conversion of CAM style paths
 * to vector style shapes (including bezier and circle conversions).
 *
 * @param operation The CAM operation, where the path metrics can be found
 * @param segments The segmentation index of each shape (which references operation for the metrics)
 * @param projOperation The project operation object, where the resolved shapes are added for grouping
 * @param cutSettings Project layer specific cutSettings
 */
function generateShapesFromSegments(
  operation,
  segments,
  projOperation,
  cutSettings
) {
  // process all segments and convert them into shapes (vectors and primities), including conversion of
  // non-linear paths from circular (start/end/center points) to bezier (center point, with two control points)
  for (let segmentIndex = 0; segmentIndex < segments.length; ++segmentIndex) {
    const segment = segments[segmentIndex];

    // create a new shape in our shape set for this operation (to organize the shapes together by operation)
    projOperation.shapeSets.push({
      cutSetting: cutSettings[operation.index],
    });
    const shape = projOperation.shapeSets[projOperation.shapeSets.length - 1];

    // build out the shape
    switch (segment.type) {
      case SEGMENT_TYPE_CIRCLE:
        // circles create ellipses (no vertex/primitive)
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
 * Generates an Ellipse, from a full circle CAM operation
 *
 * Converts the CAM style path (start xy and center xy) into LaserPost style
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
  debugLog(
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
 * Generates a LaserPost Path, from CAM operations
 *
 * Handles the creation of a LaserPost Path shape, including the conversion of CAM style paths (center, start and
 * end points) into LaserPost style paths (cubic bezier vectors and primitives that connect them).
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
  debugLog(
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
  // this is also where we do the conversion of circular paths into bezier curves
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
        debugLog(
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
          c0x: undefined,
          c0y: undefined,
          c1x: c1 !== undefined ? c1.x : undefined, // there may be a bezier control point from the last curve that needs to be applied
          c1y: c1 !== undefined ? c1.y : undefined,
        });

        // add a primitive connecting the vectors, except if we are on the first one (we don't have a line yet)
        if (!firstSegment) {
          debugLog(
            'LINEAR Primitive push: {start}-{end}',
            {
              start: formatPosition.format(shape.vectors.length - 2),
              end: formatPosition.format(shape.vectors.length - 1),
            },
            COMMENT_INSANE
          );
          shape.primitives.push({
            type:
              c1 !== undefined ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
            start: shape.vectors.length - 2,
            end: shape.vectors.length - 1,
          });
        }
        // clear the bezier control point as we have now consumed it (if it was in use)
        c1 = undefined;

        break;
      case PATH_TYPE_SEMICIRCLE:
        debugLog(
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
        debugLog(
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
          debugLog(
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
            c1x: c1 !== undefined ? c1.x : undefined, // include the entry control point if the prior vector had left it for us
            c1y: c1 !== undefined ? c1.y : undefined,
          });

          // add a primitive to connect them, except if we are on the first one (we don't have a line yet)
          if (!firstSegment) {
            debugLog(
              'CURVE Primitive push: {start}-{end}',
              {
                start: formatPosition.format(shape.vectors.length - 2),
                end: formatPosition.format(shape.vectors.length - 1),
              },
              COMMENT_INSANE
            );
            shape.primitives.push({
              type:
                c1 !== undefined ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
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
    // closed - connect primitive to start vector as our ending point (if we have points)
	// also check if we have vectors - we always should, but if not we crash
	if (shape.vectors.length > 0) {
		debugLog(
		'CLOSE Primitive push: {start}-{end}',
		{ start: formatPosition.format(shape.vectors.length - 1), end: 0 },
		COMMENT_INSANE
		);
		shape.primitives.push({
		type: c1 ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
		start: shape.vectors.length - 1,
		end: 0,
		});
		shape.vectors[0].c1x = c1 !== undefined ? c1.x : undefined;
		shape.vectors[0].c1y = c1 !== undefined ? c1.y : undefined;
	} else
		debugLog('WARNING: Found shape with no vectors - shapes may be missing in output', {}, COMMENT_NORMAL);
  } else {
    // open - so add the final vector and connect them
    shape.vectors.push({
      x: operation.paths[segmentEnd].x,
      y: operation.paths[segmentEnd].y,
      c0x: undefined,
      c0y: undefined,
      c1x: c1 !== undefined ? c1.x : undefined, // include the entry control point if the prior vector had left it for us
      c1y: c1 !== undefined ? c1.y : undefined,
    });
    shape.primitives.push({
      type: c1 !== undefined ? PRIMITIVE_TYPE_BEZIER : PRIMITIVE_TYPE_LINE,
      start: shape.vectors.length - 2,
      end: shape.vectors.length - 1,
    });
  }
}

/**
 * Converts a circular coordinate system (such as used CAM onCircular, and gcode G2/G3) into a
 * bezier curve.  Accepts a start point, end point, center point of the circle, and a flag
 * indicating if we are moving clockwise or counterclockwise.  Returns an array of curves,
 * containing {x, y, x1, y1, x2, y2} where x/y is the end point of the curve, x1/y1 are the starting
 * control points for the bezier, and x2/y2 are the ending control points for the bezier.
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

  debugLog(
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
    debugLog(
      'getGroupByName: Create new group "{group}"',
      { group: groupName },
      COMMENT_INSANE
    );
    groups.push(defaults);
    group = groups[groups.length - 1];
  } else
    debugLog(
      'getGroupByName: Join existing group "{group}"',
      { group: groupName },
      COMMENT_INSANE
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
    if (
      cutSettingSpecs.customCutSettingXML &&
      cutSettingSpecs.laserEnable !== LASER_ENABLE_OFF
    )
      // if custom cut is used, we expect a perfect string match.  This might someday be
      // improved with a deep object comparison (preceeded by filtering out unwanted fields)
      matchFound =
        cutSetting.customCutSettingXML == cutSettingSpecs.customCutSettingXML;
    else if (
      cutSettingSpecs.laserEnable == LASER_ENABLE_OFF &&
      cutSetting.laserEnable == LASER_ENABLE_OFF
    )
      // disabled lasers always match
      matchFound = true;
    else {
      // standard properties - see if we match
      matchFound =
        // #if LBRN
        cutSetting.linkPath == cutSettingSpecs.linkPath &&
        // #endif
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
  // is stock outline requested?
  if (getProperty('work0100TraceStock', TRACE_STOCK_DEFAULT)) {
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
      speed: NO_OUTPUT_FEED_RATE,
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

    // update the box size to support the alignment mark

    // add a path outlining the stock
    paths.push({
      type: PATH_TYPE_MOVE,
      x: stock.minX,
      y: stock.minY,
      feed: NO_OUTPUT_FEED_RATE,
    });
    paths.push({
      type: PATH_TYPE_LINEAR,
      x: stock.maxX,
      y: stock.minY,
      feed: NO_OUTPUT_FEED_RATE,
    });
    paths.push({
      type: PATH_TYPE_LINEAR,
      x: stock.maxX,
      y: stock.maxY,
      feed: NO_OUTPUT_FEED_RATE,
    });
    paths.push({
      type: PATH_TYPE_LINEAR,
      x: stock.minX,
      y: stock.maxY,
      feed: NO_OUTPUT_FEED_RATE,
    });
    paths.push({
      type: PATH_TYPE_LINEAR,
      x: stock.minX,
      y: stock.minY,
      feed: NO_OUTPUT_FEED_RATE,
    });
  }
}

/**
 * Create alignment marks (circle with vertical and horz lines) according to the post-property
 * options.  These are added per-layer, and therefore are done after conversion from segments to
 * shapes (which is different than traceStockOutline, that operates in advance of conversion to
 * shapes).
 */
function createAlignmentMark() {
  // set up the alignment mark if requested
  const alignmentMark = getProperty(
    'laserpost0300AlignmentMarks',
    ALIGNMENT_MARK_DEFAULT
  );
  if (alignmentMark !== ALIGNMENT_MARK_NONE) {
    // get the stock dimensions
    const stock = {
      minX: getGlobalParameter('stock-lower-x'),
      minY: getGlobalParameter('stock-lower-y'),
      maxX: getGlobalParameter('stock-upper-x'),
      maxY: getGlobalParameter('stock-upper-y'),
    };

    // set up alignment mark position and size
    const markRadius = 5;
    const markGap = 0;
    const markCenterX = stock.maxX + markGap + markRadius;
    let markCenterY;
    switch (alignmentMark) {
      case ALIGNMENT_MARK_UPPER_RIGHT:
        markCenterY = stock.maxY - markRadius;
        break;
      case ALIGNMENT_MARK_CENTER_RIGHT:
        markCenterY = (stock.maxY - stock.minY) / 2 + stock.minY;
        break;
      case ALIGNMENT_MARK_LOWER_RIGHT:
        markCenterY = markRadius;
        break;
    }

    // increase the width of our working box
    project.box.maxX += markGap + markRadius * 2;

    // set up our layer to hold the alignment marks
    const cutSetting = getCutSetting({
      name: ALIGNMENT_MARK_GROUP_NAME,
      minPower: 100,
      maxPower: 100,
      speed: NO_OUTPUT_FEED_RATE,
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
    });

    // loop for all layers
    for (
      let projLayerIndex = 0;
      projLayerIndex < project.layers.length;
      ++projLayerIndex
    ) {
      const projLayer = project.layers[projLayerIndex];

      // create a new operation set, operation, and empty shapeSets array that will hold our
      // alignment mark
      const operationSetIndex = projLayer.operationSets.push({
        operations: [
          { operationName: ALIGNMENT_MARK_GROUP_NAME, shapeSets: [] },
        ],
      });
      const shapeSets =
        projLayer.operationSets[operationSetIndex - 1].operations[0].shapeSets;

      // add our cut setting to the layer if not already there
      let foundCutSetting = false;
      for (let i = 0; i < projLayer.cutSettings.length; ++i)
        if (projLayer.cutSettings[i].index == cutSetting.index) {
          foundCutSetting = true;
          break;
        }
      if (!foundCutSetting) projLayer.cutSettings.push(cutSetting);

      // create the circle of the alignment mark
      shapeSets.push({
        type: SHAPE_TYPE_ELLIPSE,
        cutSetting: cutSetting,
        powerScale: 100,
        centerX: markCenterX,
        centerY: markCenterY,
        radius: markRadius,
      });

      // create the cross hatch with two lines
      shapeSets.push({
        type: SHAPE_TYPE_PATH,
        cutSetting: cutSetting,
        powerScale: 100,
        vectors: [
          {
            x: markCenterX,
            y: markCenterY - markRadius,
          },
          {
            x: markCenterX,
            y: markCenterY + markRadius,
          },
          {
            x: markCenterX - markRadius,
            y: markCenterY,
          },
          {
            x: markCenterX + markRadius,
            y: markCenterY,
          },
        ],
        primitives: [
          {
            type: PRIMITIVE_TYPE_LINE,
            start: 0,
            end: 1,
          },
          {
            type: PRIMITIVE_TYPE_LINE,
            start: 2,
            end: 3,
          },
        ],
      });
    }
  }
}
