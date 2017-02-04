import { cssSelect, domSerializer, DomUtils, ElementType } from './vendor'
import forEach from '../util/forEach'
import isString from '../util/isString'
import isNil from '../util/isNil'
import isNumber from '../util/isNumber'
import last from '../util/last'
import parseMarkup from './parseMarkup'
import DOMEventListener from './DOMEventListener'
import DOMElement from './DOMElement'
import DelegatedEvent from './DelegatedEvent'

class XNode extends DOMElement {

  constructor(type, args = {}) {
    super()

    this.type = type
    if (!type) throw new Error("'type' is mandatory")

    this.ownerDocument = args.ownerDocument
    if (type !== 'document' && !this.ownerDocument) {
      throw new Error("'ownerDocument' is mandatory")
    }

    // NOTE: there are some properties which are named so that this
    // can be used together with htmlparser2 and css-select
    // but which could have a better naming, e.g., name -> tagName

    switch(type) {
      case ElementType.Tag: {
        this.name = args.name
        if (!this.name) throw new Error("'name' is mandatory.")
        this.properties = new Map()
        this.attributes = new Map()
        this.classes = new Set()
        this.styles = new Map()
        this.eventListeners = []
        this.children = args.children || []
        this._assign(args)
        break
      }
      case ElementType.Text:
      case ElementType.Comment: {
        this.data = args.data || ''
        break
      }
      case ElementType.CDATA: {
        this.data = args.data || ''
        break
      }
      case ElementType.Directive: {
        this.name = args.name
        this.data = args.data
        break
      }
      case 'document': {
        let format = args.format
        this.format = format
        if (!format) throw new Error("'format' is mandatory.")
        this.children = args.children || []
        switch(format) {
          case 'xml':
            this.contentType = 'application/xml'
            break
          case 'html':
            this.contentType = 'text/html'
            break
          default:
            throw new Error('Unsupported format ' + format)
        }
        break
      }
      default:
        this.name = null
        this.properties = new Map()
        this.attributes = new Map()
        this.classes = new Set()
        this.styles = new Map()
        this.eventListeners = []
        this.children = args.children || []
    }
  }

  getNativeElement() {
    return this
  }

  clone(deep) {
    let clone = new XNode(this.type, this)
    if (deep && this.children) {
      this.children.forEach((child) => {
        clone.appendChild(child.clone(deep))
      })
    }
    return clone
  }

  get tagName() {
    return this.getTagName()
  }

  set tagName(tagName) {
    this.setTagName(tagName)
  }

  getTagName() {
    if (this.name) {
      return this.name.toLowerCase()
    }
  }

  setTagName(tagName) {
    this.name = String(tagName).toLowerCase()
    return this
  }

  hasAttribute(name) {
    switch(name) {
      case 'class':
        return Boolean(this.classes)
      case 'style':
        return Boolean(this.styles)
      default:
        return this.attributes.has(name)
    }
  }

  getAttribute(name) {
    switch(name) {
      case 'class':
        return stringifyClasses(this.classes)
      case 'style':
        return stringifyStyles(this.styles)
      default:
        return this.attributes.get(name)
    }
  }

  setAttribute(name, value) {
    switch(name) {
      case 'class':
        parseClasses(this.classes, value)
        break
      case 'style':
        parseStyles(this.styles, value)
        break
      default:
        this.attributes.set(name, value)
    }
    return this
  }

  removeAttribute(name) {
    switch(name) {
      case 'class':
        this.classes = new Set()
        break
      case 'style':
        this.styles = new Map()
        break
      default:
        this.attributes.delete(name)
    }
    return this
  }

  // ATTENTION: this comes without 'class' and 'style'
  getAttributes() {
    return this.attributes
  }

  getProperties() {
    if (this.properties) {
      return this.properties
    }
  }

  getProperty(name) {
    if (this.properties) {
      return this.properties.get(name)
    }
  }

  setProperty(name, value) {
    if (this.properties) {
      this.properties.set(name, value)
    }
    return this
  }

  removeProperty(name) {
    if (this.properties && this.properties.hasOwnProperty(name)) {
      delete this.properties[name]
    }
    return this
  }

  hasClass(name) {
    if (this.classes) {
      return this.classes.has(name)
    }
    return this
  }

