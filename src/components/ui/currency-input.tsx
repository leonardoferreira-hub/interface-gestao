import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
  showPrefix?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  showPrefix = true,
  className,
  ...props
}: CurrencyInputProps) {
  const formatValue = (num: number): string => {
    if (num === 0) return '';
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const [displayValue, setDisplayValue] = React.useState(formatValue(value));

  React.useEffect(() => {
    setDisplayValue(formatValue(value));
  }, [value]);

  const parseValue = (str: string): number => {
    const cleaned = str.replace(/[^\d,]/g, '');
    const normalized = cleaned.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const cleaned = input.replace(/[^\d.,]/g, '');
    setDisplayValue(cleaned);
  };

  const handleBlur = () => {
    const numericValue = parseValue(displayValue);
    onChange(numericValue);
    setDisplayValue(formatValue(numericValue));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div className="relative">
      {showPrefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          R$
        </span>
      )}
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        className={cn(showPrefix && 'pl-10', className)}
      />
    </div>
  );
}
