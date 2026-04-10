import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io as createClient } from 'socket.io-client';
import { createAppServer } from '../app.js';
import { EVENTS, MEMBER_ROLES } from '../../shared/constants.js';
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

test('host can resume the room and clear grace-period deletion', async () => {
  const server = await startTestServer();
  const host = await connectClient(server.url);
  const guest = await connectClient(server.url);

  try {
    const created = await createRoom(host, 'Host');
    await joinRoom(guest, created.code, 'Guest');

    const guestHostWarning = waitForEvent(guest, EVENTS.ROOM_HOST_WARNING);
    host.disconnect();

    const hostWarning = await guestHostWarning;
    assert.equal(hostWarning.secondsLeft, 60);

    const hostReturn = await connectClient(server.url);

    try {
      const guestHostBack = waitForEvent(guest, EVENTS.ROOM_HOST_BACK);
      const resumedPromise = waitForEvent(hostReturn, EVENTS.ROOM_JOINED);

      hostReturn.emit(EVENTS.ROOM_RESUME, {
        code: created.code,
        memberSessionId: created.memberSessionId,
      });

      const resumed = await resumedPromise;
      await guestHostBack;

      assert.equal(resumed.code, created.code);
      assert.equal(resumed.you.nickname, 'Host');
      assert.equal(resumed.you.isCreator, true);
      assert.equal(resumed.resumed, true);
    } finally {
      hostReturn.disconnect();
    }
  } finally {
    guest.disconnect();
    await server.close();
  }
});

test('kicked members stop receiving room broadcasts and cannot resume', async () => {
  const server = await startTestServer();
  const host = await connectClient(server.url);
  const guest = await connectClient(server.url);

  try {
    const created = await createRoom(host, 'Host');
    const joinedGuest = await joinRoom(guest, created.code, 'Guest');

    const kickedPromise = waitForEvent(guest, EVENTS.ROOM_KICKED);
    host.emit(EVENTS.MEMBER_KICK, { socketId: guest.id });
    await kickedPromise;

    let receivedMessage = false;
    guest.once(EVENTS.MESSAGE_NEW, () => {
      receivedMessage = true;
    });

    host.emit(EVENTS.MESSAGE_SEND, {
      channel: 'general',
      text: 'still here?',
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(receivedMessage, false);

    const resumedGuest = await connectClient(server.url);

    try {
      const kickedAgain = waitForEvent(resumedGuest, EVENTS.ROOM_KICKED);

      resumedGuest.emit(EVENTS.ROOM_RESUME, {
        code: created.code,
        memberSessionId: joinedGuest.memberSessionId,
      });

      await kickedAgain;
    } finally {
      resumedGuest.disconnect();
    }
  } finally {
    host.disconnect();
    guest.disconnect();
    await server.close();
  }
});

test('host transfer survives reconnect logic through session ownership', async () => {
  const server = await startTestServer();
  const host = await connectClient(server.url);
  const guest = await connectClient(server.url);

  try {
    const created = await createRoom(host, 'Host');
    await joinRoom(guest, created.code, 'Guest');

    const transferred = waitForEvent(host, EVENTS.HOST_TRANSFERRED);
    host.emit(EVENTS.HOST_TRANSFER, { targetSocketId: guest.id });

    const transferPayload = await transferred;
    assert.equal(transferPayload.toNickname, 'Guest');

    host.disconnect();

    const hostResumeClient = await connectClient(server.url);

    try {
      const resumedPromise = waitForEvent(hostResumeClient, EVENTS.ROOM_JOINED);

      hostResumeClient.emit(EVENTS.ROOM_RESUME, {
        code: created.code,
        memberSessionId: created.memberSessionId,
      });

      const resumed = await resumedPromise;
      assert.equal(resumed.you.nickname, 'Host');
      assert.equal(resumed.you.isCreator, false);
    } finally {
      hostResumeClient.disconnect();
    }
  } finally {
    guest.disconnect();
    await server.close();
  }
});

test('host can promote a moderator and moderators can kick members', async () => {
  const server = await startTestServer();
  const host = await connectClient(server.url);
  const modCandidate = await connectClient(server.url);
  const member = await connectClient(server.url);

  try {
    const created = await createRoom(host, 'Host');
    await joinRoom(modCandidate, created.code, 'Mod');
    await joinRoom(member, created.code, 'Member');

    const roleUpdated = waitForEvent(host, EVENTS.MEMBER_ROLE_UPDATED);
    host.emit(EVENTS.MEMBER_ROLE_UPDATE, {
      socketId: modCandidate.id,
      role: MEMBER_ROLES.MODERATOR,
    });

    const rolePayload = await roleUpdated;
    assert.equal(rolePayload.socketId, modCandidate.id);
    assert.equal(rolePayload.role, MEMBER_ROLES.MODERATOR);

    const kickedPromise = waitForEvent(member, EVENTS.ROOM_KICKED);
    modCandidate.emit(EVENTS.MEMBER_KICK, { socketId: member.id });
    await kickedPromise;

    let receivedMessage = false;
    member.once(EVENTS.MESSAGE_NEW, () => {
      receivedMessage = true;
    });

    host.emit(EVENTS.MESSAGE_SEND, {
      channel: 'general',
      text: 'post-kick check',
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(receivedMessage, false);
  } finally {
    host.disconnect();
    modCandidate.disconnect();
    member.disconnect();
    await server.close();
  }
});

test('host can delete the room for all connected members', async () => {
  const server = await startTestServer();
  const host = await connectClient(server.url);
  const guest = await connectClient(server.url);

  try {
    const created = await createRoom(host, 'Host');
    const joinedGuest = await joinRoom(guest, created.code, 'Guest');

    const hostDeleted = waitForEvent(host, EVENTS.ROOM_DELETED);
    const guestDeleted = waitForEvent(guest, EVENTS.ROOM_DELETED);

    host.emit(EVENTS.ROOM_DELETE);

    await hostDeleted;
    await guestDeleted;

    const guestReconnect = await connectClient(server.url);

    try {
      const resumeFailed = waitForEvent(guestReconnect, EVENTS.ROOM_RESUME_FAILED);
      guestReconnect.emit(EVENTS.ROOM_RESUME, {
        code: created.code,
        memberSessionId: joinedGuest.memberSessionId,
      });
      await resumeFailed;
    } finally {
      guestReconnect.disconnect();
    }
  } finally {
    host.disconnect();
    guest.disconnect();
    await server.close();
  }
});
