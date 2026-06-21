import type { PaymentStatus } from '@/types/database.types';
import { CheckCircle2, Clock, HourglassIcon } from 'lucide-react';

const config: Record<
  PaymentStatus,
  { label: string; className: string; icon: typeof Clock }
> = {
  pending: {
    label: 'Devendo',
    className: 'bg-red-50 text-red-700 ring-red-200',
    icon: Clock,
  },
  paid_unconfirmed: {
    label: 'Aguardando confirmação',
    className: 'bg-amber-50 text-amber-700 ring-amber-200',
    icon: HourglassIcon,
  },
  confirmed: {
    label: 'Pago',
    className: 'bg-brand-50 text-brand-700 ring-brand-200',
    icon: CheckCircle2,
  },
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const { label, className, icon: Icon } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
