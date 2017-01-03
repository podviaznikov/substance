import { cloneDeep, last } from 'lodash-es'
import forEach from '../util/forEach'
import Document from './Document'
import annotationHelpers from './annotationHelpers'

/**
  Creates a new document instance containing only the selected content

  @param {Object} args object with `selection`
  @return {Object} with a `doc` property that has a fresh doc with the copied content
*/

function copySelection(doc, selection) {
  if (!selection) throw new Error("'selection' is mandatory.")
  let copy = null
  if (!selection.isNull() && !selection.isCollapsed()) {
    // return a simplified version if only a piece of text is selected
    if (selection.isPropertySelection()) {
      copy = _copyPropertySelection(doc, selection)
    }
    else if (selection.isContainerSelection()) {
      copy = _copyContainerSelection(doc, selection)
    }
    else if (selection.isNodeSelection()) {
      copy = _copyNodeSelection(doc, selection)
    }
    else {
      console.error('Copy is not yet supported for selection type.')
    }
  }
  return copy
}

function _copyPropertySelection(doc, selection) {
  let path = selection.start.path
  let offset = selection.start.offset
  let endOffset = selection.end.offset
  let text = doc.get(path)
  let snippet = doc.createSnippet()
  let containerNode = snippet.getContainer()
  snippet.create({
    type: doc.schema.getDefaultTextType(),
    id: Document.TEXT_SNIPPET_ID,
    content: text.substring(offset, endOffset)
  })
  containerNode.show(Document.TEXT_SNIPPET_ID)
  let annotations = doc.getIndex('annotations').get(path, offset, endOffset)
  forEach(annotations, function(anno) {
    let data = cloneDeep(anno.toJSON())
    let path = [Document.TEXT_SNIPPET_ID, 'content']
    data.start = {
      path: path,
      offset: Math.max(offset, anno.start.offset)-offset
    }
    data.end = {
      path: path,
      offset: Math.min(endOffset, anno.end.offset)-offset
    }
    snippet.create(data)
  })
  return snippet
}

// TODO: copying nested nodes is not straight-forward,
// as it is not clear if the node is valid to be created just partially
// Basically this needs to be implemented for each nested node.
// The default implementation ignores partially selected nested nodes.
function _copyContainerSelection(doc, selection) {
  let snippet = doc.createSnippet()
  let container = snippet.getContainer()

  let fragments = selection.getFragments()
  if (fragments.length === 0) return snippet
  let created = {}
  // copy nodes and annotations.
  for (let i = 0; i < fragments.length; i++) {
    let fragment = fragments[i]
    let nodeId = fragment.path[0]
    let node = doc.get(nodeId)
    // skip created nodes
    if (!created[nodeId]) {
      _copyNode(node).forEach((nodeData) => {
        let copy = snippet.create(nodeData)
        created[copy.id] = true
      })
      container.show(nodeId)
    }
  }

  let firstFragment = fragments[0]
  let lastFragment = last(fragments)
  let path, offset, text

  // if first is a text node, remove part before the selection
  if (firstFragment.type === 'selection-fragment') {
    path = firstFragment.path
    offset = firstFragment.startOffset
    text = doc.get(path)
    snippet.update(path, { type: 'delete', start: 0, end: offset })
    annotationHelpers.deletedText(snippet, path, 0, offset)
  }

  // if last is a is a text node, remove part before the selection
  if (lastFragment.type === 'selection-fragment') {
    path = lastFragment.path
    offset = lastFragment.endOffset
    text = doc.get(path)
    snippet.update(path, { type: 'delete', start: offset, end: text.length })
    annotationHelpers.deletedText(snippet, path, offset, text.length)
  }

  return snippet
}

function _copyNodeSelection(doc, selection) {
  let snippet = doc.createSnippet()
  let containerNode = snippet.getContainer()
  let nodeId = selection.getNodeId()
  let node = doc.get(nodeId)
  _copyNode(node).forEach((nodeData) => {
    snippet.create(nodeData)
  })
  containerNode.show(node.id)
  return snippet
}

/*
  Creates a 'deep' JSON copy of a node returning an array of JSON objects
  that can be used to create the object tree owned by the given root node.

  @param {DocumentNode} node
*/
function _copyNode(node) {
  let nodes = []
  // EXPERIMENTAL: using schema reflection to determine whether to do a 'deep' copy or just shallow
  let nodeSchema = node.getSchema()
  let doc = node.getDocument()
  forEach(nodeSchema, (prop) => {
    // ATM we do a cascaded copy if the property has type 'id', ['array', 'id'], or 'file'
    if ((prop.isReference() && prop.owner) || (prop.type === 'file')) {
      let val = node[prop.name]
      if (prop.isArray()) {
        val.forEach((id) => {
          nodes = nodes.concat(_copyNode(doc.get(id)))
        })
      } else {
        nodes = nodes.concat(_copyNode(doc.get(val)))
      }
    }
  })
  nodes.push(node.toJSON())
  let annotationIndex = node.getDocument().getIndex('annotations')
  let annotations = annotationIndex.get([node.id])
  forEach(annotations, function(anno) {
    nodes.push(anno.toJSON())
  })
  return nodes
}

export default copySelection
