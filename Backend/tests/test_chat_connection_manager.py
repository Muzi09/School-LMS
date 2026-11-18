import asyncio
import os
from urllib.parse import urlsplit
from uuid import uuid4

import pytest
from fastapi import WebSocketDisconnect

from app.core import connection_manager as chat


class RecordingSocket:
    def __init__(self, *, disconnected=False):
        self.disconnected = disconnected
        self.messages = asyncio.Queue()

    async def accept(self):
        pass

    async def send_json(self, event):
        if self.disconnected:
            raise WebSocketDisconnect(code=1006)
        await self.messages.put(event)

    async def next_event(self, event_type):
        async with asyncio.timeout(4):
            while True:
                event = await self.messages.get()
                if event["type"] == event_type:
                    return event


def test_disconnected_socket_does_not_stop_other_deliveries():
    async def exercise():
        manager = chat.ConnectionManager()
        user_id, school_id = uuid4(), uuid4()
        stale = RecordingSocket(disconnected=True)
        active = RecordingSocket()
        await manager.connect(user_id, school_id, stale)
        await manager.connect(user_id, school_id, active)
        event = {"type": "message", "message": "Synthetic delivery"}
        await manager.broadcast_to_users([user_id], event)
        assert await active.next_event("message") == event

    asyncio.run(exercise())


def test_broker_shares_delivery_and_presence_between_workers(monkeypatch):
    url = os.environ.get("LMS_TEST_REDIS_URL")
    if not url:
        pytest.skip("Set LMS_TEST_REDIS_URL to an isolated loopback Redis instance.")
    address = urlsplit(url)
    if address.scheme != "redis" or address.hostname not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("LMS_TEST_REDIS_URL must point to a loopback Redis instance.")
    monkeypatch.setattr(chat.settings, "CHAT_REDIS_URL", url)
    monkeypatch.setattr(chat, "CHANNEL", f"school-lms:test:{uuid4().hex}")
    timestamps = []
    monkeypatch.setattr(chat, "_save_last_seen", lambda user_id, _seen_at: timestamps.append(user_id))

    async def exercise():
        worker_one, worker_two = chat.ConnectionManager(), chat.ConnectionManager()
        user_id, peer_id, other_school_id, school_id = uuid4(), uuid4(), uuid4(), uuid4()
        peer_first, peer_second, observer, other_school = (
            RecordingSocket() for _ in range(4)
        )

        try:
            await worker_one.start()
            await worker_two.start()
            await worker_one.connect(user_id, school_id, observer)
            await worker_one.connect(other_school_id, uuid4(), other_school)
            await worker_two.connect(peer_id, school_id, peer_first)
            await worker_one.connect(peer_id, school_id, peer_second)

            online = await observer.next_event("presence")
            assert online["user_id"] == str(peer_id) and online["is_online"]
            assert worker_one.is_user_online(peer_id)

            event = {"type": "message", "message": "Synthetic delivery across workers"}
            await worker_one.broadcast_to_users([peer_id], event)
            assert await peer_first.next_event("message") == event
            assert await peer_second.next_event("message") == event

            await worker_two.disconnect(peer_id, peer_first)
            assert worker_two.is_user_online(peer_id)
            assert not timestamps
            await worker_one.disconnect(peer_id, peer_second)
            offline = await observer.next_event("presence")
            assert offline["user_id"] == str(peer_id) and not offline["is_online"]
            assert not worker_two.is_user_online(peer_id)
            assert timestamps == [peer_id]
            assert other_school.messages.empty()
        finally:
            await worker_two.stop()
            await worker_one.stop()

    asyncio.run(exercise())
