// Type definitions for Web Serial API
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream | null;
}

interface NavigatorWithSerial extends Navigator {
  serial: {
    requestPort(): Promise<SerialPort>;
  };
}

export class SerialController {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter | null = null;

  async connect(): Promise<boolean> {
    if (!('serial' in navigator)) {
      alert("Web Serial API not supported in this browser.");
      return false;
    }

    try {
      this.port = await (navigator as unknown as NavigatorWithSerial).serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      
      if (this.port.writable) {
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
        this.writer = textEncoder.writable.getWriter();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Serial Connection Failed:", err);
      return false;
    }
  }

  async sendData(data: string): Promise<void> {
    if (!this.writer) return;
    try {
      await this.writer.write(data + "\n");
    } catch (err) {
      console.error("Serial Write Error:", err);
    }
  }

  async disconnect() {
    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }
}

export const serialInstance = new SerialController();