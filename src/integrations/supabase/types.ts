export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      asistencias: {
        Row: {
          auto_generado: boolean
          created_at: string
          duracion_minutos: number | null
          fin: string | null
          fin_esperado: string | null
          guardia_id: string
          horas_extra: number
          id: string
          inicio: string
          observaciones: string | null
          servicio_id: string | null
          status: string
          tipo_turno: string
          turno_id: string | null
          updated_at: string
        }
        Insert: {
          auto_generado?: boolean
          created_at?: string
          duracion_minutos?: number | null
          fin?: string | null
          fin_esperado?: string | null
          guardia_id: string
          horas_extra?: number
          id?: string
          inicio?: string
          observaciones?: string | null
          servicio_id?: string | null
          status?: string
          tipo_turno: string
          turno_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_generado?: boolean
          created_at?: string
          duracion_minutos?: number | null
          fin?: string | null
          fin_esperado?: string | null
          guardia_id?: string
          horas_extra?: number
          id?: string
          inicio?: string
          observaciones?: string | null
          servicio_id?: string | null
          status?: string
          tipo_turno?: string
          turno_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          accion: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          datos_antes: Json | null
          datos_despues: Json | null
          dispositivo: Json | null
          id: string
          registro_id: string | null
          tabla: string
        }
        Insert: {
          accion: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          datos_antes?: Json | null
          datos_despues?: Json | null
          dispositivo?: Json | null
          id?: string
          registro_id?: string | null
          tabla: string
        }
        Update: {
          accion?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          datos_antes?: Json | null
          datos_despues?: Json | null
          dispositivo?: Json | null
          id?: string
          registro_id?: string | null
          tabla?: string
        }
        Relationships: []
      }
      branding: {
        Row: {
          accent_hsl: string
          background_hsl: string
          card_hsl: string
          id: boolean
          logo_url: string | null
          primary_glow_hsl: string
          primary_hsl: string
          soporte_whatsapp: string
          updated_at: string
        }
        Insert: {
          accent_hsl?: string
          background_hsl?: string
          card_hsl?: string
          id?: boolean
          logo_url?: string | null
          primary_glow_hsl?: string
          primary_hsl?: string
          soporte_whatsapp?: string
          updated_at?: string
        }
        Update: {
          accent_hsl?: string
          background_hsl?: string
          card_hsl?: string
          id?: boolean
          logo_url?: string | null
          primary_glow_hsl?: string
          primary_hsl?: string
          soporte_whatsapp?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      chat_rh: {
        Row: {
          confidential: boolean
          created_at: string
          folio: string
          id: string
          message: string
          sender: string
          topic: string
          user_id: string
        }
        Insert: {
          confidential?: boolean
          created_at?: string
          folio: string
          id?: string
          message: string
          sender: string
          topic: string
          user_id: string
        }
        Update: {
          confidential?: boolean
          created_at?: string
          folio?: string
          id?: string
          message?: string
          sender?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      checkpoints: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          nombre: string
          obligatorio: boolean
          radius_metros: number
          servicio_id: string
          ubicacion: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nombre: string
          obligatorio?: boolean
          radius_metros?: number
          servicio_id: string
          ubicacion?: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nombre?: string
          obligatorio?: boolean
          radius_metros?: number
          servicio_id?: string
          ubicacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoints_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_reporte_config: {
        Row: {
          cliente_id: string
          created_at: string
          show_alertas: boolean
          show_asistencias: boolean
          show_chart_distribucion_turnos: boolean
          show_chart_rondines_dia: boolean
          show_chart_rondines_servicio: boolean
          show_checkpoints: boolean
          show_comunicados: boolean
          show_cumplimiento_guardia: boolean
          show_emergencias: boolean
          show_export_excel: boolean
          show_export_pdf: boolean
          show_faltas: boolean
          show_horas_extra: boolean
          show_kpi_cumplimiento: boolean
          show_kpi_guardias: boolean
          show_kpi_incidencias: boolean
          show_kpi_rondines: boolean
          show_lista_guardias: boolean
          show_lista_servicios: boolean
          show_metas_servicio: boolean
          show_notas_relevo: boolean
          show_novedades: boolean
          show_novedades_importantes: boolean
          show_pendientes: boolean
          show_pendientes_cumplimiento: boolean
          show_reconocimientos: boolean
          show_reportes_incidencias: boolean
          show_reportes_turno: boolean
          show_rondin_coordenadas: boolean
          show_rondin_fotos: boolean
          show_rondin_puntos: boolean
          show_semaforo: boolean
          show_sesiones: boolean
          show_sesiones_fotos: boolean
          show_sesiones_ubicacion: boolean
          show_turnos_detalle: boolean
          show_validaciones_fotos: boolean
          show_validaciones_puesto: boolean
          show_validaciones_ubicacion: boolean
          show_visitas: boolean
          show_visitas_detalle: boolean
          show_visitas_fotos: boolean
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          show_alertas?: boolean
          show_asistencias?: boolean
          show_chart_distribucion_turnos?: boolean
          show_chart_rondines_dia?: boolean
          show_chart_rondines_servicio?: boolean
          show_checkpoints?: boolean
          show_comunicados?: boolean
          show_cumplimiento_guardia?: boolean
          show_emergencias?: boolean
          show_export_excel?: boolean
          show_export_pdf?: boolean
          show_faltas?: boolean
          show_horas_extra?: boolean
          show_kpi_cumplimiento?: boolean
          show_kpi_guardias?: boolean
          show_kpi_incidencias?: boolean
          show_kpi_rondines?: boolean
          show_lista_guardias?: boolean
          show_lista_servicios?: boolean
          show_metas_servicio?: boolean
          show_notas_relevo?: boolean
          show_novedades?: boolean
          show_novedades_importantes?: boolean
          show_pendientes?: boolean
          show_pendientes_cumplimiento?: boolean
          show_reconocimientos?: boolean
          show_reportes_incidencias?: boolean
          show_reportes_turno?: boolean
          show_rondin_coordenadas?: boolean
          show_rondin_fotos?: boolean
          show_rondin_puntos?: boolean
          show_semaforo?: boolean
          show_sesiones?: boolean
          show_sesiones_fotos?: boolean
          show_sesiones_ubicacion?: boolean
          show_turnos_detalle?: boolean
          show_validaciones_fotos?: boolean
          show_validaciones_puesto?: boolean
          show_validaciones_ubicacion?: boolean
          show_visitas?: boolean
          show_visitas_detalle?: boolean
          show_visitas_fotos?: boolean
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          show_alertas?: boolean
          show_asistencias?: boolean
          show_chart_distribucion_turnos?: boolean
          show_chart_rondines_dia?: boolean
          show_chart_rondines_servicio?: boolean
          show_checkpoints?: boolean
          show_comunicados?: boolean
          show_cumplimiento_guardia?: boolean
          show_emergencias?: boolean
          show_export_excel?: boolean
          show_export_pdf?: boolean
          show_faltas?: boolean
          show_horas_extra?: boolean
          show_kpi_cumplimiento?: boolean
          show_kpi_guardias?: boolean
          show_kpi_incidencias?: boolean
          show_kpi_rondines?: boolean
          show_lista_guardias?: boolean
          show_lista_servicios?: boolean
          show_metas_servicio?: boolean
          show_notas_relevo?: boolean
          show_novedades?: boolean
          show_novedades_importantes?: boolean
          show_pendientes?: boolean
          show_pendientes_cumplimiento?: boolean
          show_reconocimientos?: boolean
          show_reportes_incidencias?: boolean
          show_reportes_turno?: boolean
          show_rondin_coordenadas?: boolean
          show_rondin_fotos?: boolean
          show_rondin_puntos?: boolean
          show_semaforo?: boolean
          show_sesiones?: boolean
          show_sesiones_fotos?: boolean
          show_sesiones_ubicacion?: boolean
          show_turnos_detalle?: boolean
          show_validaciones_fotos?: boolean
          show_validaciones_puesto?: boolean
          show_validaciones_ubicacion?: boolean
          show_visitas?: boolean
          show_visitas_detalle?: boolean
          show_visitas_fotos?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      cliente_reportes: {
        Row: {
          autor_id: string | null
          autor_nombre: string
          cliente_id: string
          created_at: string
          estado: string
          id: string
          periodo_fin: string
          periodo_inicio: string
          publicado_at: string | null
          secciones: Json
          servicio_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          autor_id?: string | null
          autor_nombre?: string
          cliente_id: string
          created_at?: string
          estado?: string
          id?: string
          periodo_fin: string
          periodo_inicio: string
          publicado_at?: string | null
          secciones?: Json
          servicio_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Update: {
          autor_id?: string | null
          autor_nombre?: string
          cliente_id?: string
          created_at?: string
          estado?: string
          id?: string
          periodo_fin?: string
          periodo_inicio?: string
          publicado_at?: string | null
          secciones?: Json
          servicio_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      cliente_servicios: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          id: string
          servicio_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          servicio_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          servicio_id?: string
        }
        Relationships: []
      }
      comunicado_lecturas: {
        Row: {
          comunicado_id: string
          created_at: string
          id: string
          leido_at: string
          user_id: string
        }
        Insert: {
          comunicado_id: string
          created_at?: string
          id?: string
          leido_at?: string
          user_id: string
        }
        Update: {
          comunicado_id?: string
          created_at?: string
          id?: string
          leido_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicado_lecturas_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "comunicados"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicados: {
        Row: {
          autor_id: string | null
          autor_nombre: string
          contenido: string
          created_at: string
          destinatario_id: string | null
          estado: string
          id: string
          imagen_url: string | null
          prioridad: string
          publicado_at: string | null
          publicar_at: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          autor_id?: string | null
          autor_nombre?: string
          contenido: string
          created_at?: string
          destinatario_id?: string | null
          estado?: string
          id?: string
          imagen_url?: string | null
          prioridad?: string
          publicado_at?: string | null
          publicar_at?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          autor_id?: string | null
          autor_nombre?: string
          contenido?: string
          created_at?: string
          destinatario_id?: string | null
          estado?: string
          id?: string
          imagen_url?: string | null
          prioridad?: string
          publicado_at?: string | null
          publicar_at?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      cuadro_honor: {
        Row: {
          created_at: string
          fecha: string
          guardia_id: string
          id: string
          insignias: string[]
          puntos: number
          reportes_completados: number
          reportes_meta: number
          rondines_completados: number
          rondines_meta: number
          servicio_id: string | null
        }
        Insert: {
          created_at?: string
          fecha?: string
          guardia_id: string
          id?: string
          insignias?: string[]
          puntos?: number
          reportes_completados?: number
          reportes_meta?: number
          rondines_completados?: number
          rondines_meta?: number
          servicio_id?: string | null
        }
        Update: {
          created_at?: string
          fecha?: string
          guardia_id?: string
          id?: string
          insignias?: string[]
          puntos?: number
          reportes_completados?: number
          reportes_meta?: number
          rondines_completados?: number
          rondines_meta?: number
          servicio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuadro_honor_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      emergencias: {
        Row: {
          atendida: boolean
          created_at: string
          guardia_id: string
          id: string
          lat: number | null
          lng: number | null
          tipo: string
        }
        Insert: {
          atendida?: boolean
          created_at?: string
          guardia_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          tipo?: string
        }
        Update: {
          atendida?: boolean
          created_at?: string
          guardia_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          tipo?: string
        }
        Relationships: []
      }
      faltas: {
        Row: {
          created_at: string
          detalle: string | null
          fecha: string
          guardia_id: string
          id: string
          motivo: string
          servicio_id: string | null
          tipo_turno_esperado: string | null
        }
        Insert: {
          created_at?: string
          detalle?: string | null
          fecha?: string
          guardia_id: string
          id?: string
          motivo?: string
          servicio_id?: string | null
          tipo_turno_esperado?: string | null
        }
        Update: {
          created_at?: string
          detalle?: string | null
          fecha?: string
          guardia_id?: string
          id?: string
          motivo?: string
          servicio_id?: string | null
          tipo_turno_esperado?: string | null
        }
        Relationships: []
      }
      guardia_servicios: {
        Row: {
          created_at: string
          created_by: string | null
          es_principal: boolean
          guardia_id: string
          id: string
          servicio_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          es_principal?: boolean
          guardia_id: string
          id?: string
          servicio_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          es_principal?: boolean
          guardia_id?: string
          id?: string
          servicio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardia_servicios_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_servicio: {
        Row: {
          created_at: string
          created_by: string | null
          hora_fin: string
          hora_inicio: string
          id: string
          pendientes_diarios: number
          reportes_diarios: number
          rondines_diarios: number
          servicio_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hora_fin?: string
          hora_inicio?: string
          id?: string
          pendientes_diarios?: number
          reportes_diarios?: number
          rondines_diarios?: number
          servicio_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hora_fin?: string
          hora_inicio?: string
          id?: string
          pendientes_diarios?: number
          reportes_diarios?: number
          rondines_diarios?: number
          servicio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: true
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_relevo: {
        Row: {
          autor_id: string
          autor_nombre: string
          created_at: string
          id: string
          importante: boolean
          instrucciones: string
          leida_at: string | null
          leida_por: string | null
          pendientes: string
          servicio_id: string | null
          turno_id: string | null
          updated_at: string
        }
        Insert: {
          autor_id: string
          autor_nombre?: string
          created_at?: string
          id?: string
          importante?: boolean
          instrucciones?: string
          leida_at?: string | null
          leida_por?: string | null
          pendientes?: string
          servicio_id?: string | null
          turno_id?: string | null
          updated_at?: string
        }
        Update: {
          autor_id?: string
          autor_nombre?: string
          created_at?: string
          id?: string
          importante?: boolean
          instrucciones?: string
          leida_at?: string | null
          leida_por?: string | null
          pendientes?: string
          servicio_id?: string | null
          turno_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_relevo_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          created_at: string
          foto_url: string | null
          guardia_id: string
          id: string
          leida: boolean
          mensaje: string
          metadata: Json | null
          supervisor_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          foto_url?: string | null
          guardia_id: string
          id?: string
          leida?: boolean
          mensaje?: string
          metadata?: Json | null
          supervisor_id?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string
          foto_url?: string | null
          guardia_id?: string
          id?: string
          leida?: boolean
          mensaje?: string
          metadata?: Json | null
          supervisor_id?: string | null
          tipo?: string
        }
        Relationships: []
      }
      novedades: {
        Row: {
          alerta_enviada_at: string | null
          created_at: string
          descripcion: string
          foto_url: string | null
          guardia_id: string
          id: string
          importancia: string
          lat: number | null
          lng: number | null
          servicio_id: string | null
          turno_id: string | null
          ubicacion_texto: string | null
          updated_at: string
        }
        Insert: {
          alerta_enviada_at?: string | null
          created_at?: string
          descripcion: string
          foto_url?: string | null
          guardia_id: string
          id?: string
          importancia?: string
          lat?: number | null
          lng?: number | null
          servicio_id?: string | null
          turno_id?: string | null
          ubicacion_texto?: string | null
          updated_at?: string
        }
        Update: {
          alerta_enviada_at?: string | null
          created_at?: string
          descripcion?: string
          foto_url?: string | null
          guardia_id?: string
          id?: string
          importancia?: string
          lat?: number | null
          lng?: number | null
          servicio_id?: string | null
          turno_id?: string | null
          ubicacion_texto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "novedades_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      numeros_emergencia: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          descripcion: string
          id: string
          label: string
          numero: string
          orden: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string
          id?: string
          label: string
          numero: string
          orden?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string
          id?: string
          label?: string
          numero?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      pendientes_completados: {
        Row: {
          created_at: string
          foto_url: string | null
          guardia_id: string
          id: string
          nota: string | null
          pendiente_id: string
          turno_id: string | null
        }
        Insert: {
          created_at?: string
          foto_url?: string | null
          guardia_id: string
          id?: string
          nota?: string | null
          pendiente_id: string
          turno_id?: string | null
        }
        Update: {
          created_at?: string
          foto_url?: string | null
          guardia_id?: string
          id?: string
          nota?: string | null
          pendiente_id?: string
          turno_id?: string | null
        }
        Relationships: []
      }
      pendientes_puesto: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          descripcion: string
          frecuencia: string
          guardia_id: string | null
          horas_intervalo: number | null
          id: string
          prioridad: string
          servicio_id: string
          titulo: string
          updated_at: string
          vigencia_fin: string | null
          vigencia_inicio: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string
          frecuencia?: string
          guardia_id?: string | null
          horas_intervalo?: number | null
          id?: string
          prioridad?: string
          servicio_id: string
          titulo: string
          updated_at?: string
          vigencia_fin?: string | null
          vigencia_inicio?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string
          frecuencia?: string
          guardia_id?: string | null
          horas_intervalo?: number | null
          id?: string
          prioridad?: string
          servicio_id?: string
          titulo?: string
          updated_at?: string
          vigencia_fin?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      prestamo_historial: {
        Row: {
          accion: string
          actor_id: string | null
          actor_nombre: string
          actor_rol: string
          comentario: string | null
          created_at: string
          estado_anterior: string | null
          estado_nuevo: string | null
          id: string
          motivo: string | null
          prestamo_id: string
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_nombre?: string
          actor_rol?: string
          comentario?: string | null
          created_at?: string
          estado_anterior?: string | null
          estado_nuevo?: string | null
          id?: string
          motivo?: string | null
          prestamo_id: string
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_nombre?: string
          actor_rol?: string
          comentario?: string | null
          created_at?: string
          estado_anterior?: string | null
          estado_nuevo?: string | null
          id?: string
          motivo?: string | null
          prestamo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestamo_historial_prestamo_id_fkey"
            columns: ["prestamo_id"]
            isOneToOne: false
            referencedRelation: "prestamos"
            referencedColumns: ["id"]
          },
        ]
      }
      prestamos: {
        Row: {
          aprobado_admin_at: string | null
          aprobado_admin_por: string | null
          aprobado_supervisor_at: string | null
          aprobado_supervisor_por: string | null
          created_at: string
          depositado_at: string | null
          depositado_por: string | null
          estado: string
          folio: string
          guardia_id: string
          id: string
          monto: number
          motivo: string
          observaciones: string
          rechazado_at: string | null
          rechazado_por: string | null
          rechazo_comentario: string | null
          rechazo_motivo: string | null
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          aprobado_admin_at?: string | null
          aprobado_admin_por?: string | null
          aprobado_supervisor_at?: string | null
          aprobado_supervisor_por?: string | null
          created_at?: string
          depositado_at?: string | null
          depositado_por?: string | null
          estado?: string
          folio: string
          guardia_id: string
          id?: string
          monto: number
          motivo?: string
          observaciones?: string
          rechazado_at?: string | null
          rechazado_por?: string | null
          rechazo_comentario?: string | null
          rechazo_motivo?: string | null
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          aprobado_admin_at?: string | null
          aprobado_admin_por?: string | null
          aprobado_supervisor_at?: string | null
          aprobado_supervisor_por?: string | null
          created_at?: string
          depositado_at?: string | null
          depositado_por?: string | null
          estado?: string
          folio?: string
          guardia_id?: string
          id?: string
          monto?: number
          motivo?: string
          observaciones?: string
          rechazado_at?: string | null
          rechazado_por?: string | null
          rechazo_comentario?: string | null
          rechazo_motivo?: string | null
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_session_id: string | null
          apellido: string
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nombre: string
          numero_empleado: string
          servicio_asignado_id: string | null
          status: string
          supervisor_asignado_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_session_id?: string | null
          apellido?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          numero_empleado?: string
          servicio_asignado_id?: string | null
          status?: string
          supervisor_asignado_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_session_id?: string | null
          apellido?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          numero_empleado?: string
          servicio_asignado_id?: string | null
          status?: string
          supervisor_asignado_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_servicio_asignado_id_fkey"
            columns: ["servicio_asignado_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_asignado_id_fkey"
            columns: ["supervisor_asignado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reconocimientos: {
        Row: {
          bono: number
          created_at: string
          created_by: string | null
          guardia_id: string
          id: string
          motivo: string
          periodo: string
          posicion: number
          publicado: boolean
          publicado_at: string | null
          updated_at: string
        }
        Insert: {
          bono?: number
          created_at?: string
          created_by?: string | null
          guardia_id: string
          id?: string
          motivo: string
          periodo: string
          posicion?: number
          publicado?: boolean
          publicado_at?: string | null
          updated_at?: string
        }
        Update: {
          bono?: number
          created_at?: string
          created_by?: string | null
          guardia_id?: string
          id?: string
          motivo?: string
          periodo?: string
          posicion?: number
          publicado?: boolean
          publicado_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registration_nips: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string
          role: Database["public"]["Enums"]["app_role"]
          used: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string
          role: Database["public"]["Enums"]["app_role"]
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string
          role?: Database["public"]["Enums"]["app_role"]
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      registros_rh: {
        Row: {
          created_at: string
          created_by: string
          fecha: string
          fecha_fin: string | null
          guardia_id: string
          id: string
          monto: number | null
          nota: string | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by: string
          fecha?: string
          fecha_fin?: string | null
          guardia_id: string
          id?: string
          monto?: number | null
          nota?: string | null
          status?: string
          tipo: string
        }
        Update: {
          created_at?: string
          created_by?: string
          fecha?: string
          fecha_fin?: string | null
          guardia_id?: string
          id?: string
          monto?: number | null
          nota?: string | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      reportes_turno: {
        Row: {
          actividades: string
          created_at: string
          firmado: boolean
          guardia_id: string
          id: string
          incidencias: string
          observaciones: string
          retroalimentacion: string | null
          revisado_por: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actividades?: string
          created_at?: string
          firmado?: boolean
          guardia_id: string
          id?: string
          incidencias?: string
          observaciones?: string
          retroalimentacion?: string | null
          revisado_por?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actividades?: string
          created_at?: string
          firmado?: boolean
          guardia_id?: string
          id?: string
          incidencias?: string
          observaciones?: string
          retroalimentacion?: string | null
          revisado_por?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rondin_alarmas: {
        Row: {
          created_at: string
          cumplido: boolean
          delay_seconds: number | null
          falta_generada: boolean
          guardia_id: string
          id: string
          notified_at: string | null
          responded_at: string | null
          scheduled_at: string
          servicio_id: string
          turno_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cumplido?: boolean
          delay_seconds?: number | null
          falta_generada?: boolean
          guardia_id: string
          id?: string
          notified_at?: string | null
          responded_at?: string | null
          scheduled_at: string
          servicio_id: string
          turno_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cumplido?: boolean
          delay_seconds?: number | null
          falta_generada?: boolean
          guardia_id?: string
          id?: string
          notified_at?: string | null
          responded_at?: string | null
          scheduled_at?: string
          servicio_id?: string
          turno_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rondin_alarmas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      rondin_scans: {
        Row: {
          checkpoint_id: string
          estado: string
          foto_url: string | null
          id: string
          lat: number | null
          lng: number | null
          observacion: string
          rondin_id: string
          scanned_at: string
        }
        Insert: {
          checkpoint_id: string
          estado?: string
          foto_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          observacion?: string
          rondin_id: string
          scanned_at?: string
        }
        Update: {
          checkpoint_id?: string
          estado?: string
          foto_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          observacion?: string
          rondin_id?: string
          scanned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rondin_scans_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rondin_scans_rondin_id_fkey"
            columns: ["rondin_id"]
            isOneToOne: false
            referencedRelation: "rondines"
            referencedColumns: ["id"]
          },
        ]
      }
      rondines: {
        Row: {
          checkin_at: string | null
          checkin_lat: number | null
          checkin_lng: number | null
          checkout_at: string | null
          created_at: string
          guardia_id: string
          id: string
          reporte: string | null
          servicio_id: string | null
          status: string
        }
        Insert: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_at?: string | null
          created_at?: string
          guardia_id: string
          id?: string
          reporte?: string | null
          servicio_id?: string | null
          status?: string
        }
        Update: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_at?: string | null
          created_at?: string
          guardia_id?: string
          id?: string
          reporte?: string | null
          servicio_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rondines_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios: {
        Row: {
          cliente: string
          created_at: string
          created_by: string | null
          direccion: string
          id: string
          nombre: string
          permitir_rondin_incompleto: boolean
          rondin_intervalo_minutos: number | null
          rondin_tolerancia_minutos: number
          tipo_turno: string
          updated_at: string
        }
        Insert: {
          cliente?: string
          created_at?: string
          created_by?: string | null
          direccion?: string
          id?: string
          nombre: string
          permitir_rondin_incompleto?: boolean
          rondin_intervalo_minutos?: number | null
          rondin_tolerancia_minutos?: number
          tipo_turno?: string
          updated_at?: string
        }
        Update: {
          cliente?: string
          created_at?: string
          created_by?: string | null
          direccion?: string
          id?: string
          nombre?: string
          permitir_rondin_incompleto?: boolean
          rondin_intervalo_minutos?: number | null
          rondin_tolerancia_minutos?: number
          tipo_turno?: string
          updated_at?: string
        }
        Relationships: []
      }
      sesion_registros: {
        Row: {
          created_at: string
          dispositivo: Json | null
          evento: string
          foto_url: string | null
          id: string
          lat: number | null
          lng: number | null
          precision_metros: number | null
          ubicacion_error: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dispositivo?: Json | null
          evento: string
          foto_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          precision_metros?: number | null
          ubicacion_error?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dispositivo?: Json | null
          evento?: string
          foto_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          precision_metros?: number | null
          ubicacion_error?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      turnos: {
        Row: {
          comentario_cambio: string | null
          created_at: string
          fin: string | null
          guardia_entrante: string | null
          guardia_id: string
          id: string
          inicio: string
          servicio_id: string | null
          status: string
        }
        Insert: {
          comentario_cambio?: string | null
          created_at?: string
          fin?: string | null
          guardia_entrante?: string | null
          guardia_id: string
          id?: string
          inicio?: string
          servicio_id?: string | null
          status?: string
        }
        Update: {
          comentario_cambio?: string | null
          created_at?: string
          fin?: string | null
          guardia_entrante?: string | null
          guardia_id?: string
          id?: string
          inicio?: string
          servicio_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "turnos_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      validacion_puesto_config: {
        Row: {
          activo: boolean
          checkpoint_id: string | null
          created_at: string
          created_by: string | null
          dias: number[]
          guardia_ids: string[]
          horarios: string[]
          id: string
          nombre: string
          radio_metros: number
          servicio_id: string
          tolerancia_minutos: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          checkpoint_id?: string | null
          created_at?: string
          created_by?: string | null
          dias?: number[]
          guardia_ids?: string[]
          horarios?: string[]
          id?: string
          nombre?: string
          radio_metros?: number
          servicio_id: string
          tolerancia_minutos?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          checkpoint_id?: string | null
          created_at?: string
          created_by?: string | null
          dias?: number[]
          guardia_ids?: string[]
          horarios?: string[]
          id?: string
          nombre?: string
          radio_metros?: number
          servicio_id?: string
          tolerancia_minutos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "validacion_puesto_config_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validacion_puesto_config_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      validaciones_puesto: {
        Row: {
          checkpoint_id: string | null
          config_id: string | null
          created_at: string
          dentro_area: boolean
          dispositivo: Json | null
          distancia_metros: number | null
          foto_url: string | null
          guardia_id: string
          id: string
          lat: number | null
          lng: number | null
          precision_metros: number | null
          programado_at: string
          respondido_at: string
          resultado: string
          servicio_id: string | null
          ubicacion_error: string | null
        }
        Insert: {
          checkpoint_id?: string | null
          config_id?: string | null
          created_at?: string
          dentro_area?: boolean
          dispositivo?: Json | null
          distancia_metros?: number | null
          foto_url?: string | null
          guardia_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          precision_metros?: number | null
          programado_at: string
          respondido_at?: string
          resultado?: string
          servicio_id?: string | null
          ubicacion_error?: string | null
        }
        Update: {
          checkpoint_id?: string | null
          config_id?: string | null
          created_at?: string
          dentro_area?: boolean
          dispositivo?: Json | null
          distancia_metros?: number | null
          foto_url?: string | null
          guardia_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          precision_metros?: number | null
          programado_at?: string
          respondido_at?: string
          resultado?: string
          servicio_id?: string | null
          ubicacion_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validaciones_puesto_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validaciones_puesto_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "validacion_puesto_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validaciones_puesto_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          area_destino: string
          created_at: string
          foto_ine_url: string | null
          foto_placa_url: string | null
          foto_salida_url: string | null
          guardia_id: string
          hora_entrada: string
          hora_salida: string | null
          id: string
          motivo: string
          nombre_visitante: string
          persona_a_visitar: string
          servicio_id: string | null
          status: string
        }
        Insert: {
          area_destino?: string
          created_at?: string
          foto_ine_url?: string | null
          foto_placa_url?: string | null
          foto_salida_url?: string | null
          guardia_id: string
          hora_entrada?: string
          hora_salida?: string | null
          id?: string
          motivo?: string
          nombre_visitante: string
          persona_a_visitar?: string
          servicio_id?: string | null
          status?: string
        }
        Update: {
          area_destino?: string
          created_at?: string
          foto_ine_url?: string | null
          foto_placa_url?: string | null
          foto_salida_url?: string | null
          guardia_id?: string
          hora_entrada?: string
          hora_salida?: string | null
          id?: string
          motivo?: string
          nombre_visitante?: string
          persona_a_visitar?: string
          servicio_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cliente_has_guardia: {
        Args: { _cliente_id: string; _guardia_id: string }
        Returns: boolean
      }
      cliente_has_servicio: {
        Args: { _servicio_id: string; _user_id: string }
        Returns: boolean
      }
      consume_registration_nip: {
        Args: { _code: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      cumplimiento_metas_guardia: {
        Args: { _dias?: number; _guardia_id: string }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      es_ausencia_justificada: {
        Args: { _fecha: string; _guardia_id: string }
        Returns: boolean
      }
      get_assigned_supervisor: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      guardia_has_servicio: {
        Args: { _servicio_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          _accion: string
          _datos?: Json
          _dispositivo?: Json
          _registro_id?: string
          _tabla: string
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notificar_comunicado: { Args: { _id: string }; Returns: undefined }
      prestamo_aprobar_admin: {
        Args: { _comentario?: string; _id: string }
        Returns: undefined
      }
      prestamo_aprobar_supervisor: {
        Args: { _comentario?: string; _id: string }
        Returns: undefined
      }
      prestamo_comunicado_privado: {
        Args: {
          _dest: string
          _mensaje: string
          _prioridad: string
          _titulo: string
        }
        Returns: undefined
      }
      prestamo_confirmar_deposito: {
        Args: { _comentario?: string; _id: string }
        Returns: undefined
      }
      prestamo_crear: {
        Args: { _monto: number; _motivo: string; _observaciones: string }
        Returns: string
      }
      prestamo_log: {
        Args: {
          _accion: string
          _antes: string
          _comentario: string
          _despues: string
          _motivo: string
          _prestamo_id: string
        }
        Returns: undefined
      }
      prestamo_nombre: { Args: { _user_id: string }; Returns: string }
      prestamo_rechazar: {
        Args: { _comentario?: string; _id: string; _motivo: string }
        Returns: undefined
      }
      promote_user: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
      publicar_comunicado: { Args: { _id: string }; Returns: undefined }
      publicar_comunicados_programados: { Args: never; Returns: number }
      publicar_reconocimiento: { Args: { _id: string }; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      validate_registration_nip: {
        Args: { _code: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "guardia" | "supervisor" | "admin" | "cliente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["guardia", "supervisor", "admin", "cliente"],
    },
  },
} as const