  addClass(name) {
    if (this.classes) {
      this.classes.add(name)
    }
    return this
  }

  removeClass(name) {
    if (this.classes) {
      this.classes.delete(name)
    }
    return this
  }

  getInnerHTML() {
    return DomUtils.getInnerHTML(this)
  }

  // TODO: parse html using settings from el,
  // clear old children and append new children
  setInnerHTML(html) {
    if (this.children) {
      let _doc = parseMarkup(html, {
        ownerDocument: this.getOwnerDocument()
      })
      this.empty()
      // ATTENTION: important to copy the children array first
      // as appendChild removes from parent
      _doc.children.slice(0).forEach((child) => {
        this.appendChild(child)
      })
    }
    return this
  }

  getOuterHTML() {
    return domSerializer(this, { xmlMode: this.ownerDocument.format === 'xml' })
  }

  getTextContent() {
    return DomUtils.getText(this)
  }

  setTextContent(text) {
    if (this.type === 'text') {
      this.data = text
    } else if (this.children) {
      let child = this.createTextNode(text)
      this.empty()
      this.appendChild(child)
    }
    return this
  }

  getStyle(name) {
    if (this.styles) {
      return this.styles.get(name)
    }
  }

  setStyle(name, value) {
    if (this.styles) {
      if (DOMElement.pxStyles[name] && isNumber(value)) value = value + "px"
      this.styles.set(name, value)
    }
    return this
  }

  is(cssSelector) {
    return cssSelect.is(this, cssSelector)
  }

  find(cssSelector) {
    return cssSelect.selectOne(cssSelector, this)
  }

  findAll(cssSelector) {
    return cssSelect.selectAll(cssSelector, this)
  }

  getChildCount() {
    if (this.children) {
      return this.children.length
    } else {
      return 0
    }
  }

  getChildNodes() {
    return this.children.slice(0)
  }

  getChildren() {
    let children = this.children
    children = children.filter(function(node) {
      return node.type === "tag"
    })
    return children
  }

  getChildAt(pos) {
    if (this.children) {
      return this.children[pos]
    }
  }

  getChildIndex(child) {
    if (this.children) {
      return this.children.indexOf(child)
    }
  }

  getLastChild() {
    if (this.children) {
      return last(this.children)
    }
  }

  getFirstChild() {
    if (this.children) {
      return this.children[0]
    }
  }

  getNextSibling() {
    return this.next
  }

  getPreviousSibling() {
    return this.prev
  }

  getParent() {
    return this.parent
  }

  getRoot() {
    let el = this
    while (el.parent) el = el.parent
    return el
  }

  getOwnerDocument() {
    return (this.type === 'document') ? this : this.ownerDocument
  }

  isTextNode() {
    return this.type === "text"
  }

  isElementNode() {
    return this.type === "tag" || this.type === "script"
  }

  isCommentNode() {
    return this.type === "comment"
  }

  isDocumentNode() {
    return this.type === "document"
  }

  isComponentNode() {
    return this.type === "component"
  }

  createDocument(format) {
    return XNode.createDocument(format)
  }

  createElement(tagName) {
    return new XNode(ElementType.Tag, { name: tagName, ownerDocument: this.getOwnerDocument() })
  }

  createTextNode(text) {
    return new XNode(ElementType.Text, { data: text, ownerDocument: this.getOwnerDocument() })
  }

  createComment(data) {
    return new XNode(ElementType.Comment, { data: data, ownerDocument: this.getOwnerDocument() })
  }

  createProcessingInstruction(name, data) {
    return new XNode(ElementType.Directive, { name: name, data: data, ownerDocument: this.getOwnerDocument() })
  }

  createCDATASection(data) {
    return new XNode(ElementType.CDATA, { data: data, ownerDocument: this.getOwnerDocument() })
  }

  appendChild(child) {
    if (this.children && !isNil(child)) {
      child = this._normalizeChild(child)
      if (!child) return this
      DomUtils.appendChild(this, child)
      child.ownerDocument = this.getOwnerDocument()
      this._onAttach(child)
    }
    return this
  }

  removeChild(child) {
    if (child.parentNode === this) {
      child.remove()
    }
  }

