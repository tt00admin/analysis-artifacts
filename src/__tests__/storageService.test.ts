import { StorageService } from '../storage/storageService.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
  },
  window: {
    showWarningMessage: jest.fn()
  },
  ExtensionContext: jest.fn()
}));

jest.mock('fs/promises');

describe('StorageService', () => {
  let storageService: StorageService;
  const mockContext = {
    extensionPath: '/test/extension'
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    storageService = new StorageService(mockContext);
  });

  test('initialize should create directories and initial deck', async () => {
    (fs.access as jest.Mock).mockRejectedValueOnce(new Error('File not found'));
    (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
    (fs.rename as jest.Mock).mockResolvedValueOnce(undefined);

    await storageService.initialize();

    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.rename).toHaveBeenCalledTimes(1);
  });

  test('loadDeck should return deck with clips', async () => {
    const mockDeck = {
      version: '1.0.0',
      lastUpdated: Date.now(),
      clips: [],
      settings: { autoSave: true, maxClips: 100, imageQuality: 85 }
    };
    (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockDeck));

    const deck = await storageService.loadDeck();
    expect(deck.version).toBe('1.0.0');
    expect(deck.clips).toEqual([]);
  });

  test('saveDeck should write deck to file', async () => {
    const deck = {
      version: '1.0.0',
      lastUpdated: Date.now(),
      clips: [{ id: 'test' }] as any,
      settings: { autoSave: true, maxClips: 100, imageQuality: 85 }
    };
    (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
    (fs.rename as jest.Mock).mockResolvedValueOnce(undefined);

    await storageService.saveDeck(deck);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.rename).toHaveBeenCalledTimes(1);
  });

  test('loadDeck should recover corrupt JSON with initial deck', async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockResolvedValueOnce('{bad json');
    (fs.rename as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    const deck = await storageService.loadDeck();

    expect(deck.clips).toEqual([]);
    expect(fs.rename).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
  });
});
