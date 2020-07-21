import { ReadStream } from 'fs';
import * as fs from 'fs';
import eventStream, { MapStream } from 'event-stream';

export class ChunkedLineStream {
  private readStream: ReadStream;

  private splitStream: MapStream;

  private buffer: string[] = [];

  private reading = false;

  private linesToRead = 1;

  private end = false;

  private error: Error | null = null;

  constructor(path: string) {
    // Instead of piping into splitStream,
    // we use on('data') so that we can pause / resume the readStream on demand
    this.readStream = fs.createReadStream(path);
    this.splitStream = eventStream.split();
    this.readStream.on('data', (data) => {
      this.splitStream.write(data);
    });
    this.readStream.on('end', () => {
      this.end = true;
      this.splitStream.end();
    });
    this.readStream.on('error', (e) => {
      this.error = e;
    });

    this.splitStream.on('data', (line) => {
      // there might be spillovers after calling pause(),
      // so we should always store the lines in the buffer
      this.buffer.push(line);
      this.linesToRead--;
      if (this.linesToRead === 0) {
        this.readStream.pause();
        this.splitStream.emit('chunk');
      }
    });
  }

  /**
   * Read lines in a specified chunk size
   * @param size number of lines in a chunk
   * @return Array of lines in string, or null if we have already finished reading the file
   */
  async readChunk(size: number): Promise<string[] | null> {
    if (this.error) {
      throw this.error;
    }
    if (size <= 0) {
      throw new Error('Size must be positive');
    }
    if (this.reading) {
      throw new Error('Concurrent calls to readChunk is not allowed');
    }
    if (this.end && this.buffer.length === 0) {
      return null;
    }
    if (!this.end && this.buffer.length < size) {
      this.reading = true;
      this.linesToRead = size - this.buffer.length;
      this.readStream.resume();

      let listener: any = null;
      await new Promise((resolve) => {
        listener = resolve;
        // it is possible that a chunk is not ready but we have already reached the end
        // so it's best to listen to both events
        this.splitStream.once('chunk', resolve);
        this.splitStream.once('end', resolve);
      });
      this.splitStream.removeListener('chunk', listener);
      this.splitStream.removeListener('end', listener);
      this.reading = false;
    }
    return this.buffer.splice(0, size);
  }
}
