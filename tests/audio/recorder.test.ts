import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';

const mocks = vi.hoisted(() => {
  const { EventEmitter } = require("node:events");
  const mockStream = new EventEmitter();
  const mockStop = vi.fn();
  const mockRecord = vi.fn(() => ({
    stream: () => mockStream,
    stop: mockStop,
  }));

  return {
    mockStream,
    mockStop,
    mockRecord
  };
});

vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}));

vi.mock('../../src/config/loader', () => ({
  loadConfig: () => ({
    behavior: {
      audioDevice: 'default',
      clipboard: {
        minDuration: 0.6,
        maxDuration: 300
      }
    }
  })
}));

vi.mock('node-record-lpcm16', () => ({
  record: mocks.mockRecord
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { AudioRecorder } from '../../src/audio/recorder';
import { record } from 'node-record-lpcm16';
import { execSync } from 'node:child_process';

describe('AudioRecorder', () => {
  let recorder: AudioRecorder;

  beforeEach(() => {
    vi.clearAllMocks();
    (execSync as any).mockReturnValue(Buffer.from('arecord version 1.2.4'));
    recorder = new AudioRecorder();
    mocks.mockStream.removeAllListeners();
  });

  it('should start recording successfully', async () => {
    const startPromise = recorder.start();
    mocks.mockStream.emit('data', Buffer.from('data'));
    await startPromise;
    expect(record).toHaveBeenCalled();
    expect(recorder.isRecording()).toBe(true);
  });

  it('should throw error if already recording', async () => {
    const startPromise = recorder.start();
    mocks.mockStream.emit('data', Buffer.from('data'));
    await startPromise;
    let error: Error | undefined;
    try {
        await recorder.start();
    } catch (e) {
        error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error?.message).toBe('Already recording');
  });

  it('should stop recording and return audio buffer', async () => {
    const startPromise = recorder.start();
    mocks.mockStream.emit('data', Buffer.from('data'));
    await startPromise;
    
    mocks.mockStream.emit('data', Buffer.from('chunk1'));
    mocks.mockStream.emit('data', Buffer.from('chunk2'));

    const realDateNow = Date.now;
    const startTime = realDateNow();
    Date.now = () => startTime + 1000;

    const buffer = await recorder.stop();
    
    Date.now = realDateNow;

    expect(mocks.mockStop).toHaveBeenCalled();
    expect(recorder.isRecording()).toBe(false);
    expect(buffer).not.toBeNull();
    expect(buffer?.toString()).toContain('chunk1chunk2');
  });


  it('should return null if recording is too short', async () => {
    const startPromise = recorder.start();
    mocks.mockStream.emit('data', Buffer.from('data'));
    await startPromise;
    
    const realDateNow = Date.now;
    const startTime = Date.now();
    Date.now = () => startTime + 100;

    recorder.on('error', () => {});

    const buffer = await recorder.stop();
    
    Date.now = realDateNow;

    expect(buffer).toBeNull();
  });

  it('should detect silence', async () => {
    const startPromise = recorder.start();
    mocks.mockStream.emit('data', Buffer.alloc(4));
    await startPromise;
    
    const silentBuffer = Buffer.alloc(1000); 
    mocks.mockStream.emit('data', silentBuffer);
    
    const realDateNow = Date.now;
    const startTime = realDateNow();
    Date.now = () => startTime + 1000;

    let warningMsg = '';
    recorder.on('warning', (msg) => {
        warningMsg = msg;
    });

    await recorder.stop();
    
    Date.now = realDateNow;

    expect(warningMsg).toBe('No audio detected');
  });

  it('should throw error if arecord is missing', async () => {
    (execSync as any).mockImplementation(() => {
        throw new Error('command not found');
    });
    
    let error: any;
    try {
        await recorder.start();
    } catch (e) {
        error = e;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe('AUDIO_BACKEND_MISSING');
  });
});
