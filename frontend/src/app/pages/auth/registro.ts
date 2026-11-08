import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { concat, firstValueFrom, toArray } from 'rxjs';
import { Api, erroresCampo, mensajeError } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Horario, Oficio, OficioSlug, Rol } from '../../core/models';
import { DIAS, OFICIOS, PROVINCIAS } from '../../core/oficios';
import { Toasts } from '../../core/toast.service';
import { AuthShell } from '../../shared/auth-shell';
import { MediaPicker } from '../../shared/ui';

const PASOS_CLIENTE = ['Tipo de cuenta', 'Email y contraseña', 'Tus datos'];
const PASOS_PRO = [...PASOS_CLIENTE, 'Oficios', 'Cobertura y horarios', 'Certificaciones'];

interface Franja { activo: boolean; desde: string; hasta: string; }

@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink, AuthShell, MediaPicker],
  templateUrl: './registro.html',
  styleUrl: './registro.scss',
})
export class Registro implements OnInit, OnDestroy {
  private api = inject(Api);
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toasts = inject(Toasts);

  provincias = PROVINCIAS;
  dias = DIAS;
  meta = OFICIOS;

  rol = signal<Rol | null>(null);
  paso = signal(0);
  listo = signal(false);
  cargando = signal(false);
  errores = signal<Record<string, string>>({});
  pasos = computed(() => (this.rol() === 'PROFESIONAL' ? PASOS_PRO : PASOS_CLIENTE));

  // paso 2
  email = '';
  password = '';
  password2 = '';
  verPass = signal(false);

  // paso 3
  foto: File | null = null;
  fotoUrl = signal<string | null>(null);
  nombre = '';
  apellido = '';
  ciudad = '';
  provincia = '';
  telefono = '';
  dni = '';
  calle = '';
  numero = '';
  departamento = '';
  lat: number | null = null;
  lng: number | null = null;
  ubicando = signal(false);

  // paso 4
  oficios = signal<Oficio[]>([]);
  elegidos = signal<Record<number, number | null>>({}); // oficioId -> años

  // paso 5
  radio = 15;
  franjas: Franja[] = DIAS.map((_, i) => ({ activo: i < 5, desde: '08:00', hasta: '18:00' }));

  // paso 6
  certificados: File[] = [];

  ngOnInit() {
    if (this.route.snapshot.url.some(s => s.path === 'profesional')) {
      // Cuenta creada: continúa con los datos profesionales.
      this.rol.set('PROFESIONAL');
      this.paso.set(3);
      this.cargarOficios();
    } else if (this.route.snapshot.queryParamMap.get('rol') === 'profesional') {
      this.rol.set('PROFESIONAL');
    } else if (this.route.snapshot.queryParamMap.get('rol') === 'cliente') {
      this.rol.set('CLIENTE');
    }
  }

  ngOnDestroy() { if (this.fotoUrl()) URL.revokeObjectURL(this.fotoUrl()!); }

  err(campo: string) { return this.errores()[campo]; }

  elegirRol(r: Rol) {
    this.rol.set(r);
    this.paso.set(1);
  }

  atras() {
    this.errores.set({});
    if (this.paso() > 0 && this.paso() !== 3) this.paso.update(p => p - 1);
  }

  // ---------------------------------------------------------- paso 2
  async siguienteCuenta() {
    const e: Record<string, string> = {};
    const email = this.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e['email'] = 'Ingresá un email válido, por ejemplo nombre@mail.com.';
    if (this.password.length < 8) e['password'] = 'Usá al menos 8 caracteres.';
    else if (/^\d+$/.test(this.password)) e['password'] = 'La contraseña no puede ser sólo números.';
    if (this.password2 !== this.password) e['password2'] = 'Las contraseñas no coinciden.';
    this.errores.set(e);
    if (Object.keys(e).length) return;
    this.cargando.set(true);
    try {
      const r = await firstValueFrom(this.api.emailDisponible(email));
      if (!r.disponible) {
        this.errores.set({ email: 'Ya existe una cuenta con este email.' });
        return;
      }
      this.paso.set(2);
    } catch (err) {
      this.toasts.error(mensajeError(err));
    } finally {
      this.cargando.set(false);
    }
  }

