/**
 * Copyright (C) 2022 nuCarve
 * All rights reserved.
 *
 * A CAM post processor for emitting a LightBurn LBRN file for laser (jet) operations.
 *
 * This software is licensed under the MIT License:
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 *
 * Additional license and attribution requrements are included in subsections below.
 */

/**************************************************************************************
 *
 * Post-processor global kernel settings
 *
 *************************************************************************************/

description = localize('LaserPost');
vendor = 'nuCarve';
vendorUrl = 'https://nucarve.com/laserpost';
let semVer = '0.0.0-version';

let codeDescription = localize(
  'This post creates the toolpath as a LightBurn (LBRN) project.'
);
let codeMoreInformation = localize(
  'Visit https://nucarve.com/laserpost for software, instructions and instructional videos.'
);
let codeLongVersion = localize('Version') + ': ' + semVer;

longDescription =
  codeDescription + '  ' + codeMoreInformation + ' ' + codeLongVersion;
legal = 'Copyright (C) 2022 by nuCarve';
certificationLevel = 2;
minimumRevision = 45845;

extension = 'lbrn';
setCodePage('ascii');

capabilities = CAPABILITY_JET;
tolerance = spatial(0.0001, MM);
minimumChordLength = spatial(0.01, MM);
minimumCircularRadius = spatial(0.01, MM);
maximumCircularRadius = spatial(99999, MM);
minimumCircularSweep = toRad(0.01);
maximumCircularSweep = Math.PI * 2;
allowHelicalMoves = false;
allowedCircularPlanes = 1 << PLANE_XY;
