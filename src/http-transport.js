import { EventEmitter } from 'events';

export class HttpServerTransport extends EventEmitter {
  constructor() {
    super();
    this.messages = [];
  }

  async send(message) {
    this.messages.push(message);
    return message;
  }

  async start() {
    // No-op for HTTP transport
  }

  async close() {
    // No-op for HTTP transport
  }

  // Process a message and return the response
  async processMessage(message) {
    return new Promise((resolve, reject) => {
      // Store the send function temporarily
      const originalSend = this.send.bind(this);
      let timeout;
      
      // Override send to capture the response
      this.send = async (response) => {
        this.send = originalSend; // Restore original
        if (timeout) clearTimeout(timeout);
        resolve(response);
        return response;
      };

      // Emit the message to trigger processing
      this.emit('message', message);
      
      // Set a timeout in case no response is sent
      timeout = setTimeout(() => {
        this.send = originalSend;
        reject(new Error('No response received'));
      }, 10000);
    });
  }
}