  insertAt(pos, child) {
    child = this._normalizeChild(child)
    if (!child) return this
    let children = this.children
    if (children) {
      // NOTE: manipulating htmlparser's internal children array
      if (pos >= children.length) {
        DomUtils.appendChild(this, child)
      } else {
        DomUtils.prepend(children[pos], child)
      }
      child.ownerDocument = this.getOwnerDocument()
      this._onAttach(child)
    }
    return this
  }

  insertBefore(newChild, before) {
    if (this.children) {
      var pos = this.children.indexOf(before)
      if (pos > -1) {
        DomUtils.prepend(before, newChild)
        newChild.ownerDocument = this.getOwnerDocument()
      } else {
        throw new Error('insertBefore(): reference node is not a child of this element.')
      }
      this._onAttach(newChild)
    }
    return this
  }

  removeAt(pos) {
    let children = this.children
    if (children) {
      let child = children[pos]
      child.remove()
      this._onDetach(child)
    }
    return this
  }

  empty() {
    let children = this.children
    if (children) {
      children.forEach((child) => {
        child.next = child.prev = child.parent = null
        this._onDetach(child)
      })
      children.length = 0
    }
    return this
  }

  remove() {
    let parent = this.parent
    DomUtils.removeElement(this)
    if (parent) {
      parent._onDetach(this)
    }
    return this
  }

  replaceChild(oldChild, newChild) {
    if (oldChild.parent === this) {
      oldChild.replaceWith(newChild)
    }
    return this
  }

  replaceWith(newEl) {
    let parent = this.parent
    newEl = this._normalizeChild(newEl)
    DomUtils.replaceElement(this, newEl)
    newEl.ownerDocument = this.getOwnerDocument()
    if (parent) {
      parent._onDetach(this)
      parent._onAttach(newEl)
    }
    return this
  }

  getEventListeners() {
    return this.eventListeners
  }

  addEventListener(eventName, handler, options) {
    let listener
    if (arguments.length === 1 && arguments[0]) {
      listener = arguments[0]
    } else {
      listener = new DOMEventListener(eventName, handler, options)
    }
    if (listener.options.selector && !listener.__hasEventDelegation__) {
      listener.handler = DelegatedEvent.delegatedHandler(listener, this)
      listener.__hasEventDelegation__ = true
    }
    if (!this.eventListeners) {
      this.eventListeners = []
    }
    listener._el = this
    this.eventListeners.push(listener)
    return this
  }

  removeEventListener(eventName, handler) {
    // console.log('removing event listener', eventName, handler);
    let listener = null, idx = -1
    idx = DOMEventListener.findIndex(this.eventListeners, eventName, handler)
    listener = this.eventListeners[idx]
    if (idx > -1) {
      this.eventListeners.splice(idx, 1)
      listener._el = null
    }
    return this
  }

  click() {
    this._emitEvent('click', { target: this })
    return this
  }

  // TODO: flesh this out
  _emitEvent(eventName, data) {
    this._propagateEvent(new XNodeEvent(eventName, data))
  }

  _propagateEvent(event) {
    let listeners = this.eventListeners
    if (listeners) {
      let listener = listeners.find((l) => {
        return l.eventName === event._name
      })
      if (listener) listener.handler(event)
      if (event.stopped) return
      let p = this.parentNode
      if (p) p._propagateEvent(event)
    }
  }

  removeAllEventListeners() {
    this.eventListeners = []
    return this
  }

  get attribs() {
    return this.attributes
  }

  _assign(other) {
    if (other.name) this.name = other.name
    if (this.classes && other.classes) {
      other.classes.forEach((val) => {
        this.classes.add(val)
      })
    }
    if (this.styles && other.styles) {
      forEach(other.styles, (val, name) => {
        this.styles.set(name, val)
      })
    }
    // TODO: while it is 'smart' to deal with 'style' and 'class'
    // implicitly, it introduces some confusion here
    let otherAttributes = other.attributes || other.attribs
    if (this.attributes && otherAttributes) {
      forEach(other.attributes, (val, name) => {
        switch (name) {
          case 'class': {
            parseClasses(this.classes, val)
            break
          }
          case 'style': {
            parseStyles(this.styles, val)
            break
          }
          default:
            this.attributes.set(name, val)
        }
      })
    }
    if (this.properties && other.properties) {
      forEach(other.properties, (val, name) => {
        this.properties.set(name, val)
      })
    }
    if (this.eventListeners && other.eventListeners) {
      this.eventListeners = this.eventListeners.concat(other.eventListeners)
    }
  }

