import { makeRng } from './rng'

const FIRST = [
  'Northbrook', 'Velasco', 'Almenar', 'Duero', 'Sagrera', 'Montalbán', 'Ribera',
  'Castaño', 'Peñalba', 'Hontoria', 'Aránzazu', 'Bellver', 'Corvera', 'Esparza',
  'Frontera', 'Guadaira', 'Íllora', 'Jarama', 'Lastres', 'Miranda',
]
const SECOND = [
  'Foods', 'Industrial', 'Logística', 'Textil', 'Metales', 'Química', 'Agro',
  'Servicios', 'Construcción', 'Distribución', 'Electrónica', 'Papelera',
]
const SUFFIX = ['S.L.', 'S.A.', 'Group', '']

/** Nombre estable y legible para un id. El mismo id da siempre el mismo nombre.
 *  El dataset real solo trae IDs, y un ID crudo en pantalla arruina la demo. */
export function companyName(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const r = makeRng(h)
  const parts = [
    FIRST[Math.floor(r() * FIRST.length)],
    SECOND[Math.floor(r() * SECOND.length)],
    SUFFIX[Math.floor(r() * SUFFIX.length)],
  ]
  return parts.filter(Boolean).join(' ')
}
