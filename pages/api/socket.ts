// pages/api/socket.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { Server as IOServer, Socket } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import cookie from 'cookie'
import { pool } from '@/lib/db'

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

// In-memory presence map. In dev with HMR, module scope can be reloaded;
// attach to the HTTP server instance to keep presence consistent.
const CHAT_DEBUG = (process.env.CHAT_DEBUG === '1' || process.env.CHAT_DEBUG === 'true' || process.env.NEXT_PUBLIC_CHAT_DEBUG === '1' || process.env.NEXT_PUBLIC_CHAT_DEBUG === 'true')
function getPresenceStore(server: any) {
  if (!server.__chatPresence) {
    server.__chatPresence = new Map<number, { sockets: Set<string>; user: SessionUser }>()
    if (CHAT_DEBUG) console.log('[chat][server] init presence store')
  }
  return server.__chatPresence as Map<number, { sockets: Set<string>; user: SessionUser }>
}

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

function broadcastOnline(io: IOServer, presence: Map<number, { sockets: Set<string>; user: SessionUser }>) {
  const online = Array.from(presence.values()).map(({ user }) => ({
    id: user.id,
    name: user.name || `User #${user.id}`,
    displayRole: user.displayRole || 'User',
  }))
  io.emit('online_users', online)
  if (CHAT_DEBUG) console.log('[chat][server] broadcast online:', online.map(u => u.id))
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket.server.io) {
    const presence = getPresenceStore(res.socket.server)
    const io = new IOServer(res.socket.server, {
      path: '/api/socket-io',
      addTrailingSlash: false,
      cors: { origin: true, credentials: true },
    })

    io.on('connection', (socket: Socket) => {
      // Identify user from cookie on the WebSocket upgrade request, or fallback to handshake auth
      let session = parseSessionCookie((socket.request as any)?.headers?.cookie || '')
      if (!session) {
        const auth: any = (socket.handshake as any)?.auth || {}
        const id = Number(auth?.id || auth?.uid || 0)
        const name = auth?.name ? String(auth.name) : undefined
        if (id) session = { id, name }
      }

      if (!session) {
        if (CHAT_DEBUG) console.warn('[chat][server] connect rejected: no session cookie')
        socket.disconnect(true)
        return
      }

      const uid = session.id
      if (CHAT_DEBUG) console.log('[chat][server] connect', { uid, socketId: socket.id })
      const entry = presence.get(uid) || { sockets: new Set<string>(), user: session }
      entry.user = session // refresh any name/role changes
      entry.sockets.add(socket.id)
      presence.set(uid, entry)

      // Let the client know their own session (optional)
      socket.emit('self', { id: uid, name: session.name || `User #${uid}` })

      // Notify everyone of presence change
      broadcastOnline(io, presence)

      socket.on('disconnect', () => {
        if (CHAT_DEBUG) console.log('[chat][server] disconnect', { uid, socketId: socket.id })
        const current = presence.get(uid)
        if (!current) return
        current.sockets.delete(socket.id)
        if (current.sockets.size === 0) {
          presence.delete(uid)
        } else {
          presence.set(uid, current)
        }
        broadcastOnline(io, presence)
      })

      // Direct message event
      socket.on('chat:message', async (payload: { toUserId: number; text: string; ticketId?: number | string }) => {
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

          if (CHAT_DEBUG) console.log('[chat][server] message', { from: uid, to: toUserId, text: text.slice(0, 60) })

          // Persist to database so both users can see history later
          try {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS chat_messages (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                from_user_id INT UNSIGNED NOT NULL,
                to_user_id INT UNSIGNED NOT NULL,
                ticket_id BIGINT UNSIGNED NULL,
                text TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                read_at DATETIME NULL,
                cleared_by_sender TINYINT(1) NOT NULL DEFAULT 0,
                cleared_by_recipient TINYINT(1) NOT NULL DEFAULT 0,
                PRIMARY KEY (id),
                KEY idx_users (from_user_id, to_user_id, created_at),
                KEY idx_to (to_user_id, created_at),
                KEY idx_ticket (ticket_id)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `)
            const ticketIdVal = (msg.ticketId == null || msg.ticketId === '') ? null : Number(msg.ticketId)
            await pool.query(
              'INSERT INTO chat_messages (from_user_id, to_user_id, ticket_id, text) VALUES (?, ?, ?, ?)',
              [uid, toUserId, ticketIdVal, text]
            )
          } catch (dbErr) {
            if (CHAT_DEBUG) console.warn('[chat][server] failed to persist message', dbErr)
          }

          // Echo back to sender
          socket.emit('chat:message', msg)

          // Deliver to recipient if online
          const dest = presence.get(toUserId)
          if (dest && dest.sockets.size) {
            for (const sid of dest.sockets) {
              io.to(sid).emit('chat:message', msg)
            }
          } else {
            if (CHAT_DEBUG) console.log('[chat][server] recipient offline', { toUserId })
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
