import { useRef } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';

function toThai(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!d || !m || !y) return iso;
  return `${d}/${m}/${+y + 543}`;
}

interface Props {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  style?: CSSProperties;
  required?: boolean;
  disabled?: boolean;
}

export default function DateInput({ value, onChange, className = 'input', style, required, disabled }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ position: 'relative', display: 'inline-block', width: style?.width ?? '100%' }}>
      <input
        readOnly
        className={className}
        style={{ ...style, width: '100%', cursor: disabled ? 'default' : 'pointer' }}
        value={toThai(value)}
        placeholder="วว/ดด/ปปปป"
        onClick={() => { if (!disabled) ref.current?.showPicker?.(); }}
        disabled={disabled}
      />
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 1 }}
      />
    </div>
  );
}
