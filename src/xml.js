/**************************************************************************************
 *
 * LaserPost module: xml.js
 * 
 * XML parsing and writing services
 *
 *************************************************************************************/

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
  
  