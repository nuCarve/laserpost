/**************************************************************************************
 *
 * LaserPost module: updates.js
 *
 * Automatic update checking APIs
 *
 *************************************************************************************/

/**
 * Determines if an update to this post-processor is available, according to post properties
 * `machine0300AutomaticUpdate` (how often to check) and `machine0400UpdateAllowBeta`
 * (if beta releases are allowed).
 *
 * Displays a message if an update is available.
 *
 * @returns `true` if an update is available, `false` if no update or did not check
 */
function checkUpdateAvailability() {
  // check if we have updated since our last check
  if (activeState.installedSemver && activeState.installedSemver !== semVer) {
    delete activeState.updateSemver;
    delete activeState.updateURL;
    delete activeState.updateSummary;
    // clear epoch so we check again right away
    activeState.updateEpoch = undefined;
  }

  // determine parameters for doing update checking from the post properties
  const allowBeta = getProperty('machine0400UpdateAllowBeta', UPDATE_ALLOW_BETA_DEFAULT);
  let timeBetweenChecksMs = 0;
  switch (getProperty('machine0300AutomaticUpdate', UPDATE_FREQUENCY_DEFAULT)) {
    case UPDATE_FREQUENCY_NEVER:
      timeBetweenChecksMs = undefined;
      break;
    case UPDATE_FREQUENCY_ALWAYS:
      timeBetweenChecksMs = 0;
      break;
    case UPDATE_FREQUENCY_HOURLY:
      timeBetweenChecksMs = 60 * 60 * 1000;
      break;
    case UPDATE_FREQUENCY_DAILY:
      timeBetweenChecksMs = 24 * 60 * 60 * 1000;
      break;
    case UPDATE_FREQUENCY_WEEKLY:
      timeBetweenChecksMs = 7 * 24 * 60 * 60 * 1000;
      break;
    case UPDATE_FREQUENCY_MONTHLY:
      timeBetweenChecksMs = 30 * 7 * 24 * 60 * 60 * 1000;
      break;
  }

  // are we even allowed to check?
  if (timeBetweenChecksMs === undefined) return false;

  // determine if we should check the internet for updates
  let checkInternet = true;
  if (activeState.updateEpoch) {
    // is the next check not in the future (to fix for timebase changes) and not yet expired?
    if (
      activeState.updateEpoch < Date.now() &&
      Date.now() - activeState.updateEpoch < timeBetweenChecksMs
    )
      checkInternet = false;
  }

  // check the Internet for a version update if it's time
  if (checkInternet) {
    const version = getVersionFromWeb(!allowBeta);
    if (version) {
      // track this update check
      activeState.updateEpoch = Date.now();
      if (
        version &&
        version.compare &&
        version.compare.content &&
        version.compare.content === 'upgrade'
      ) {
        let homepage = version.homepage.content.replace(/\/$/, '');
        showWarning(
          localize(
            'LaserPost update "{version}" available:\n\n{summary}\n\nRelease notes and download: {url}'
          ),
          {
            version: version.semver.content,
            url: homepage,
            summary: version.notes.summary.content,
          }
        );

        // update the version in state so we can update notes to reflect updates available without
        // needing to go to the internet to figure it out
        activeState.installedSemver = semVer;
        activeState.updateSemver = version.semver.content;
        activeState.updateURL = homepage;
        activeState.updateSummary = version.notes.summary.content;
      } else {
        // we are up to date, so clear out any tracked available versions in state
        delete activeState.installedSemver;
        delete activeState.updateSemver;
        delete activeState.updateURL;
        delete activeState.updateSummary;
      }
    } else {
      // we failed to get version info, so reset the timer to try again soon
      // set the clock of last check back a full check cycle, except add some time so we don't check
      // every single post (see RETRY_VERSION_CHECK_ON_FAILURE_TIME_MS, which is typically one hour)
      activeState.updateEpoch =
        Date.now() -
        timeBetweenChecksMs +
        RETRY_VERSION_CHECK_ON_FAILURE_TIME_MS;
    }
  }

  // update notes (as important) if we have an update available
  if (activeState.updateSemver) {
    appendNote(
      localize(
        '*****\n' +
          '***** LaserPost update "{version}" available:\n' +
          '*****\n' +
          '***** {summary}\n' +
          '*****\n' +
          '***** Release notes and download: {url}\n' +
          '*****'
      ),
      {
        version: activeState.updateSemver,
        url: activeState.updateURL,
        summary: activeState.updateSummary,
      },
      true
    );
    return true;
  }

  // no updates available at this time
  return false;
}

/**
 * Gets the version object from the web (using the nuCarve.com web server `version-check` API)
 *
 * @param stableOnly `true` to get only stable releases, `false` to allow beta releases
 * @returns Version object if available, else undefined
 */
function getVersionFromWeb(stableOnly) {
  if (stableOnly === undefined) stableOnly = true;

  // make sure we are allowed to access the net
  ensureSecurityRights();

  // issue the API call
  const request = new XMLHttpRequest();
  try {
    request.open(
      'GET',
      'https://nucarve.com/version-check/laserpost?type=' +
        (stableOnly ? 'stable' : 'any') +
        '&version=' +
        semVer,
      false,
      '',
      ''
    );
    request.send(null);
  } catch (ex) {
    return undefined;
  }

  // make sure we got back an XML message
  if (request.response.substring(0, 5) != '<?xml') return undefined;

  // decode the XML
  const versionObject = parseXML(request.response);

  // make sure it's our version object and we didn't get an error
  if (!versionObject.version) return undefined;
  if (versionObject.version.error) return undefined;

  // return the verison object
  return versionObject.version;
}

/**
 * Determine if we have permission from Autodesk to run security level 0 calls.
 *
 * @returns `true` if we have level 0, `false` if we do not
 */
function haveSecurityRights() {
  // by using a try/catch block, the lack of security rights will be caught as an error rather
  // than being presented to the user as a prompt for permission.
  try {
    // this call requires rights or it will fail, but doesn't leave behind anything if it succeeeds
    FileSystem.getTemporaryFile('temp');
    return true;
  } catch (ex) {}
  return false;
}

/**
 * Ensures we have security rights to use level 0 calls.  If the current security context is insufficient,
 * this will inform the user what is happening and then trigger a secure call which will cause Autodesk
 * to prompt for permission.
 */
function ensureSecurityRights() {
  if (!haveSecurityRights()) {
    showWarning(
      localize(
        'LaserPost requires your permission to check for updates.\n\n' +
          'ALLOW: Select "Yes" on the following dialog (and optionally check the "Remember" box).\n\n' +
          'DECLINE: You must disable update checking.  Select "No" on the following dialog ' +
          'then change the "LaserPost: Automatic update" option on the post properties page to "Never".\n\n' +
          'Visit https://nucarve.com/laserpost-permissions for more information.'
      )
    );
    // use a benign security 0 call to trigger the clearance message
    FileSystem.getTemporaryFile('temp');
  }
}
