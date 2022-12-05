/**************************************************************************************
 *
 * LaserPost module: camHandlers.js
 * 
 * Methods for handling the CAM events
 *
 *************************************************************************************/

/**
 * onOpen is called by CAM at the start of the processing, before the first section.
 */
 function onOpen() {
    // load our state from the persistent state file
    stateLoad();
  
    // check if an update is available
    checkUpdateAvailability();
  
    // capture and save the preferences that affect file generation
    includeComments = getProperty('lightburn0200IncludeComments');
    includeNotes = getProperty('machine0200IncludeNotes');
    workspaceOffsets = {
      x: getProperty('work0200OffsetX'),
      y: getProperty('work0300OffsetX'),
    };
  
    // emit the the required XML header
    writeXMLHeader();
  
    // if we have a program name/comment, add it to the file as comments and in notes
    if (programName || programComment) {
      writeCommentAndNote(localize('Program'));
      if (programName)
        writeCommentAndNote('  ' + localize('Name') + ': ' + programName);
      if (programComment)
        writeCommentAndNote('  ' + localize('Comment') + ': ' + programComment);
    }
  
    // dump machine configuration
    var vendor = machineConfiguration.getVendor();
    var model = machineConfiguration.getModel();
    var description = machineConfiguration.getDescription();
  
    writeCommentAndNote(localize('Machine'));
    if (vendor) {
      writeCommentAndNote('  ' + localize('Vendor') + ': ' + vendor);
    }
    if (model) {
      writeCommentAndNote('  ' + localize('Model') + ': ' + model);
    }
    if (description) {
      writeCommentAndNote('  ' + localize('Description') + ': ' + description);
    }
  
    // if the user did any laser overrides, include those in the comments
    let laserPowerEtchMin = getProperty('laserPower0100EtchMin');
    let laserPowerEtchMax = getProperty('laserPower0200EtchMax');
    let laserPowerVaporizeMin = getProperty('laserPower0300VaporizeMin');
    let laserPowerVaporizeMax = getProperty('laserPower0400VaporizeMax');
    let laserPowerThroughMin = getProperty('laserPower0500ThroughMin');
    let laserPowerThroughMax = getProperty('laserPower0600ThroughMax');
  
    if (
      laserPowerEtchMax != 0 ||
      laserPowerThroughMax != 0 ||
      laserPowerVaporizeMax != 0
    ) {
      writeCommentAndNote(localize('Laser power overrides'));
      if (laserPowerEtchMax != 0)
        writeCommentAndNote(
          '  ' +
            localize('Etch power') +
            ': ' +
            laserPowerEtchMin +
            '% ' +
            localize('(min)') +
            ' - ' +
            laserPowerEtchMax +
            '% ' +
            localize('(max)')
        );
      if (laserPowerVaporizeMax != 0)
        writeCommentAndNote(
          '  ' +
            localize('Vaporize power') +
            ': ' +
            laserPowerVaporizeMin +
            '% ' +
            localize('(min)') +
            ' - ' +
            laserPowerVaporizeMax +
            '% ' +
            localize('(max)')
        );
      if (laserPowerThroughMax != 0)
        writeCommentAndNote(
          '  ' +
            localize('Through power') +
            ': ' +
            laserPowerThroughMin +
            '% ' +
            localize('(min)') +
            ' - ' +
            laserPowerThroughMax +
            '% ' +
            localize('(max)')
        );
    }
  
    // add comments for tool information
    var tools = getToolTable();
    if (tools.getNumberOfTools() > 0) {
      writeComment(localize('Tools'));
      for (var i = 0; i < tools.getNumberOfTools(); ++i) {
        var tool = tools.getTool(i);
        writeComment(
          '  ' +
            localize(
              'Tool #{num}: {desc} [{type}], min power (pierce)={pierce}%, max power (cut)={cut}%, kerf width={kerf}mm'
            ),
          {
            num: tool.number,
            desc: tool.getDescription(),
            type: getToolTypeName(tool.type),
            pierce: tool.piercePower,
            cut: tool.cutPower,
            kerf: tool.getKerfWidth(),
          }
        );
      }
    }
  }
  
  /**
   * onComment is called by CAM when a comment should be emitted.
   *
   * @param message Comment to add to the file.
   */
  function onComment(message) {
    writeComment(message);
  }
  
  /**
   * onSection is called by CAM on the start of each operation.
   */
  function onSection() {
    // add a comment that contains the operation name
    var operationName = getParameter('operation-comment');
    if (!operationName)
      // it appears this can never happen, but it is a safety valve just in case...
      operationName = 'unknown';
  
    // make sure this is a tool type for laser cutting
    if (tool.type !== TOOL_LASER_CUTTER) {
      error(
        localize('Operation is not for laser cutting') +
          (operationName ? ': ' + operationName : '')
      );
      return;
    }
  
    // laser power is defined on the tool (cut power is max power, pierce power is min power), but
    // can also be overridden in post properties.  Determine the min/max power and the source of
    // that power selection (for logging purposes).
    var minPower = 0;
    var maxPower = 0;
    let powerSource;
    switch (currentSection.jetMode) {
      case JET_MODE_ETCHING:
        minPower = getProperty('laserPower0100EtchMin');
        maxPower = getProperty('laserPower0200EtchMax');
        powerSource = localize('post-processor etch power properties');
        break;
      case JET_MODE_VAPORIZE:
        minPower = getProperty('laserPower0300VaporizeMin');
        maxPower = getProperty('laserPower0400VaporizeMax');
        powerSource = localize('post-processor vaporize power properties"');
        break;
      case JET_MODE_THROUGH:
        minPower = getProperty('laserPower0500ThroughMin');
        maxPower = getProperty('laserPower0600ThroughMax');
        powerSource = localize('post-processor through power properties');
        break;
      default:
        error(
          localize('Unsupported cutting mode') +
            ' (' +
            currentSection.jetMode +
            ')'
        );
        return;
    }
  
    // if the user did not specify an override on max power, use the tools cut (max) and/or pierce (min) power
    if (maxPower == 0) {
      minPower = tool.piercePower;
      maxPower = tool.cutPower;
      powerSource = localize('tool power properties');
    }
  
    // determine the air setting.
    let useAir = true;
    switch (getProperty('op0100UseAir')) {
      case USE_AIR_OFF:
        useAir = false;
        break;
      case USE_AIR_ON:
        useAir = true;
        break;
      case USE_AIR_ASSIST_GAS:
        useAir = tool.assistGas.toLowerCase() != 'none' && tool.assistGas != '';
        break;
    }
  
    // set up the group - using the shared group name if specified, else a new empty group
    const groupName = currentSection.getProperty('op0800GroupName');
    if (groupName == '') groupName = undefined;
  
    currentGroup = getGroup(groupName, {
      groupName: groupName,
      operations: [],
    });
  
    // collect settings from the user via operation properties
    const powerScale = currentSection.getProperty('op0200PowerScale');
    const opLayerMode = currentSection.getProperty('op0600LayerMode');
    const customCutSettingXML = currentSection.getProperty(
      'op0900CustomCutSettingXML'
    );
    const laserEnable = currentSection.getProperty('op0700LaserEnable');
    const zOffset = currentSection.getProperty('op0300ZOffset');
    const passes = currentSection.getProperty('op0400Passes');
    const zStep = currentSection.getProperty('op0500ZStep');
  
    // if custom XML is used, decode it
    let parsedXML = undefined;
    if (customCutSettingXML) {
      parsedXML = parseXML(customCutSettingXML);
      if (parsedXML === undefined) {
        error(
          localize('Unable to parse Custom CutSetting XML on operation') +
            ': ' +
            operationName
        );
        return;
      }
      // make sure we have <CutSetting> as our starting tag
      if (!parsedXML.CutSetting) {
        error(
          localize(
            'Invalid Custom CutSetting (must be "<CutSetting>...</CutSetting>") on operation'
          ) +
            ': ' +
            operationName
        );
        return;
      }
      // remove properties disallowed on custom
      delete parsedXML.index;
      delete parsedXML.priority;
      delete parsedXML.name;
  
      // update power source (used for comments below) to indicate it was custom
      powerSource = localize('post-processor through custom CutSeting XML');
    }
  
    // add the operation to this group
    if (parsedXML) {
      currentGroup.operations.push({
        operationName: operationName,
        powerScale: powerScale,
        powerSource: powerSource,
        customCutSettingXML: customCutSettingXML,
        customCutSetting: parsedXML,
        paths: [],
      });
    } else {
      currentGroup.operations.push({
        operationName: operationName,
        minPower: minPower,
        maxPower: maxPower,
        laserEnable: laserEnable,
        layerMode: opLayerMode,
        powerScale: powerScale,
        powerSource: powerSource,
        useAir: useAir,
        zOffset: zOffset,
        passes: passes,
        zStep: zStep,
        customCutSettingXML: '',
        paths: [],
      });
    }
  
    // include comments about the group and power being used
    writeComment(
      'Operation: "{name}" using group "{group}"',
      {
        name: operationName,
        group: groupName ? groupName : 'n/a',
      },
      COMMENT_DEBUG
    );
  
    if (customCutSettingXML)
      writeComment(
        'Settings: Custom CutSetting XML:\n${xml}',
        { xml: customCutSettingXML },
        COMMENT_DEBUG
      );
    else
      writeComment(
        'Settings: {min}-{max}% ({source}), layer mode: {mode}, laser enable: {enable}, power scale: {scale}, air: {air}, z-offset: {zOffset}, passes: {passes}, z-step: {zStep}',
        {
          min: minPower,
          max: maxPower,
          source: powerSource,
          mode: opLayerMode,
          enable: laserEnable,
          scale: powerScale,
          air: useAir ? localize('on') : localize('off'),
          zOffset: zOffset,
          passes: passes,
          zStep: zStep,
        },
        COMMENT_DEBUG
      );
  }
  
  /**
   * onLinear is called by CAM when the laser should move at another location, with or without power.
   *
   * @param x X position to move to.
   * @param y Y positoin to move to.
   * @param z Z position to move to.
   * @param feed Feedrate to use.
   */
  function onLinear(x, y, z, feed) {
    var start = getCurrentPosition();
  
    // adjust offsets
    x += workspaceOffsets.x;
    y += workspaceOffsets.y;
    start.x += workspaceOffsets.x;
    start.y += workspaceOffsets.y;
  
    // is laser currently on?  If not, we ignore this request (other than debugging logic)
    if (currentPower) {
      writeComment(
        'onLinear LASER: [{startX}, {startY}] to [{endX}, {endY}] at {feed} mm/min',
        {
          startX: formatPosition.format(start.x),
          startY: formatPosition.format(start.y),
          endX: formatPosition.format(x),
          endY: formatPosition.format(y),
          feed: formatSpeed.format(feed),
        },
        COMMENT_DEBUG
      );
  
      // add this path segment
      currentGroup.operations[currentGroup.operations.length - 1].paths.push({
        type: PATH_TYPE_LINEAR,
        startX: start.x,
        startY: start.y,
        endX: x,
        endY: y,
        feed: feed,
      });
    } else {
      writeComment(
        'onLinear MOVE: [{startX}, {startY}] to [{endX}, {endY}]',
        {
          startX: formatPosition.format(start.x),
          startY: formatPosition.format(start.y),
          endX: formatPosition.format(x),
          endY: formatPosition.format(y),
        },
        COMMENT_INSANE
      );
    }
  }
  
  /**
   * onCircular is called by CAM when a curve needs to be lasered.  Curve starts
   * from the current position of the laser.
   *
   * @param clockwise Direction to move, `true` is clockwise
   * @param cx Center position X of the curve
   * @param cy Center position Y of the curve
   * @param cz Center position Z of the curve
   * @param x Ending X position of the curve
   * @param y Ending Y position of the curve
   * @param z Ending Z position of the curve
   * @param feed Feedrate to move at
   */
  function onCircular(clockwise, cx, cy, cz, x, y, z, feed) {
    if (!currentPower) {
      error(
        localize(
          'Invalid CAM request: onCircular called with laser not powered on'
        )
      );
      return;
    }
  
    // adjust offsets
    cx += workspaceOffsets.x;
    cy += workspaceOffsets.y;
    x += workspaceOffsets.x;
    y += workspaceOffsets.y;
  
    var start = getCurrentPosition();
    start.x += workspaceOffsets.x;
    start.y += workspaceOffsets.y;
  
    writeComment(
      'onCircular: {clockwise} {fullSemi}, [{sx}, {sy}] to [{ex}, {ey}] center [{cx}, {cy}], feed={feed} mm/min',
      {
        clockwise: clockwise ? 'CW' : 'CCW',
        fullSemi: isFullCircle() ? 'circle' : 'semicircle',
        sy: formatPosition.format(start.x),
        sx: formatPosition.format(start.y),
        cx: formatPosition.format(cx),
        cy: formatPosition.format(cy),
        ex: formatPosition.format(x),
        ey: formatPosition.format(y),
        feed: formatSpeed.format(feed),
      },
      COMMENT_DEBUG
    );
  
    // add this path segment
    currentGroup.operations[currentGroup.operations.length - 1].paths.push({
      type: isFullCircle() ? PATH_TYPE_CIRCLE : PATH_TYPE_SEMICIRCLE,
      startX: start.x,
      startY: start.y,
      centerX: cx,
      centerY: cy,
      endX: x,
      endY: y,
      clockwise: clockwise,
      feed: feed,
    });
  }
  
  /**
   * onCommand is called by command to issue a variety of commands to the post-processor.
   *
   * @param command Command to process, such as COMMAND_STOP
   */
  function onCommand(command) {
    writeComment(
      'onCommand: {id} ({command})',
      {
        command: command,
        id: getCommandStringId(command),
      },
      COMMENT_DEBUG
    );
  
    switch (command) {
      case COMMAND_POWER_ON:
        currentPower = true;
        return;
      case COMMAND_POWER_OFF:
        currentPower = false;
        return;
    }
  
    onUnsupportedCommand(command);
  }
  
  /**
   * onSectionEnd is called by CAM when the current operation is done.
   */
  function onSectionEnd() {
    writeComment('onSectionEnd', {}, COMMENT_DEBUG);
  }
  
  /**
   * onClose is called by CAM when the last section has been completed.  Triggers the
   * processing of all entries in the `groups` array and generates the LightBurn file.
   */
  function onClose() {
    // include some debugging information
    writeComment('onClose', {}, COMMENT_DEBUG);
  
    // trace the stock outline
    if (getProperty('work0100TraceStock')) traceStockOutline();
  
    dumpGroups();
  
    // process all groups, converting from CAM coordinates to LightBurn
    groupsToProject();
  
    // render the file
    writeHeader();
    writeCutSettings();
    writeShapes();
    writeTrailer();
  
    // save our state to the persistent state file (if changed)
    stateSave();
  }
  
  /**
   * onClose is called by CAM when the last section has been completed.
   */
  function onTerminate() {}
  
  