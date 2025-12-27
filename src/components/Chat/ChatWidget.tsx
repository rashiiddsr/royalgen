import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageCircle, Send, X } from 'lucide-react';
import { UserProfile } from '../../lib/api';

type ChatMessage = {
  id: string;
  room: string;
  message: string;
  sender: { id: number | string; role: string; name?: string | null };
  created_at: string;
};

const roomsByRole = (role: string) => {
  const baseRooms = [{ id: 'shared', label: 'Diskusi Umum' }];
  if (role) {
    baseRooms.push({ id: `role:${role}`, label: `Ruang ${role}` });
  }
  if (role === 'superadmin') {
    baseRooms.push(
      { id: 'role:admin', label: 'Ruang admin' },
      { id: 'role:manager', label: 'Ruang manager' },
      { id: 'role:staff', label: 'Ruang staff' },
    );
  }
  return baseRooms;
};

interface ChatWidgetProps {
  profile: UserProfile;
}

export default function ChatWidget({ profile }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeRoom, setActiveRoom] = useState('shared');
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

  const rooms = useMemo(() => roomsByRole(profile.role), [profile.role]);

  useEffect(() => {
    if (!isOpen || socketRef.current) return;
    setStatus('connecting');
    const socket = io(apiRoot, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit(
        'register',
        { user_id: profile.id, role: profile.role, name: profile.full_name },
        (response: { ok: boolean }) => {
          if (!response?.ok) {
            setStatus('error');
            return;
          }
          setStatus('connected');
          socket.emit('join_room', { room: activeRoom });
        },
      );
    });

    socket.on('disconnect', () => {
      setStatus('idle');
    });

    socket.on('chat_message', (payload: ChatMessage) => {
      setMessages((prev) => {
        const next = { ...prev };
        const roomMessages = next[payload.room] ? [...next[payload.room]] : [];
        roomMessages.push(payload);
        next[payload.room] = roomMessages;
        return next;
      });
    });

    socket.on('connect_error', () => {
      setStatus('error');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeRoom, apiRoot, isOpen, profile.full_name, profile.id, profile.role]);

  useEffect(() => {
    if (!socketRef.current || status !== 'connected') return;
    socketRef.current.emit('join_room', { room: activeRoom });
  }, [activeRoom, status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeRoom, isOpen]);

  const handleSend = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || !socketRef.current || status !== 'connected') return;
    socketRef.current.emit(
      'chat_message',
      { room: activeRoom, message: draft.trim() },
      (response: { ok: boolean }) => {
        if (!response?.ok) {
          setStatus('error');
        }
      },
    );
    setDraft('');
  };

  const activeMessages = messages[activeRoom] || [];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:from-blue-500 hover:to-emerald-500"
      >
        <MessageCircle className="h-5 w-5" />
        Live Chat
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[32rem] w-[22rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Live Chat</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Status: {status}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2 border-b border-gray-100 px-4 py-3 text-xs font-semibold text-gray-600 dark:border-slate-800 dark:text-slate-300">
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => setActiveRoom(room.id)}
                className={`rounded-full px-3 py-1 ${
                  activeRoom === room.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {room.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
            {activeMessages.length === 0 ? (
              <div className="text-center text-sm text-gray-500 dark:text-slate-400">
                Belum ada pesan. Mulai diskusi sekarang.
              </div>
            ) : (
              activeMessages.map((msg) => {
                const isOwn = String(msg.sender.id) === String(profile.id);
                return (
                  <div key={msg.id} className={`mb-3 flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        isOwn
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <p className="text-xs font-semibold opacity-75">
                        {msg.sender.name || msg.sender.role}
                      </p>
                      <p>{msg.message}</p>
                      <p className="mt-1 text-[10px] opacity-70">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-gray-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ketik pesan..."
                className="flex-1 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                className="rounded-full bg-blue-600 p-2 text-white hover:bg-blue-500"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
