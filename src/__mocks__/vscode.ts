export const workspace = {
  workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
  openNotebookDocument: jest.fn().mockResolvedValue({
    getCells: jest.fn().mockReturnValue([]),
    cellAt: jest.fn()
  })
};

export const window = {
  activeNotebookEditor: undefined,
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showNotebookDocument: jest.fn().mockResolvedValue({
    revealRange: jest.fn()
  })
};

export const Uri = {
  parse: jest.fn().mockReturnValue({ toString: () => 'test-uri' })
};

export const NotebookRange = jest.fn();
export const NotebookEditorRevealType = {
  InCenter: 2
};

export const ExtensionContext = jest.fn();

export default {
  workspace,
  window,
  Uri,
  NotebookRange,
  NotebookEditorRevealType,
  ExtensionContext
};
