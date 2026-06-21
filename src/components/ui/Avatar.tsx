interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number; // px
  className?: string;
}

/** Cor de fundo estável derivada do nome (para o fallback de iniciais). */
function colorFromName(name: string): string {
  const palette = [
    'bg-rose-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-sky-500',
    'bg-indigo-500',
    'bg-fuchsia-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, url, size = 40, className = '' }: AvatarProps) {
  const dimension = { width: size, height: size };

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={dimension}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={{ ...dimension, fontSize: size * 0.4 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorFromName(
        name,
      )} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
