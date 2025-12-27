import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageCircle, Send, X } from 'lucide-react';
import { UserProfile } from '../../lib/api';

type ChatMessage = {
  id: string;
  message: string;
  sender: { id: number | string; role: string; name?: string | null };
  created_at: string;
};

interface ChatWidgetProps {
  profile: UserProfile;
}

export default function ChatWidget({ profile }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

  const groupedMessages = useMemo(() => {
    const groups: Array<{ label: string; messages: ChatMessage[] }> = [];
    messages.forEach((message) => {
      const date = new Date(message.created_at);
      const label = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.label !== label) {
        groups.push({ label, messages: [message] });
      } else {
        lastGroup.messages.push(message);
      }
    });
    return groups;
  }, [messages]);

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
        },
      );
    });

    socket.on('disconnect', () => {
      setStatus('idle');
    });

    socket.on('chat_history', (payload: ChatMessage[]) => {
      setMessages(payload || []);
    });

    socket.on('chat_message', (payload: ChatMessage) => {
      setMessages((prev) => [...prev, payload]);
    });

    socket.on('connect_error', () => {
      setStatus('error');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [apiRoot, isOpen, profile.full_name, profile.id, profile.role]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || !socketRef.current || status !== 'connected') return;
    socketRef.current.emit(
      'chat_message',
      { message: draft.trim() },
      (response: { ok: boolean }) => {
        if (!response?.ok) {
          setStatus('error');
        }
      },
    );
    setDraft('');
  };

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

          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
            {messages.length === 0 ? (
              <div className="text-center text-sm text-gray-500 dark:text-slate-400">
                Belum ada pesan. Mulai diskusi sekarang.
              </div>
            ) : (
              groupedMessages.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="flex items-center justify-center">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-slate-800 dark:text-slate-200">
                      {group.label}
                    </span>
                  </div>
                  {group.messages.map((msg) => {
                    const isOwn = String(msg.sender.id) === String(profile.id);
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
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
                            {new Date(msg.created_at).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
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
