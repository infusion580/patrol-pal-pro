import { useState, useEffect } from 'react';
import { ArrowLeft, Send, Image, CheckCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
  read: boolean;
}

const Chat = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [supervisorName, setSupervisorName] = useState('Supervisor');

  useEffect(() => {
    if (!user) return;
    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        loadMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadMessages = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({
        id: m.id,
        text: m.message,
        sender: m.sender_id === user.id ? 'me' : 'other',
        time: new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        read: m.read,
      })));
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !user) return;
    // For now, send to a generic receiver - in production this would be the assigned supervisor
    const { error } = await supabase.from('chat_messages').insert({
      sender_id: user.id,
      receiver_id: user.id, // placeholder - should be supervisor's ID
      message: input,
    });
    if (!error) {
      setInput('');
      loadMessages();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <span className="text-sm font-bold">SV</span>
          </div>
          <div>
            <p className="font-display font-bold text-sm">Chat con Supervisor</p>
            <p className="text-xs opacity-70">Mensajes en tiempo real</p>
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
              <p className="text-sm">{msg.text}</p>
              <div className={`flex items-center justify-end gap-1 mt-1 ${
                msg.sender === 'me' ? 'text-primary-foreground/60' : 'text-muted-foreground'
              }`}>
                <span className="text-[10px]">{msg.time}</span>
                {msg.sender === 'me' && <CheckCheck className="w-3 h-3" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border-t border-border px-4 py-3 mb-16">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <button className="text-muted-foreground hover:text-foreground p-2">
            <Image className="w-5 h-5" />
          </button>
          <Input
            placeholder="Escribe un mensaje..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            className="flex-1 h-10"
          />
          <button onClick={sendMessage} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Chat;
