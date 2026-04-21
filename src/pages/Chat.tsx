import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Users, User, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

interface ChatContact {
  user_id: string;
  nombre: string;
  apellido: string;
  role: string;
  unread: number;
}

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
  read: boolean;
  created_at: string;
}

const Chat = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedContactRef = useRef<ChatContact | null>(null);

  // Keep ref in sync so realtime handler always sees the current selection
  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  const loadContacts = useCallback(async () => {
    if (!user) return;
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, nombre, apellido, servicio_asignado_id, supervisor_asignado_id');
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    if (!profiles || !roles) { setLoading(false); return; }

    const roleMap = new Map(roles.map(r => [r.user_id, r.role]));
    const myProfile = profiles.find(p => p.user_id === user.id);
    const mySupervisorId = (myProfile as any)?.supervisor_asignado_id ?? null;

    let filtered = profiles.filter(p => p.user_id !== user.id);

    if (user.role === 'guardia') {
      // Guardia: SOLO su supervisor asignado + todos los admins (RH).
      // No puede ver otros guardias ni supervisores no asignados.
      filtered = filtered.filter(p => {
        const r = roleMap.get(p.user_id);
        if (r === 'admin') return true;
        if (r === 'supervisor' && mySupervisorId && p.user_id === mySupervisorId) return true;
        return false;
      });
    } else if (user.role === 'supervisor') {
      // Supervisor: SOLO los guardias que tiene asignados (supervisor_asignado_id = mi user.id) + admins.
      filtered = filtered.filter(p => {
        const r = roleMap.get(p.user_id);
        if (r === 'admin') return true;
        if (r === 'guardia' && (p as any).supervisor_asignado_id === user.id) return true;
        return false;
      });
    }
    // admin (RH): ve a todos los usuarios del sistema (sin filtro adicional)

    const { data: unreadData } = await supabase
      .from('chat_messages')
      .select('sender_id')
      .eq('receiver_id', user.id)
      .eq('read', false);

    const unreadMap: Record<string, number> = {};
    unreadData?.forEach(m => { unreadMap[m.sender_id] = (unreadMap[m.sender_id] || 0) + 1; });

    const contactList: ChatContact[] = filtered.map(p => ({
      user_id: p.user_id,
      nombre: p.nombre,
      apellido: p.apellido,
      role: roleMap.get(p.user_id) || 'guardia',
      unread: unreadMap[p.user_id] || 0,
    })).sort((a, b) => {
      if (b.unread !== a.unread) return b.unread - a.unread;
      // Admins first, then supervisor, then guards alphabetically
      const roleOrder = (r: string) => r === 'admin' ? 0 : r === 'supervisor' ? 1 : 2;
      const ro = roleOrder(a.role) - roleOrder(b.role);
      if (ro !== 0) return ro;
      return a.nombre.localeCompare(b.nombre);
    });

    setContacts(contactList);
    setLoading(false);
  }, [user]);

  const loadMessages = useCallback(async (contactId: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('loadMessages error:', error);
      return;
    }

    if (data) {
      setMessages(data.map(m => ({
        id: m.id,
        text: m.message,
        sender: m.sender_id === user.id ? 'me' as const : 'other' as const,
        time: new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        read: m.read,
        created_at: m.created_at,
      })));

      const unreadIds = data.filter(m => m.receiver_id === user.id && !m.read).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('chat_messages').update({ read: true }).in('id', unreadIds);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadContacts();
  }, [user, loadContacts]);

  // Single subscription for the lifetime of the page (does not depend on selectedContact)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-rt-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${user.id}` },
        (payload: any) => {
          const current = selectedContactRef.current;
          if (current && payload.new.sender_id === current.user_id) {
            loadMessages(current.user_id);
          }
          loadContacts();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `sender_id=eq.${user.id}` },
        (payload: any) => {
          const current = selectedContactRef.current;
          if (current && payload.new.receiver_id === current.user_id) {
            loadMessages(current.user_id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, loadContacts, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectContact = (contact: ChatContact) => {
    setSelectedContact(contact);
    loadMessages(contact.user_id);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !user || !selectedContact || sending) return;
    setSending(true);
    const { error } = await supabase.from('chat_messages').insert({
      sender_id: user.id,
      receiver_id: selectedContact.user_id,
      message: text,
    });
    if (error) {
      console.error('sendMessage error:', error);
      toast.error('No se pudo enviar el mensaje');
    } else {
      setInput('');
      loadMessages(selectedContact.user_id);
    }
    setSending(false);
  };

  const isGuardiaViewer = user?.role === 'guardia';

  const getRoleIcon = (role: string) => {
    if (role === 'admin') return <Shield className="w-3.5 h-3.5 text-primary" />;
    if (role === 'supervisor') return <Users className="w-3.5 h-3.5 text-success" />;
    return <User className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return isGuardiaViewer ? 'RH' : 'Administrador';
    if (role === 'supervisor') return 'Supervisor';
    return 'Guardia';
  };

  const getDisplayName = (contact: { nombre: string; apellido: string; role: string }) => {
    if (isGuardiaViewer && contact.role === 'admin') return { nombre: 'RH', apellido: '' };
    return { nombre: contact.nombre, apellido: contact.apellido };
  };

  const getInitials = (contact: { nombre: string; apellido: string; role: string }) => {
    if (isGuardiaViewer && contact.role === 'admin') return 'RH';
    return `${contact.nombre?.[0] || '?'}${contact.apellido?.[0] || ''}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!selectedContact) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl bg-destructive">
          <div className="max-w-lg mx-auto">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
              <ArrowLeft className="w-4 h-4" /> Regresar
            </button>
            <h1 className="text-xl font-display font-bold">Chat Operativo</h1>
            <p className="text-sm opacity-70 mt-1">Mensajes por rol</p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-4 space-y-2">
          {contacts.length === 0 && (
            <div className="bg-card rounded-xl p-8 shadow-card text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No hay contactos disponibles</p>
            </div>
          )}
          {contacts.map(c => (
            <button
              key={c.user_id}
              onClick={() => selectContact(c)}
              className="w-full bg-card rounded-xl p-4 shadow-card flex items-center gap-3 text-left hover:shadow-elevated transition-shadow"
            >
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-foreground">
                  {getInitials(c)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {getDisplayName(c).nombre} {getDisplayName(c).apellido}
                </p>
                <div className="flex items-center gap-1">
                  {getRoleIcon(c.role)}
                  <span className="text-[10px] text-muted-foreground">{getRoleLabel(c.role)}</span>
                </div>
              </div>
              {c.unread > 0 && (
                <div className="min-w-5 h-5 px-1.5 rounded-full bg-emergency flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary-foreground">{c.unread}</span>
                </div>
              )}
            </button>
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="text-primary-foreground px-4 pt-12 pb-4 bg-destructive">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => { setSelectedContact(null); setMessages([]); loadContacts(); }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <span className="text-sm font-bold">
              {(selectedContact.nombre?.[0] || '?')}{(selectedContact.apellido?.[0] || '')}
            </span>
          </div>
          <div>
            <p className="font-display font-bold text-sm">{selectedContact.nombre} {selectedContact.apellido}</p>
            <div className="flex items-center gap-1">
              {getRoleIcon(selectedContact.role)}
              <span className="text-xs opacity-70">{getRoleLabel(selectedContact.role)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No hay mensajes aún</p>
            <p className="text-xs text-muted-foreground">Envía un mensaje para iniciar la conversación</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
              msg.sender === 'me'
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-card text-foreground shadow-card rounded-bl-md'
            }`}>
              <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
              <div className={`flex items-center justify-end gap-1 mt-1 ${
                msg.sender === 'me' ? 'text-primary-foreground/60' : 'text-muted-foreground'
              }`}>
                <span className="text-[10px]">{msg.time}</span>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-card border-t border-border px-4 py-3 mb-16">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Input
            placeholder="Escribe un mensaje..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            disabled={sending}
            className="flex-1 h-10"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Chat;
