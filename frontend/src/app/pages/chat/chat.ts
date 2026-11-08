import { Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, mensajeError } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Conversacion, Mensaje } from '../../core/models';
import { Toasts } from '../../core/toast.service';
import { Avatar, HacePipe, OficioBadge } from '../../shared/ui';

@Component({
  selector: 'app-chat',
  imports: [FormsModule, RouterLink, Avatar, OficioBadge, HacePipe],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements OnInit, OnDestroy {
  private api = inject(Api);
  private auth = inject(Auth);
  private toasts = inject(Toasts);
  id = input<string>();

  base = computed(() => (this.auth.esPro() ? '/pro/chats' : '/app/chats'));
  convs = signal<Conversacion[]>([]);
  cargandoLista = signal(true);
  mensajes = signal<Mensaje[]>([]);
  cargandoMsgs = signal(false);
  texto = '';
  adjunto = signal<File | null>(null);
  adjuntoUrl = signal<string | null>(null);
  enviando = signal(false);
  actual = computed(() => this.convs().find(c => c.id === Number(this.id())) ?? null);
  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private tLista?: ReturnType<typeof setInterval>;
  private tMsgs?: ReturnType<typeof setInterval>;

  constructor() {
    // Sólo depende del id de la ruta; el resto se lee sin registrar dependencias.
    effect(() => {
      const id = this.id();
      untracked(() => {
        clearInterval(this.tMsgs);
        this.mensajes.set([]);
        if (id) {
          this.cargandoMsgs.set(true);
          this.traer(true);
          this.tMsgs = setInterval(() => this.traer(), 3000);
        }
      });
    });
  }

  ngOnInit() {
    this.cargarLista();
    this.tLista = setInterval(() => this.cargarLista(), 10000);
  }

  ngOnDestroy() {
    clearInterval(this.tLista);
    clearInterval(this.tMsgs);
    this.quitarAdjunto();
  }

  cargarLista() {
    this.api.conversaciones().subscribe({
      next: c => { this.convs.set(c); this.cargandoLista.set(false); },
      error: () => this.cargandoLista.set(false),
    });
  }

  private traer(inicial = false) {
    const id = Number(this.id());
    if (!id) return;
    const ultimo = this.mensajes().at(-1)?.id;
    this.api.mensajes(id, inicial ? undefined : ultimo).subscribe({
      next: nuevos => {
        this.cargandoMsgs.set(false);
        if (!nuevos.length) return;
        this.mensajes.update(l => (inicial ? nuevos : [...l, ...nuevos.filter(n => !l.some(m => m.id === n.id))]));
        this.bajar();
        if (inicial) this.convs.update(cs => cs.map(c => (c.id === id ? { ...c, no_leidos: 0 } : c)));
      },
      error: e => { this.cargandoMsgs.set(false); if (inicial) this.toasts.error(mensajeError(e)); },
    });
  }

  private bajar() {
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  elegirAdjunto(ev: Event) {
    const inp = ev.target as HTMLInputElement;
    const f = inp.files?.[0];
    inp.value = '';
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { this.toasts.error('El archivo supera los 50 MB.'); return; }
    this.quitarAdjunto();
    this.adjunto.set(f);
    this.adjuntoUrl.set(URL.createObjectURL(f));
  }

  quitarAdjunto() {
    if (this.adjuntoUrl()) URL.revokeObjectURL(this.adjuntoUrl()!);
    this.adjunto.set(null);
    this.adjuntoUrl.set(null);
  }

  tecla(ev: KeyboardEvent) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.enviar();
    }
  }

  enviar() {
    const id = Number(this.id());
    const t = this.texto.trim();
    if (!id || (!t && !this.adjunto()) || this.enviando()) return;
    const fd = new FormData();
    fd.append('texto', t);
    if (this.adjunto()) fd.append('adjunto', this.adjunto()!);
    this.enviando.set(true);
    this.api.enviarMensaje(id, fd).subscribe({
      next: m => {
        this.enviando.set(false);
        this.texto = '';
        this.quitarAdjunto();
        this.mensajes.update(l => [...l, m]);
        this.bajar();
      },
      error: e => { this.enviando.set(false); this.toasts.error(mensajeError(e)); },
    });
  }

  hora(m: Mensaje) { return new Date(m.fecha_envio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); }
  dia(m: Mensaje, i: number) {
    const d = new Date(m.fecha_envio).toDateString();
    const prev = i > 0 ? new Date(this.mensajes()[i - 1].fecha_envio).toDateString() : '';
    if (d === prev) return '';
    const hoy = new Date().toDateString();
    return d === hoy ? 'Hoy' : new Date(m.fecha_envio).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  linkPedido(c: Conversacion) { return this.auth.esPro() ? ['/pro/trabajos', c.solicitud_id] : ['/app/pedidos', c.solicitud_id]; }
}
