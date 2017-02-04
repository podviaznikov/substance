import { module } from 'substance-test'
import setupContainerEditor from './fixture/setupContainerEditor'
import nestedContainers from './fixture/nestedContainers'

const test = module('IsolatedNode')

test("IsolatedNodes should be 'not-selected' when selection is null", function(t) {
  let { editorSession, app } = setupContainerEditor(nestedContainers)
  let isolatedNodes = app.findAll('.sc-isolated-node')
  editorSession.setSelection(null)
  isolatedNodes.forEach(function(isolated){
    t.ok(isolated.isNotSelected(), "isolated node '"+isolated.getId()+"' should not be selected.")
  })
  t.end()
})

test("IsolatedNodes should be 'not-selected' when selection is somewhere else", function(t) {
  let { editorSession, app } = setupContainerEditor(nestedContainers)
  let isolatedNodes = app.findAll('.sc-isolated-node')
  editorSession.setSelection({
    type: 'property',
    path: ['p1', 'content'],
    startOffset: 0,
    surfaceId: 'body'
  })
  isolatedNodes.forEach(function(isolated){
    t.ok(isolated.isNotSelected(), "isolated node '"+isolated.getId()+"' should not be selected.")
  })
  t.end()
})

test("IsolatedNode should be 'selected' with node selection", function(t) {
  let { editorSession, app } = setupContainerEditor(nestedContainers)
  let isolatedNodes = app.findAll('.sc-isolated-node')
  editorSession.setSelection({
    type: 'node',
    nodeId: 'c1',
    mode: 'full',
    containerId: 'body',
    surfaceId: 'body'
  })
  let expected = {
    'body/c1': 'selected',
    'body/c1/c1/c2': undefined,
  }
  isolatedNodes.forEach(function(isolated){
    let id = isolated.getId()
    t.equal(isolated.getMode(), expected[id], "mode of isolated node '" + id + "' should be correct")
  })
  t.end()
})

test("IsolatedNode should be 'co-selected' with spanning container selection", function(t) {
  let { editorSession, app } = setupContainerEditor(nestedContainers)
  let isolatedNodes = app.findAll('.sc-isolated-node')
  editorSession.setSelection({
    type: 'container',
    containerId: 'body',
    startPath: ['p1', 'content'],
    startOffset: 1,
    endPath: ['p2', 'content'],
    endOffset: 2,
    surfaceId: 'body'
  })
  let expected = {
    'body/c1': 'co-selected',
    // Note: 'co-selection' does not propagate down
    // it is a state related to the parent container
    'body/c1/c1/c2/c2': undefined,
  }
  isolatedNodes.forEach(function(isolated){
    let id = isolated.getId()
    t.equal(isolated.getMode(), expected[id], "mode of isolated node '" + id + "' should be correct")
  })
  t.end()
})

test("IsolatedNode should be 'focused' when having the selection", function(t) {
  let { editorSession, app } = setupContainerEditor(nestedContainers)
  let isolatedNodes = app.findAll('.sc-isolated-node')
  editorSession.setSelection({
    type: 'property',
    path: ['c1_p1', 'content'],
    startOffset: 0,
    surfaceId: 'body/c1/c1'
  })
  let expected = {
    'body/c1': 'focused',
    'body/c1/c1/c2': undefined,
  }
  isolatedNodes.forEach(function(isolated){
    let id = isolated.getId()
    t.equal(isolated.getMode(), expected[id], "mode of isolated node '" + id + "' should be correct")
  })
  t.end()
})

test("IsolatedNode should be 'co-focused' when child is having the selection", function(t) {
  let { editorSession, app } = setupContainerEditor(nestedContainers)
  let isolatedNodes = app.findAll('.sc-isolated-node')
  editorSession.setSelection({
    type: 'property',
    path: ['c2_p1', 'content'],
    startOffset: 0,
    surfaceId: 'body/c1/c1/c2/c2'
  })
  let expected = {
    'body/c1': 'co-focused',
    'body/c1/c1/c2': 'focused',
  }
  isolatedNodes.forEach(function(isolated){
    let id = isolated.getId()
    t.equal(isolated.getMode(), expected[id], "mode of isolated node '" + id + "' should be correct")
  })
  t.end()
})

// revealed issue #696
test("IsolatedNode should detect 'co-focused' robustly in presence of surface ids with same prefix", function(t) {
  // as experienced in #696 it happened that co-focused state was infered just
  // by using startsWith on the surface path. This was leading to wrong
  // co-focused states when e.g. two isolated nodes `body/entity` and `body/entity-1`
  // exist. I.e. one surfaceId was a prefix of another one.
  let { editorSession, app } = setupContainerEditor(_twoStructuredNodes)
  let isolatedNodes = app.findAll('.sc-isolated-node')
  editorSession.setSelection({
    type: 'property',
    path: ['sn2', 'title'],
    startOffset: 0,
    surfaceId: 'body/sn2/sn2.title'
  })
  let expected = {
    'body/sn': undefined,
    'body/sn2': 'focused',
  }
  isolatedNodes.forEach(function(isolated){
    let id = isolated.getId()
    t.equal(isolated.getMode(), expected[id], "mode of isolated node '" + id + "' should be correct")
  })
  t.end()
})


function _twoStructuredNodes(doc) {
  let body = doc.get('body')
  body.show(doc.create({
    type: 'structured-node',
    id: 'sn',
    title: 'Foo'
  }))
  body.show(doc.create({
    type: 'structured-node',
    id: 'sn2',
    title: 'Bar'
  }))
}
