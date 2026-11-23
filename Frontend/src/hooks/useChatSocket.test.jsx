// @vitest-environment jsdom

import { StrictMode } from "react"
import { act, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useAuth } from "@/context/authState"
import { useChatSocket } from "./useChatSocket"

vi.mock("@/context/authState", () => ({ useAuth: vi.fn() }))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it("opens one connection in Strict Mode and ignores callbacks from a disposed socket", () => {
  vi.useFakeTimers()
  const sockets = []
  class FakeSocket {
    static CONNECTING = 0
    readyState = FakeSocket.CONNECTING
    close = vi.fn()

    constructor() {
      sockets.push(this)
    }
  }
  vi.stubGlobal("WebSocket", FakeSocket)
  useAuth.mockReturnValue({ user: { id: "principal" } })

  const { rerender, unmount } = renderHook(() => useChatSocket(), { wrapper: StrictMode })
  act(() => vi.advanceTimersByTime(0))
  expect(sockets).toHaveLength(1)
  expect(sockets[0].close).not.toHaveBeenCalled()

  useAuth.mockReturnValue({ user: { id: "principal", first_name: "Updated" } })
  rerender()
  act(() => vi.advanceTimersByTime(0))
  expect(sockets).toHaveLength(1)

  unmount()
  sockets[0].onclose({ code: 1006 })
  act(() => vi.advanceTimersByTime(1500))
  expect(sockets[0].close).toHaveBeenCalledOnce()
  expect(sockets).toHaveLength(1)
})
