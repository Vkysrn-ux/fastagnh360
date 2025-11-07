// pages/api/socket.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { Server as IOServer, Socket } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import cookie from 'cookie'

type SessionUser = {
  id: number
  name?: string
  email?: string
  displayRole?: string
  userType?: 'admin' | 'employee' | 'agent' | 'user'
}

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NextApiResponse['socket'] & {
    server: HTTPServer & { io?: IOServer }
  }
}

// In-memory presence: userId -> { sockets, user }
const userSockets = new Map<number, { sockets: Set<string>; user: SessionUser }>()

function parseSessionCookie(rawCookieHeader: string | undefined): SessionUser | null {
  try {
    const parsed = cookie.parse(rawCookieHeader || '')
    const sessRaw = parsed['user-session']
    if (!sessRaw) return null
    // Cookie value is likely URI encoded by Next cookies API
    const decoded = (() => {
      try { return decodeURIComponent(sessRaw) } catch { return sessRaw }
    })()
    const session = JSON.parse(decoded)
    const id = Number(session?.id || 0)
    if (!id) return null
    return {
      id,
      name: session?.name,
      email: session?.email,
      displayRole: session?.displayRole,
      userType: session?.userType,
    }
  } catch (_e) {
    return null
  }
}

function parseSessionFromReq(req: NextApiRequest): SessionUser | null {
  return parseSessionCookie(req.headers.cookie)
}

function broadcastOnline(io: IOServer) {
  const online = Array.from(userSockets.values()).map(({ user }) => ({
    id: user.id,
    name: user.name || `User #${user.id}`,
    displayRole: user.displayRole || 'User',
  }))
  io.emit('online_users', online)
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, {
      path: '/api/socket-io',
      addTrailingSlash: false,
      cors: { origin: true, credentials: true },
    })

    io.on('connection', (socket: Socket) => {
      // Identify user from cookie on the WebSocket upgrade request
      const session = parseSessionCookie((socket.request as any)?.headers?.cookie || '')

      if (!session) {
        socket.disconnect(true)
        return
      }

      const uid = session.id
      const entry = userSockets.get(uid) || { sockets: new Set<string>(), user: session }
      entry.user = session // refresh any name/role changes
      entry.sockets.add(socket.id)
      userSockets.set(uid, entry)

      // Let the client know their own session (optional)
      socket.emit('self', { id: uid, name: session.name || `User #${uid}` })

      // Notify everyone of presence change
      broadcastOnline(io)

      socket.on('disconnect', () => {
        const current = userSockets.get(uid)
        if (!current) return
        current.sockets.delete(socket.id)
        if (current.sockets.size === 0) {
          userSockets.delete(uid)
        } else {
          userSockets.set(uid, current)
        }
        broadcastOnline(io)
      })

      // Direct message event
      socket.on('chat:message', (payload: { toUserId: number; text: string; ticketId?: number | string }) => {
        try {
          const text = String(payload?.text || '').trim()
          const toUserId = Number(payload?.toUserId || 0)
          if (!text || !toUserId) return

          const msg = {
            fromUserId: uid,
            fromName: session.name || `User #${uid}`,
            toUserId,
            text,
            ticketId: payload?.ticketId || null,
            ts: Date.now(),
          }

          // Echo back to sender
          socket.emit('chat:message', msg)

          // Deliver to recipient if online
          const dest = userSockets.get(toUserId)
          if (dest && dest.sockets.size) {
            for (const sid of dest.sockets) {
              io.to(sid).emit('chat:message', msg)
            }
          }
        } catch (_e) {
          // ignore
        }
      })
    })

    res.socket.server.io = io
  }
  res.end()
}

export const config = {
  api: {
    bodyParser: false,
  },
}
