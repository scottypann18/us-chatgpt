export type ClassValue = string | number | null | undefined | false

export const cn = (...classes: ClassValue[]) =>
  classes
    .flatMap(value => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .join(' ')