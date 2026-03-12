import { useState, useEffect } from 'react';
import { ArrowLeft, Send, Paperclip, Lock, CheckCheck, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';

const topics = [
{ id: 'nomina', label: '💰 Nómina', icon: '💰' },
{ id: 'permiso', label: '📋 Permisos', icon: '📋' },
{ id: 'incapacidad', label: '🏥 Incapacidad', icon: '🏥' },
{ id: 'conflicto', label: '⚠️ Conflicto', icon: '⚠️' },
{ id: 'dudas', label: '❓ Dudas', icon: '❓' }];


const ChatRH = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [folio, setFolio] = useState('');
  const [messages, setMessages] = useState<Array<{id: string;text: string;sender: 'me' | 'rh';time: string;confidential?: boolean;}>>([]);
  const [input, setInput] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);

  useEffect(() => {
    if (selectedTopic && user) {
      const newFolio = `RH-${Date.now().toString().slice(-6)}`;
      setFolio(newFolio);
      loadMessages(selectedTopic);
    }
  }, [selectedTopic, user]);

  const loadMessages = async (topic: string) => {
    if (!user) return;
    const { data } = await supabase.
    from('chat_rh').
    select('*').
    eq('user_id', user.id).
    eq('topic', topic).
    order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map((m) => ({
        id: m.id,
        text: m.message,
        sender: m.sender === 'user' ? 'me' : 'rh',
        time: new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        confidential: m.confidential
      })));
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !user || !selectedTopic) return;
    const { error } = await supabase.from('chat_rh').insert({
      user_id: user.id,
      topic: selectedTopic,
      folio,
      message: input,
      sender: 'user',
      confidential: isConfidential
    });
    if (!error) {
      setInput('');
      loadMessages(selectedTopic);
    }
  };

  if (!selectedTopic) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl bg-destructive">
          <div className="max-w-lg mx-auto">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm opacity-80 mb-2">
              <ArrowLeft className="w-4 h-4" /> Regresar
            </button>
            <h1 className="text-xl font-display font-bold">Chat con Recursos Humanos</h1>
            <p className="text-sm opacity-70 mt-1 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Canal privado y confidencial
            </p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 mt-4">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">¿En qué podemos ayudarte?</h2>
          <div className="space-y-2">
            {topics.map((topic) =>
            <button key={topic.id} onClick={() => setSelectedTopic(topic.id)} className="w-full bg-card rounded-xl p-4 shadow-card text-left hover:shadow-elevated transition-shadow active:scale-[0.98] flex items-center gap-3">
                <span className="text-2xl">{topic.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-foreground">{topic.label.split(' ').slice(1).join(' ')}</p>
                  <p className="text-xs text-muted-foreground">Selecciona para iniciar conversación</p>
                </div>
              </button>
            )}
          </div>
          <div className="mt-6 p-4 rounded-xl bg-accent">
            <p className="text-xs text-muted-foreground">
              <Lock className="w-3 h-3 inline mr-1" />
              Todas las conversaciones generan un folio de seguimiento. Los mensajes marcados como confidenciales tienen acceso restringido.
            </p>
          </div>
        </div>
        <BottomNav />
      </div>);

  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => setSelectedTopic(null)}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <span className="text-sm">👩‍💼</span>
          </div>
          <div>
            <p className="font-display font-bold text-sm">Recursos Humanos</p>
            <p className="text-xs opacity-70">Folio: {folio}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-3">
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-card text-foreground shadow-card rounded-bl-md">
            <p className="text-sm">¡Hola! 👋 Has abierto un caso de <strong>{topics.find((t) => t.id === selectedTopic)?.label}</strong>. ¿En qué te puedo ayudar?</p>
            <span className="text-[10px] text-muted-foreground">RH</span>
          </div>
        </div>

        {messages.map((msg) =>
        <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          msg.sender === 'me' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card text-foreground shadow-card rounded-bl-md'}`
          }>
              {msg.confidential &&
            <span className="text-[10px] flex items-center gap-1 mb-1 opacity-70">
                  <Lock className="w-2.5 h-2.5" /> Confidencial
                </span>
            }
              <p className="text-sm">{msg.text}</p>
              <div className="flex items-center justify-end gap-1 mt-1 opacity-60">
                <span className="text-[10px]">{msg.time}</span>
                {msg.sender === 'me' && <CheckCheck className="w-3 h-3" />}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border-t border-border px-4 py-3 mb-16">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setIsConfidential(!isConfidential)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${isConfidential ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>
              <Lock className="w-3 h-3" /> {isConfidential ? 'Confidencial' : 'Normal'}
            </button>
            <button className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
              <Paperclip className="w-3 h-3" /> Adjuntar
            </button>
            <button className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
              <Calendar className="w-3 h-3" /> Solicitar cita
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Escribe tu mensaje..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} className="flex-1 h-10" />
            <button onClick={sendMessage} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>);

};

export default ChatRH;