import { useEffect, useRef, type ChangeEvent } from 'react';

// Text input for UZS amounts that displays space-separated groups while typing
// (1 000 000) but keeps the underlying value as a plain digit string, so callers
// can keep doing Number(value) exactly like they did with <input type="number">.
const groupDigits = (raw: string): string => (raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '');

const digitsBeforeCaret = (text: string, caret: number): number => text.slice(0, caret).replace(/\D/g, '').length;

const caretForDigitCount = (formatted: string, digitCount: number): number => {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
};

interface AmountInputProps {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
}

export const AmountInput = ({ value, onChange, placeholder, className, required, autoFocus, id }: AmountInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingDigitCount = useRef<number | null>(null);
  const formatted = groupDigits(value);

  useEffect(() => {
    if (pendingDigitCount.current !== null && inputRef.current) {
      const caret = caretForDigitCount(formatted, pendingDigitCount.current);
      inputRef.current.setSelectionRange(caret, caret);
      pendingDigitCount.current = null;
    }
  }, [formatted]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const caret = e.target.selectionStart ?? e.target.value.length;
    pendingDigitCount.current = digitsBeforeCaret(e.target.value, caret);
    onChange(e.target.value.replace(/\D/g, ''));
  };

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      placeholder={placeholder ? groupDigits(placeholder) : undefined}
      value={formatted}
      onChange={handleChange}
      required={required}
      autoFocus={autoFocus}
    />
  );
};

export default AmountInput;
