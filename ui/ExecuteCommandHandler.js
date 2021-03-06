class ExecuteCommandHandler {
  constructor(editorSession, commandName) {
    this.editorSession = editorSession
    this.commandName = commandName
  }
  execute(params) {
    this.editorSession.executeCommand(this.commandName, params)
  }
}
export default ExecuteCommandHandler