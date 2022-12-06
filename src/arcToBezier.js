/**************************************************************************************
 *
 * LaserPost module: arcToBezier.js
 *
 * Arc to Bezier library
 *
 *************************************************************************************/

/**************************************************************************************
 *
 * Arc to Bezier library.  See https://github.com/colinmeinke/svg-arc-to-cubic-bezier
 *
 * Modified to use the more restricted version of JavaScript used by the post processor engine.
 *
 * This section is using the following license:
 *
 * Internet Systems Consortium license
 * Copyright (c) 2017, Colin Meinke
 *
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted,
 * provided that the above copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
 * CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
 * NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Additionally, Colin Meinke derived this from https://github.com/fontello/svgpath with the following license:
 *
 * (The MIT License)
 *
 * Copyright (C) 2013-2015 by Vitaly Puzrin
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
 *************************************************************************************/

const TAU = Math.PI * 2;

function mapToEllipse({ x, y }, rx, ry, cosphi, sinphi, centerx, centery) {
  x *= rx;
  y *= ry;

  const xp = cosphi * x - sinphi * y;
  const yp = sinphi * x + cosphi * y;

  return {
    x: xp + centerx,
    y: yp + centery,
  };
}

function approxUnitArc(ang1, ang2) {
  // If 90 degree circular arc, use a constant
  // as derived from http://spencermortensen.com/articles/bezier-circle
  const a =
    ang2 === 1.5707963267948966
      ? 0.551915024494
      : ang2 === -1.5707963267948966
      ? -0.551915024494
      : (4 / 3) * Math.tan(ang2 / 4);

  const x1 = Math.cos(ang1);
  const y1 = Math.sin(ang1);
  const x2 = Math.cos(ang1 + ang2);
  const y2 = Math.sin(ang1 + ang2);

  return [
    {
      x: x1 - y1 * a,
      y: y1 + x1 * a,
    },
    {
      x: x2 + y2 * a,
      y: y2 - x2 * a,
    },
    {
      x: x2,
      y: y2,
    },
  ];
}

function vectorAngle(ux, uy, vx, vy) {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;

  let dot = ux * vx + uy * vy;

  if (dot > 1) {
    dot = 1;
  }

  if (dot < -1) {
    dot = -1;
  }

  return sign * Math.acos(dot);
}

function getArcCenter(
  px,
  py,
  cx,
  cy,
  rx,
  ry,
  largeArcFlag,
  sweepFlag,
  sinphi,
  cosphi,
  pxp,
  pyp
) {
  const rxsq = Math.pow(rx, 2);
  const rysq = Math.pow(ry, 2);
  const pxpsq = Math.pow(pxp, 2);
  const pypsq = Math.pow(pyp, 2);

  let radicant = rxsq * rysq - rxsq * pypsq - rysq * pxpsq;

  if (radicant < 0) {
    radicant = 0;
  }

  radicant /= rxsq * pypsq + rysq * pxpsq;
  radicant = Math.sqrt(radicant) * (largeArcFlag === sweepFlag ? -1 : 1);

  const centerxp = ((radicant * rx) / ry) * pyp;
  const centeryp = ((radicant * -ry) / rx) * pxp;

  const centerx = cosphi * centerxp - sinphi * centeryp + (px + cx) / 2;
  const centery = sinphi * centerxp + cosphi * centeryp + (py + cy) / 2;

  const vx1 = (pxp - centerxp) / rx;
  const vy1 = (pyp - centeryp) / ry;
  const vx2 = (-pxp - centerxp) / rx;
  const vy2 = (-pyp - centeryp) / ry;

  let ang1 = vectorAngle(1, 0, vx1, vy1);
  let ang2 = vectorAngle(vx1, vy1, vx2, vy2);

  if (sweepFlag == 0 && ang2 > 0) {
    ang2 -= TAU;
  }

  if (sweepFlag == 1 && ang2 < 0) {
    ang2 += TAU;
  }

  return [centerx, centery, ang1, ang2];
}

function arcToBezier({
  px,
  py,
  cx,
  cy,
  rx,
  ry,
  xAxisRotation,
  largeArcFlag,
  sweepFlag,
}) {
  if (xAxisRotation === undefined) xAxisRotation = 0;
  if (largeArcFlag === undefined) largeArcFlag = false;
  if (sweepFlag === undefined) sweepFlag = false;
  const curves = [];

  if (rx === 0 || ry === 0) {
    return [];
  }

  const sinphi = Math.sin((xAxisRotation * TAU) / 360);
  const cosphi = Math.cos((xAxisRotation * TAU) / 360);

  const pxp = (cosphi * (px - cx)) / 2 + (sinphi * (py - cy)) / 2;
  const pyp = (-sinphi * (px - cx)) / 2 + (cosphi * (py - cy)) / 2;

  if (pxp === 0 && pyp === 0) {
    return [];
  }

  rx = Math.abs(rx);
  ry = Math.abs(ry);

  const lambda =
    Math.pow(pxp, 2) / Math.pow(rx, 2) + Math.pow(pyp, 2) / Math.pow(ry, 2);

  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }

  let arcCenter = getArcCenter(
    px,
    py,
    cx,
    cy,
    rx,
    ry,
    largeArcFlag,
    sweepFlag,
    sinphi,
    cosphi,
    pxp,
    pyp
  );
  let centerx = arcCenter[0];
  let centery = arcCenter[1];
  let ang1 = arcCenter[2];
  let ang2 = arcCenter[3];

  // If 'ang2' == 90.0000000001, then `ratio` will evaluate to
  // 1.0000000001. This causes `segments` to be greater than one, which is an
  // unecessary split, and adds extra points to the bezier curve. To alleviate
  // this issue, we round to 1.0 when the ratio is close to 1.0.
  let ratio = Math.abs(ang2) / (TAU / 4);
  if (Math.abs(1.0 - ratio) < 0.0000001) {
    ratio = 1.0;
  }

  const segments = Math.max(Math.ceil(ratio), 1);

  ang2 /= segments;

  for (let i = 0; i < segments; i++) {
    curves.push(approxUnitArc(ang1, ang2));
    ang1 += ang2;
  }

  const result = [];
  for (let i = 0; i < curves.length; ++i) {
    let curve = curves[i];
    const xy1 = mapToEllipse(
      curve[0],
      rx,
      ry,
      cosphi,
      sinphi,
      centerx,
      centery
    );
    const xy2 = mapToEllipse(
      curve[1],
      rx,
      ry,
      cosphi,
      sinphi,
      centerx,
      centery
    );
    const xy = mapToEllipse(curve[2], rx, ry, cosphi, sinphi, centerx, centery);

    result.push({
      x1: xy1.x,
      y1: xy1.y,
      x2: xy2.x,
      y2: xy2.y,
      x: xy.x,
      y: xy.y,
    });
  }
  return result;
}
