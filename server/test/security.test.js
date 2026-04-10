import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io as createClient } from 'socket.io-client';
import { createAppServer } from '../app.js';
import { EVENTS, LIMITS } from '../../shared/constants.js';
import { resetStore } from '../store/memoryStore.js';

async function startTestServer() {
  resetStore();
  const { httpServer } = createAppServer({ serveClient: false });

  await new Promise((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });

  const address = httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    async close() {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      resetStore();
    },
  };
}

function connectClient(url) {
  const client = createClient(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });

  return once(client, 'connect').then(() => client);
}

function waitForEvent(socket, eventName) {
  return once(socket, eventName).then(([payload]) => payload);
}

async function createRoom(socket, nickname) {
  const joinedPromise = waitForEvent(socket, EVENTS.ROOM_JOINED);
  socket.emit(EVENTS.ROOM_CREATE, { nickname });
  return joinedPromise;
}

async function joinRoom(socket, code, nickname) {
  const joinedPromise = waitForEvent(socket, EVENTS.ROOM_JOINED);
  socket.emit(EVENTS.ROOM_JOIN, { code, nickname });
  return joinedPromise;
}

test('server drops text messages that exceed MESSAGE_TEXT_MAX_LENGTH', async () => {
  const server = await startTestServer();
  const host = await connectClient(server.url);
  const guest = await connectClient(server.url);

  try {
    const created = await createRoom(host, 'Host');
    await joinRoom(guest, created.code, 'Guest');

    let receivedMessage = false;
    guest.once(EVENTS.MESSAGE_NEW, () => { receivedMessage = true; });

    const oversizedText = 'A'.repeat(LIMITS.MESSAGE_TEXT_MAX_LENGTH + 1);
    host.emit(EVENTS.MESSAGE_SEND, { channel: 'general', text: oversizedText, type: 'text' });

    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(receivedMessage, false, 'oversized message should be dropped');
  } finally {
    host.disconnect();
    guest.disconnect();
    await server.close();
  }
});

test('server accepts text messages at exactly MESSAGE_TEXT_MAX_LENGTH', async () => {
  const server = await startTestServer();
  const host = await connectClient(server.url);
  const guest = await connectClient(server.url);

  try {
    const created = await createRoom(host, 'Host');
    await joinRoom(guest, created.code, 'Guest');

    const guestMessagePromise = waitForEvent(guest, EVENTS.MESSAGE_NEW);

    const maxText = 'A'.repeat(LIMITS.MESSAGE_TEXT_MAX_LENGTH);
    host.emit(EVENTS.MESSAGE_SEND, { channel: 'general', text: maxText, type: 'text' });

    const { message } = await guestMessagePromise;
    assert.equal(message.text.length, LIMITS.MESSAGE_TEXT_MAX_LENGTH);
  } finally {
    host.disconnect();
    guest.disconnect();
    await server.close();
  }
});

test('server drops image uploads with disallowed MIME type', async () => {
  const server = await startTestServer();
  const host = await connectClient(server.url);
  const guest = await connectClient(server.url);

  try {
    const created = await createRoom(host, 'Host');
    await joinRoom(guest, created.code, 'Guest');

    let receivedMessage = false;
    guest.once(EVENTS.MESSAGE_NEW, () => { receivedMessage = true; });

    // Send a non-image MIME type
    host.emit(EVENTS.MEDIA_UPLOAD, {
      channel: 'general',
      base64: 'SGVsbG8=',
      mimeType: 'application/javascript',
      filename: 'evil.js',
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(receivedMessage, false, 'disallowed MIME type upload should be dropped');
  } finally {
    host.disconnect();
    guest.disconnect();
    await server.close();
  }
});

test('server drops sticker messages with unknown sticker IDs', async () => {
  const server = await startTestServer();
  const host = await connectClient(server.url);
  const guest = await connectClient(server.url);

  try {
    const created = await createRoom(host, 'Host');
    await joinRoom(guest, created.code, 'Guest');

    let receivedMessage = false;
    guest.once(EVENTS.MESSAGE_NEW, () => { receivedMessage = true; });

    host.emit(EVENTS.MESSAGE_SEND, {
      channel: 'general',
      type: 'sticker',
      stickerId: '__proto__',
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(receivedMessage, false, 'unknown sticker ID should be dropped');
  } finally {
    host.disconnect();
    guest.disconnect();
    await server.close();
  }
});

test('server strips control characters from text messages', async () => {
  const server = await startTestServer();
  const host = await connectClient(server.url);
  const guest = await connectClient(server.url);

  try {
    const created = await createRoom(host, 'Host');
    await joinRoom(guest, created.code, 'Guest');

    const guestMessagePromise = waitForEvent(guest, EVENTS.MESSAGE_NEW);

    // Include null byte and control chars alongside normal text
    host.emit(EVENTS.MESSAGE_SEND, {
      channel: 'general',
      text: 'Hello\x00World\x01\x02',
      type: 'text',
    });

    const { message } = await guestMessagePromise;
    assert.equal(message.text, 'HelloWorld', 'control characters should be stripped');
  } finally {
    host.disconnect();
    guest.disconnect();
    await server.close();
  }
});