  _onAttach(child) {} // eslint-disable-line no-unused-vars

  _onDetach(child) {} // eslint-disable-line no-unused-vars

  _normalizeChild(child) {
    if (isString(child)) {
      child = this.createTextNode(child)
    }
    if (!child || !child._isXNode) {
      throw new Error('Illegal argument: only String and XNode instances are valid.')
    }
    return child
  }

  _attach(child) {
    child.parent = this
  }

  _detach(child) {
    child.parent = null
  }

}

XNode.prototype._isXNode = true

XNode.createDocument = function(format) {
  if (format === 'xml') {
    return new XNode('document', { format: format })
  } else {
    return XNode.parseMarkup(DOMElement.EMPTY_HTML, 'html')
  }
}

XNode.createElement = function(tagName, ownerDocument) {
  return new XNode(ElementType.Tag, {
    name: tagName,
    ownerDocument: ownerDocument
  })
}

XNode.createTextNode = function(text, ownerDocument) {
  return new XNode(ElementType.Text, {
    data: text,
    ownerDocument: ownerDocument
  })
}

XNode.parseMarkup = function(str, format, isFullDoc) {
  if (!str) {
    return XNode.createDocument(format)
  }
  let doc
  if (format === 'html') {
    isFullDoc = (str.search(/<\s*html/i)>=0)
    doc = parseMarkup(str, { format: format })
  } else if (format === 'xml') {
    doc = parseMarkup(str, { format: format })
  }
  if (doc) {
    if (format === 'html') {
      if (isFullDoc) {
        return doc.find('html')
      } else {
        // NOTE: for partials we create a consistent HTML structure and
        // append the parsed elements to body
        // TODO: this is maybe not 100% correct for all inputs (e.g. '<head></head>')
        let childNodes = doc.childNodes.slice(0)
        doc.empty()
        doc.appendChild(doc.createElement('head'))
        doc.appendChild(doc.createElement('body').append(childNodes))
        return _manyOrOne(childNodes)
      }
    } else if (format === 'xml') {
      if (isFullDoc) {
        return doc
      } else {
        return _manyOrOne(doc.childNodes)
      }
    }
  } else {
    throw new Error('Could not parse DOM string.')
  }

  function _manyOrOne(elements) {
    if (elements.length === 1) {
      return elements[0]
    } else {
      return elements
    }
  }
}

XNode.parseHTML = function(html, isFullDoc) {
  return XNode.parseMarkup(html, 'html', isFullDoc)
}

XNode.parseXML = function(html, isFullDoc) {
  return XNode.parseMarkup(html, 'xml', isFullDoc)
}

XNode.wrapNativeElement = function(el) {
  if (!el._isXNode) throw new Error('Illegal argument: expected XNode instance')
  return el
}

function parseClasses(classes, classStr) {
  classStr.split(/\s+/).forEach((name) => {
    classes.add(name)
  })
}

function stringifyClasses(classes) {
  return Array.from(classes).join(' ')
}

function parseStyles(styles, styleStr) {
  styleStr = (styleStr || '').trim()
  if (!styleStr) return
  styleStr.split(';').forEach((style) => {
    let n = style.indexOf(':')
    // skip if there is no :, or if it is the first/last character
    if (n < 1 || n === style.length-1) return
    let name = style.slice(0,n).trim()
    let val = style.slice(n+1).trim()
    styles.set(name, val)
  })
}

function stringifyStyles(styles) {
  if (!styles) return ''
  let str = Object.keys(styles).map((name) => {
    return name + ':' + styles[name]
  }).join(';')
  if (str.length > 0) str += ';'
  return str
}

// TODO: could be a bit closer to the real DOM impl
class XNodeEvent {

  constructor(name, data) {
    this._name = name

    Object.assign(this, data)
  }

  stopPropagation() {
    this.stopped = true
  }

  // just a stub
  preventDefault() {}
}

export default XNode