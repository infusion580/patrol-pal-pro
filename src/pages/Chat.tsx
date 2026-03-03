import { useState } from 'react';
import { ArrowLeft, Send, Image, CheckCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';

interface Message {
  id: number;
  text: string;
  sender: 'me' | 'other';
  time: string;
  read: boolean;
}

const initialMessages: Message[] = [
  { id: 1, text: 'Buenos días, ¿todo en orden en la zona norte?', sender: 'other', time: '09:00', read: true },
  { id: 2, text: 'Sí, supervisor. Todo tranquilo, rondín completado sin novedades.', sender: 'me', time: '09:02', read: true },
  { id: 3, text: 'Perfecto. Recuerda enviar tu reporte antes de las 15:00.', sender: 'other', time: '09:05', read: true },
];

const Chat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: input,
      sender: 'me',
      time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    }]);
    setInput('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <span className="text-sm font-bold">MG</span>
          </div>
          <div>
            <p className="font-display font-bold text-sm">María García</p>
            <p className="text-xs opacity-70">Supervisora — En línea</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-3">
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

      {/* Input */}
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
          <button
            onClick={sendMessage}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
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
