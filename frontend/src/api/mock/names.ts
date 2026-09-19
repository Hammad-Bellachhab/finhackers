import { pick, weightedPick, type Rng } from './random'

export const SECTORS = [
  'Ferretería y suministros',
  'Talleres y mecanizado',
  'Distribución alimentaria',
  'Consultoría y servicios',
  'Transporte y logística',
  'Construcción y reformas',
  'Textil y confección',
  'Hostelería y restauración',
  'Agroalimentario',
  'Instalaciones y energía',
  'Salud y laboratorios',
] as const

export type Sector = (typeof SECTORS)[number]

const SURNAMES_ES = [
  'García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz',
  'Hernández', 'Díaz', 'Moreno', 'Álvarez', 'Muñoz', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro', 'Torres',
  'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina', 'Morales', 'Suárez',
  'Ortega', 'Delgado', 'Castro', 'Ortiz', 'Rubio', 'Marín', 'Sanz', 'Iglesias', 'Medina', 'Garrido',
  'Cortés', 'Castillo', 'Santos', 'Lozano', 'Guerrero', 'Cano', 'Prieto', 'Méndez', 'Cruz', 'Calvo',
  'Gallego', 'Vidal', 'León', 'Márquez', 'Herrera', 'Peña', 'Flores', 'Cabrera', 'Campos', 'Vega',
  'Fuentes', 'Carrasco', 'Diez', 'Caballero', 'Reyes', 'Nieto', 'Aguilar', 'Pascual', 'Santana', 'Herrero',
  'Montero', 'Lorenzo', 'Hidalgo', 'Giménez', 'Ibáñez', 'Ferrer', 'Durán', 'Santiago', 'Benítez', 'Mora',
  'Vicente', 'Vargas', 'Arias', 'Carmona', 'Crespo', 'Román', 'Pastor', 'Soto', 'Sáez', 'Velasco',
  'Moya', 'Soler', 'Parra', 'Esteban', 'Bravo', 'Gallardo', 'Rojas', 'Pardo', 'Merino', 'Franco',
  'Aguirre', 'Etxeberria', 'Goikoetxea', 'Puig', 'Roca', 'Ferrando', 'Castellano', 'Barrios', 'Zamora', 'Lara',
] as const

const SURNAMES_PT = ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Sousa', 'Fernandes'] as const
const SURNAMES_FR = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau'] as const
const SURNAMES_IT = ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco'] as const

const PLACES = [
  'del Ebro', 'del Levante', 'Ibérica', 'Mediterránea', 'Castellana', 'Manchega', 'Gallega', 'Cantábrica',
  'Andaluza', 'Extremeña', 'Aragonesa', 'Navarra', 'Riojana', 'Valenciana', 'Murciana', 'Asturiana',
  'del Tajo', 'del Duero', 'del Guadalquivir', 'del Segura', 'de Levante', 'de Castilla', 'del Norte',
  'del Sur', 'Peninsular', 'del Cantábrico', 'de la Ribera', 'del Bajo Aragón', 'de la Costa', 'del Maresme',
  'del Vallés', 'de la Rioja', 'de Poniente', 'de Ponent', 'del Penedès', 'de la Mancha', 'de Osuna',
  'de Getafe', 'de Alcalá', 'de Sagunto', 'de Elche', 'de Vigo', 'de Zaragoza', 'de Bilbao', 'de Málaga',
  'de Sevilla', 'de Valladolid', 'de Tarragona', 'de Girona', 'de Albacete',
] as const

type NamePattern = (surname: string, surname2: string, place: string) => string

