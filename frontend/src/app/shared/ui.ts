import {
  Component, ElementRef, HostListener, OnDestroy, OnInit, Pipe, PipeTransform, computed, effect,
  inject, input, output, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { OficioSlug } from '../core/models';
import { OFICIOS } from '../core/oficios';
import { Theme } from '../core/theme.service';

/* ------------------------------------------------------------------ Logo */
@Component({
  selector: 'app-logo',
  imports: [RouterLink],
  template: `
    <a [routerLink]="link()" class="ofx-logo" [class.ofx-logo-lg]="grande()" [class.ofx-logo-claro]="claro()" aria-label="Ofix, ir al inicio">
      <img src="logo-64.png" alt="" class="icono" width="64" height="64" />ofix<span class="punto">.</span>
    </a>`,
  styles: `
    .ofx-logo {
      display: inline-flex; align-items: baseline; text-decoration: none; color: var(--ofx-ink);
      font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 1.5rem; letter-spacing: -.04em; line-height: 1;
    }
    .ofx-logo:hover { color: var(--ofx-ink); }
    .icono { width: 1.25em; height: 1.25em; margin-right: .3rem; align-self: center; object-fit: contain; }
    .punto { color: var(--ofx-orange); }
    .ofx-logo-lg { font-size: 2rem; }
    .ofx-logo-claro, .ofx-logo-claro:hover { color: #fff; }
  `,
})
export class Logo {
  /** El logo es el botón de inicio: lleva al inicio del perfil que corresponda. */
  link = input<string>('/');
  grande = input(false);
  claro = input(false);
}

/* ------------------------------------------------------------------ Avatar */
@Component({
  selector: 'app-avatar',
  template: `
    @if (foto()) {
      <img class="avatar" [src]="foto()" [alt]="'Foto de ' + nombre()" [style.width.px]="size()" [style.height.px]="size()" />
    } @else {
      <span class="avatar" aria-hidden="true" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.4">{{ iniciales() }}</span>
    }`,
})
export class Avatar {
  foto = input<string | null | undefined>(null);
  nombre = input<string>('');
  size = input(36);
  iniciales = computed(() => this.nombre().split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase());
}

/* ------------------------------------------------------------------ Estrellas */
@Component({
  selector: 'app-stars',
  template: `
    @if (valor() > 0) {
      <span class="stars" [attr.aria-label]="valor().toFixed(1) + ' de 5 estrellas'">
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <i class="bi" [class.bi-star-fill]="valor() >= i - 0.25" [class.bi-star-half]="valor() < i - 0.25 && valor() >= i - 0.75" [class.bi-star]="valor() < i - 0.75"></i>
        }
      </span>
      @if (mostrarNumero()) { <span class="ofx-num ms-1">{{ valor().toFixed(1) }}</span> }
    } @else {
      <span class="chip chip-blue">Nuevo en Ofix</span>
    }`,
})
export class Stars {
  valor = input(0);
  mostrarNumero = input(true);
}

/* ------------------------------------------------------------------ Badge de oficio */
@Component({
  selector: 'app-oficio',
  template: `<span class="oficio-badge" [class]="'oficio-' + slug()"><i class="bi" [class]="meta().icono"></i>{{ texto() || meta().nombre }}</span>`,
})
export class OficioBadge {
  slug = input.required<OficioSlug>();
  texto = input<string>('');
  meta = computed(() => OFICIOS[this.slug()] ?? OFICIOS.plomero);
}

/* ------------------------------------------------------------------ Tema claro/oscuro */
@Component({
  selector: 'app-theme-toggle',
  template: `
    <button type="button" class="btn-icon" (click)="theme.alternar()"
            [attr.aria-label]="theme.oscuro() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
            [title]="theme.oscuro() ? 'Modo claro' : 'Modo oscuro'">
      <i class="bi" [class.bi-sun]="theme.oscuro()" [class.bi-moon-stars]="!theme.oscuro()"></i>
    </button>`,
})
export class ThemeToggle {
  theme = inject(Theme);
}

/* ------------------------------------------------------------------ Cuenta regresiva */
@Component({
  selector: 'app-countdown',
  template: `<span class="ofx-num">{{ texto() }}</span>`,
})
export class Countdown implements OnInit, OnDestroy {
  hasta = input.required<string>();
  vencido = output<void>();
  private ahora = signal(Date.now());
  private t?: ReturnType<typeof setInterval>;
  private avisado = false;
  restante = computed(() => Math.max(0, new Date(this.hasta()).getTime() - this.ahora()));
  texto = computed(() => {
    const s = Math.ceil(this.restante() / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  constructor() {
    effect(() => {
      if (this.restante() === 0 && !this.avisado) {
        this.avisado = true;
        this.vencido.emit();
      }
    });
  }
  ngOnInit() { this.t = setInterval(() => this.ahora.set(Date.now()), 1000); }
  ngOnDestroy() { clearInterval(this.t); }
}

/* ------------------------------------------------------------------ Selector de fotos y videos */
export interface ArchivoLocal { file: File; url: string; tipo: 'imagen' | 'video' | 'archivo'; }

@Component({
  selector: 'app-media-picker',
  template: `
    <label class="dropzone position-relative" [class.over]="over()"
           (dragover)="$event.preventDefault(); over.set(true)" (dragleave)="over.set(false)" (drop)="soltar($event)">
      <input type="file" [accept]="accept()" multiple (change)="elegir($event)" />
      <i class="bi bi-cloud-arrow-up fs-4 d-block mb-1"></i>
      <span class="fw-semibold">{{ etiqueta() }}</span>
      <span class="d-block ofx-faint">{{ ayuda() }}</span>
    </label>
    @if (archivos().length) {
      <div class="thumb-grid mt-2">
        @for (a of archivos(); track a.url; let i = $index) {
          <div class="thumb">
            @if (a.tipo === 'imagen') { <img [src]="a.url" [alt]="a.file.name" /> }
            @else if (a.tipo === 'video') { <video [src]="a.url" muted></video><i class="bi bi-play-circle-fill position-absolute top-50 start-50 translate-middle text-white fs-3"></i> }
            @else { <div class="h-100 d-grid place-items-center p-2 text-center small"><i class="bi bi-file-earmark-pdf fs-2 d-block"></i>{{ a.file.name }}</div> }
            <button type="button" class="thumb-x" (click)="quitar(i)" [attr.aria-label]="'Quitar ' + a.file.name"><i class="bi bi-x-lg"></i></button>
          </div>
        }
      </div>
    }`,
})
export class MediaPicker implements OnDestroy {
  accept = input('image/*,video/*');
  etiqueta = input('Agregar fotos o videos');
  ayuda = input('Arrastralos acá o tocá para elegir. Hasta 10 archivos.');
  max = input(10);
  cambio = output<File[]>();
  archivos = signal<ArchivoLocal[]>([]);
  over = signal(false);

  elegir(ev: Event) {
    const inp = ev.target as HTMLInputElement;
    this.agregar(Array.from(inp.files ?? []));
    inp.value = '';
  }
  soltar(ev: DragEvent) {
    ev.preventDefault();
    this.over.set(false);
    this.agregar(Array.from(ev.dataTransfer?.files ?? []));
  }
  private agregar(files: File[]) {
    const nuevos = files.map(file => ({
      file, url: URL.createObjectURL(file),
      tipo: (file.type.startsWith('image/') ? 'imagen' : file.type.startsWith('video/') ? 'video' : 'archivo') as ArchivoLocal['tipo'],
    }));
    this.archivos.update(l => [...l, ...nuevos].slice(0, this.max()));
    this.emitir();
  }
  quitar(i: number) {
    URL.revokeObjectURL(this.archivos()[i].url);
    this.archivos.update(l => l.filter((_, j) => j !== i));
    this.emitir();
  }
  limpiar() { this.archivos().forEach(a => URL.revokeObjectURL(a.url)); this.archivos.set([]); this.emitir(); }
  private emitir() { this.cambio.emit(this.archivos().map(a => a.file)); }
  ngOnDestroy() { this.archivos().forEach(a => URL.revokeObjectURL(a.url)); }
}

/* ------------------------------------------------------------------ Galería de adjuntos (lectura) */
@Component({
  selector: 'app-galeria',
  template: `
    <div class="thumb-grid">
      @for (a of items(); track a.url) {
        <a class="thumb" [href]="a.url" target="_blank" rel="noopener">
          @if (a.tipo === 'video') { <video [src]="a.url" muted preload="metadata"></video><i class="bi bi-play-circle-fill position-absolute top-50 start-50 translate-middle text-white fs-3"></i> }
          @else { <img [src]="a.url" alt="Foto adjunta" loading="lazy" /> }
        </a>
      }
    </div>`,
})
export class Galeria {
  items = input<{ url: string; tipo: string }[]>([]);
}

/* ------------------------------------------------------------------ Cerrar al hacer clic afuera */
@Component({ selector: 'app-click-outside', template: '<ng-content />' })
export class ClickOutside {
  private el = inject(ElementRef);
  afuera = output<void>();
  @HostListener('document:click', ['$event'])
  onClick(ev: MouseEvent) { if (!this.el.nativeElement.contains(ev.target)) this.afuera.emit(); }
  @HostListener('document:keydown.escape')
  onEsc() { this.afuera.emit(); }
}

/* ------------------------------------------------------------------ Pipes */
@Pipe({ name: 'hace' })
export class HacePipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    if (!v) return '';
    const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
    if (s < 60) return 'recién';
    const m = Math.round(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    if (d < 7) return d === 1 ? 'ayer' : `hace ${d} días`;
    return new Date(v).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }
}

@Pipe({ name: 'km' })
export class KmPipe implements PipeTransform {
  transform(v: number | null | undefined): string {
    if (v === null || v === undefined) return 'Distancia sin calcular';
    return v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1).replace('.', ',')} km`;
  }
}

@Pipe({ name: 'fecha' })
export class FechaPipe implements PipeTransform {
  transform(v: string | null | undefined, conHora = true): string {
    if (!v) return '';
    return new Date(v).toLocaleString('es-AR', conHora
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
