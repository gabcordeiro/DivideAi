/** Formata um número como moeda brasileira (R$). */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

/** Divide um total entre N pessoas, arredondando para centavos. */
export function splitPerPerson(total: number, people: number): number {
  if (people <= 0) return 0;
  return Math.round((total / people) * 100) / 100;
}