const PATTERNS: Record<Sector, readonly NamePattern[]> = {
  'Ferretería y suministros': [
    (s) => `Ferretería ${s}`,
    (s) => `Suministros ${s} e Hijos`,
    (_s, _t, p) => `Ferrosur ${p}`,
    (s) => `Herramientas ${s}`,
    (_s, _t, p) => `Suministros Industriales ${p}`,
  ],
  'Talleres y mecanizado': [
    (s) => `Talleres ${s}`,
    (_s, _t, p) => `Mecanizados ${p}`,
    (s) => `Metalúrgica ${s}`,
    (s, t) => `Talleres ${s} y ${t}`,
    (_s, _t, p) => `Calderería ${p}`,
  ],
  'Distribución alimentaria': [
    (s) => `Distribuciones ${s}`,
    (_s, _t, p) => `Alimentaria ${p}`,
    (s) => `Frutas y Verduras ${s}`,
    (_s, _t, p) => `Distribuidora ${p}`,
    (s) => `Cárnicas ${s}`,
  ],
  'Consultoría y servicios': [
    (s, t) => `${s} & ${t} Consultores`,
    (_s, _t, p) => `Consultora ${p}`,
    (s) => `Asesoría ${s}`,
    (s) => `Gestión Empresarial ${s}`,
    (_s, _t, p) => `Servicios Profesionales ${p}`,
  ],
  'Transporte y logística': [
    (s) => `Transportes ${s}`,
    (_s, _t, p) => `Logística ${p}`,
    (s) => `Trans ${s} Hermanos`,
    (_s, _t, p) => `Paquetería ${p}`,
    (s) => `Almacenajes ${s}`,
  ],
  'Construcción y reformas': [
    (s) => `Construcciones ${s}`,
    (_s, _t, p) => `Reformas ${p}`,
    (s) => `Obras y Proyectos ${s}`,
    (_s, _t, p) => `Cerámicas ${p}`,
    (s) => `Excavaciones ${s}`,
  ],
  'Textil y confección': [
    (s) => `Confecciones ${s}`,
    (_s, _t, p) => `Textil ${p}`,
    (s) => `Tejidos ${s}`,
    (s) => `Moda ${s}`,
    (_s, _t, p) => `Calzados ${p}`,
  ],
  'Hostelería y restauración': [
    (s) => `Restauración ${s}`,
    (_s, _t, p) => `Hostelera ${p}`,
    (s) => `Catering ${s}`,
    (s) => `Hotel ${s}`,
    (_s, _t, p) => `Panadería y Pastelería ${p}`,
  ],
  Agroalimentario: [
    (_s, _t, p) => `Cooperativa Agrícola ${p}`,
    (s) => `Aceites ${s}`,
    (_s, _t, p) => `Conservas ${p}`,
    (s) => `Bodegas ${s}`,
    (s) => `Hortofrutícola ${s}`,
  ],
  'Instalaciones y energía': [
    (s) => `Instalaciones ${s}`,
    (_s, _t, p) => `Electricidad ${p}`,
    (s) => `Fontanería y Calefacción ${s}`,
    (_s, _t, p) => `Energías ${p}`,
    (s) => `Climatización ${s}`,
  ],
  'Salud y laboratorios': [
    (_s, _t, p) => `Clínica ${p}`,
    (s) => `Laboratorios ${s}`,
    (s) => `Ortopedia ${s}`,
    (_s, _t, p) => `Centro Dental ${p}`,
    (s) => `Farmacia ${s}`,
  ],
}

export type Country = 'ES' | 'PT' | 'FR' | 'IT'

export const COUNTRY_WEIGHTS: readonly (readonly [Country, number])[] = [
  ['ES', 0.86],
  ['PT', 0.07],
  ['FR', 0.04],
  ['IT', 0.03],
]

const SUFFIXES: Record<Country, readonly (readonly [string, number])[]> = {
  ES: [['S.L.', 0.7], ['S.A.', 0.2], ['S.L.U.', 0.1]],
  PT: [['Lda.', 0.8], ['S.A.', 0.2]],
  FR: [['SARL', 0.7], ['SAS', 0.3]],
  IT: [['S.r.l.', 0.8], ['S.p.A.', 0.2]],
}

function surnamesFor(country: Country): readonly string[] {
  switch (country) {
    case 'PT':
      return SURNAMES_PT
    case 'FR':
      return SURNAMES_FR
    case 'IT':
      return SURNAMES_IT
    default:
      return SURNAMES_ES
  }
}

export function makeCompanyName(rng: Rng, sector: Sector, country: Country, taken: Set<string>): string {
  const surnames = surnamesFor(country)
  for (let attempt = 0; attempt < 40; attempt++) {
    const pattern = pick(rng, PATTERNS[sector])
    const name = `${pattern(pick(rng, surnames), pick(rng, surnames), pick(rng, PLACES))} ${weightedPick(rng, SUFFIXES[country])}`
    if (!taken.has(name)) {
      taken.add(name)
      return name
    }
  }
  // Colisión repetida: se desambigua con un ordinal en vez de reintentar sin fin.
  const fallback = `${pick(rng, PATTERNS[sector])(pick(rng, surnames), pick(rng, surnames), pick(rng, PLACES))} ${taken.size} S.L.`
  taken.add(fallback)
  return fallback
}

export function makeGroupName(rng: Rng, taken: Set<string>): string {
  const templates: readonly ((s: string, p: string) => string)[] = [
    (s) => `Grupo ${s}`,
    (s) => `${s} Holding`,
    (_s, p) => `Holding ${p}`,
    (s, p) => `Grupo ${s} ${p}`,
    (s) => `Corporación ${s}`,
    (_s, p) => `Grupo Empresarial ${p}`,
  ]
  for (let attempt = 0; attempt < 40; attempt++) {
    const name = pick(rng, templates)(pick(rng, SURNAMES_ES), pick(rng, PLACES))
    if (!taken.has(name)) {
      taken.add(name)
      return name
    }
  }
  const fallback = `Grupo Empresarial ${taken.size}`
  taken.add(fallback)
  return fallback
}