  // ---------------------------------------------------------- paso 3
  elegirFoto(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      this.errores.set({ ...this.errores(), foto: 'Elegí una imagen (JPG o PNG).' });
      return;
    }
    if (this.fotoUrl()) URL.revokeObjectURL(this.fotoUrl()!);
    this.foto = f;
    this.fotoUrl.set(URL.createObjectURL(f));
  }

  quitarFoto() {
    if (this.fotoUrl()) URL.revokeObjectURL(this.fotoUrl()!);
    this.foto = null;
    this.fotoUrl.set(null);
  }

  usarUbicacion() {
    if (!navigator.geolocation) {
      this.toasts.error('Tu navegador no permite compartir la ubicación.');
      return;
    }
    this.ubicando.set(true);
    navigator.geolocation.getCurrentPosition(
      p => { this.lat = p.coords.latitude; this.lng = p.coords.longitude; this.ubicando.set(false); this.toasts.ok('Ubicación guardada para calcular distancias.'); },
      () => { this.ubicando.set(false); this.toasts.error('No pudimos obtener tu ubicación. Usaremos la dirección escrita.'); },
      { timeout: 10000 },
    );
  }

  crearCuenta() {
    const esPro = this.rol() === 'PROFESIONAL';
    const e: Record<string, string> = {};
    if (!this.nombre.trim()) e['nombre'] = 'Ingresá tu nombre.';
    if (!this.apellido.trim()) e['apellido'] = 'Ingresá tu apellido.';
    if (!this.ciudad.trim()) e['ciudad'] = 'Ingresá tu ciudad.';
    if (!this.provincia) e['provincia'] = 'Elegí tu provincia.';
    if (!/^[\d\s+()-]{6,}$/.test(this.telefono.trim())) e['telefono'] = 'Ingresá un teléfono con código de área.';
    if (esPro && !/^\d{7,9}$/.test(this.dni.replace(/\./g, '').trim())) e['dni'] = 'Ingresá tu DNI sin puntos (7 u 8 números).';
    const conDireccion = esPro || this.calle.trim() || this.numero.trim();
    if (conDireccion) {
      if (!this.calle.trim()) e['calle'] = 'Ingresá la calle.';
      if (!this.numero.trim()) e['numero'] = 'Ingresá el número.';
    }
    this.errores.set(e);
    if (Object.keys(e).length) return;

    const fd = new FormData();
    const campos: Record<string, string> = {
      rol: this.rol()!, email: this.email.trim().toLowerCase(), password: this.password,
      nombre: this.nombre.trim(), apellido: this.apellido.trim(), ciudad: this.ciudad.trim(),
      provincia: this.provincia, telefono: this.telefono.trim(), dni: esPro ? this.dni.replace(/\./g, '').trim() : '',
      calle: this.calle.trim(), numero: this.numero.trim(), departamento: this.departamento.trim(),
    };
    Object.entries(campos).forEach(([k, v]) => fd.append(k, v));
    if (this.lat !== null && this.lng !== null) {
      fd.append('latitud', String(this.lat));
      fd.append('longitud', String(this.lng));
    }
    if (this.foto) fd.append('foto', this.foto);

    this.cargando.set(true);
    this.api.registro(fd).subscribe({
      next: s => {
        this.auth.guardar(s);
        this.cargando.set(false);
        if (esPro) {
          this.paso.set(3);
          this.cargarOficios();
          // la URL refleja que la cuenta ya existe (si recarga, sigue desde acá)
          this.router.navigate(['/registro/profesional'], { replaceUrl: true });
        } else {
          this.listo.set(true);
        }
      },
      error: err => {
        this.cargando.set(false);
        const ec = erroresCampo(err);
        this.errores.set(ec);
        if (ec['email'] || ec['password']) this.paso.set(1);
        this.toasts.error(mensajeError(err, 'Revisá los datos marcados.'));
      },
    });
  }

  // ---------------------------------------------------------- paso 4
  cargarOficios() {
    this.api.oficios().subscribe({ next: o => this.oficios.set(o), error: e => this.toasts.error(mensajeError(e)) });
    this.api.proYo().subscribe({
      next: p => {
        const m: Record<number, number | null> = {};
        p.experiencias.forEach(x => (m[x.oficio] = x.anios_experiencia));
        if (Object.keys(m).length) this.elegidos.set(m);
        if (p.radio_cobertura_km) this.radio = p.radio_cobertura_km;
        if (p.horarios?.length) {
          this.franjas = DIAS.map((_, i) => {
            const h = p.horarios.find(x => x.dia === i);
            return h ? { activo: true, desde: h.desde, hasta: h.hasta } : { activo: false, desde: '08:00', hasta: '18:00' };
          });
        }
      },
      error: () => {},
    });
  }

  slug(o: Oficio): OficioSlug { return (o.slug || 'plomero') as OficioSlug; }
  estaElegido(id: number) { return id in this.elegidos(); }
  alternarOficio(id: number) {
    const m = { ...this.elegidos() };
    if (id in m) delete m[id];
    else m[id] = null;
    this.elegidos.set(m);
  }
  setAnios(id: number, v: number | null) { this.elegidos.set({ ...this.elegidos(), [id]: v }); }

  guardarOficios() {
    const m = this.elegidos();
    const ids = Object.keys(m).map(Number);
    const e: Record<string, string> = {};
    if (!ids.length) e['oficios'] = 'Elegí al menos un oficio.';
    ids.forEach(id => {
      const v = m[id];
      if (v === null || v === undefined || isNaN(v as number) || (v as number) < 0 || (v as number) > 70) e['anios_' + id] = 'Ingresá los años (0 a 70).';
    });
    this.errores.set(e);
    if (Object.keys(e).length) return;
    this.cargando.set(true);
    this.api.proActualizar({ experiencias: ids.map(id => ({ oficio: id, anios_experiencia: m[id] })) }).subscribe({
      next: () => { this.cargando.set(false); this.paso.set(4); },
      error: err => { this.cargando.set(false); this.toasts.error(mensajeError(err)); },
    });
  }

  // ---------------------------------------------------------- paso 5
  presetSemana() {
    this.franjas = DIAS.map((_, i) => ({ activo: i < 5, desde: '08:00', hasta: '18:00' }));
  }
  presetSiempre() {
    this.franjas = DIAS.map(() => ({ activo: true, desde: '00:00', hasta: '23:59' }));
  }

  horarios(): Horario[] {
    return this.franjas.map((f, dia) => ({ ...f, dia })).filter(f => f.activo).map(({ dia, desde, hasta }) => ({ dia, desde, hasta }));
  }

  guardarCobertura() {
    const e: Record<string, string> = {};
    const hs = this.horarios();
    if (!hs.length) e['horarios'] = 'Marcá al menos un día de atención.';
    this.franjas.forEach((f, i) => { if (f.activo && f.desde >= f.hasta) e['h_' + i] = 'La hora de fin tiene que ser posterior al inicio.'; });
    this.errores.set(e);
    if (Object.keys(e).length) return;
    this.cargando.set(true);
    this.api.proActualizar({ radio_cobertura_km: this.radio, horarios: hs }).subscribe({
      next: () => { this.cargando.set(false); this.paso.set(5); },
      error: err => { this.cargando.set(false); this.toasts.error(mensajeError(err)); },
    });
  }

  // ---------------------------------------------------------- paso 6
  async finalizar() {
    this.cargando.set(true);
    try {
      if (this.certificados.length) {
        const subidas = this.certificados.map(f => {
          const fd = new FormData();
          fd.append('archivo', f);
          fd.append('nombre', f.name);
          return this.api.subirCertificacion(fd);
        });
        await firstValueFrom(concat(...subidas).pipe(toArray()));
      }
      await firstValueFrom(this.api.proActualizar({ finalizar: true }));
      await firstValueFrom(this.auth.refrescar());
      this.listo.set(true);
    } catch (err) {
      this.toasts.error(mensajeError(err));
    } finally {
      this.cargando.set(false);
    }
  }

  irAlPanel() { this.router.navigateByUrl(this.auth.inicio()); }
}
