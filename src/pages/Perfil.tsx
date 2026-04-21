import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { LogOut, Shield, Bell, HelpCircle, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

const Perfil = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [uploading, setUploading] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'La imagen no debe superar 5MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const url = `${publicUrl}?t=${Date.now()}`;

      await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('user_id', user.id);

      setAvatarUrl(url);
      toast({ title: 'Foto actualizada', description: 'Tu foto de perfil se ha actualizado.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo subir la imagen.', variant: 'destructive' });
    }
    setUploading(false);
  };

  const menuItems = [
    { icon: Bell, label: 'Notificaciones' },
    { icon: HelpCircle, label: 'Ayuda y Soporte' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="text-primary-foreground px-4 pt-12 pb-8 rounded-b-3xl app-header">
        <div className="max-w-lg mx-auto flex flex-col items-center">
          <div className="relative mb-3">
            <Avatar className="w-20 h-20 border-4 border-primary-foreground/30">
              <AvatarImage src={avatarUrl} alt="Foto de perfil" />
              <AvatarFallback className="text-2xl font-bold bg-primary-foreground/20 text-primary-foreground">
                {user?.nombre?.[0]}{user?.apellido?.[0]}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center border-2 border-primary-foreground/30 hover:bg-primary/80 transition-colors"
            >
              <Camera className="w-4 h-4 text-primary-foreground" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <h1 className="text-xl font-display font-bold">{user?.nombre} {user?.apellido}</h1>
          <p className="text-sm opacity-70 font-mono">#{user?.numeroEmpleado}</p>
          <span className="mt-2 text-xs px-3 py-1 rounded-full bg-primary-foreground/20 font-semibold capitalize flex items-center gap-1">
            <Shield className="w-3 h-3" /> {user?.role}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-2">
        {/* Info card */}
        <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Información</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Correo</span>
              <span className="text-foreground font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Empleado</span>
              <span className="text-foreground font-mono font-medium">#{user?.numeroEmpleado}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rol</span>
              <span className="text-foreground font-medium capitalize">{user?.role}</span>
            </div>
          </div>
        </div>

        {menuItems.map((item) => (
          <button
            key={item.label}
            className="w-full bg-card rounded-xl p-4 shadow-card flex items-center gap-3 hover:shadow-elevated transition-shadow"
          >
            <item.icon className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">{item.label}</span>
          </button>
        ))}

        <Button onClick={handleLogout} variant="outline" className="w-full h-12 mt-4 text-emergency border-emergency/30 hover:bg-emergency/5">
          <LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Perfil;
