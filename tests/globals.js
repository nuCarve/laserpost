/**
 * Copyright (C) 2024 nuCarve
 * All rights reserved.
 *
 * Automated test manager for LaserPost
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
 */

// define enum constants for cmdOptions.snapshotMode
export const SNAPSHOT_MODE_NEVER = 'never';
export const SNAPSHOT_MODE_CREATE = 'create';
export const SNAPSHOT_MODE_DIFF = 'diff';
export const SNAPSHOT_MODE_RESET = 'reset';

// define enum constants for the match option in tests.json
export const MATCH_REQUIRED = 'required';
export const MATCH_FORBIDDEN = 'forbidden';
export const MATCH_OPTIONAL = 'optional';

// Snapshot file comment line header
export const SNAPSHOT_COMMENT_LINE_HEADER = '***** ';
