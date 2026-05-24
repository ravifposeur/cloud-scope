/**
 * InputField — Reusable form input component with validation support.
 *
 * Features:
 * - Label with focus highlight
 * - Error message display with icon
 * - Password visibility toggle
 * - Accessible ARIA attributes
 *
 * Styled with Tailwind CSS v4 utility classes.
 *
 * @module components/InputField
 */

import { useState } from 'react';

/**
 * SVG icon: Eye (show password)
 * @returns {JSX.Element}
 */
function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * SVG icon: EyeOff (hide password)
 * @returns {JSX.Element}
 */
function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/**
 * SVG icon: AlertCircle (error indicator)
 * @returns {JSX.Element}
 */
function AlertCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/**
 * InputField component.
 *
 * @param {object} props
 * @param {string} props.id - Unique input ID
 * @param {string} props.label - Label text
 * @param {string} [props.type='text'] - Input type
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} props.value - Controlled input value
 * @param {function} props.onChange - Change handler
 * @param {function} [props.onBlur] - Blur handler
 * @param {string} [props.error] - Error message
 * @param {boolean} [props.required=false] - Required field
 * @param {string} [props.autoComplete] - Autocomplete attribute
 * @returns {JSX.Element}
 */
export default function InputField({
  id,
  label,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  onBlur,
  error,
  required = false,
  autoComplete,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className="mb-5 group">
      {/* Label */}
      <label
        htmlFor={id}
        className="block text-sm font-medium text-txt-secondary mb-1.5
          transition-colors duration-150 group-focus-within:text-primary"
      >
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>

      {/* Input wrapper */}
      <div className="relative flex items-center">
        <input
          id={id}
          type={inputType}
          className={`
            w-full py-2.5 px-3.5 font-sans text-sm text-txt
            bg-input-bg border rounded-lg outline-none
            transition-all duration-150
            placeholder:text-txt-muted
            hover:border-white/20 hover:bg-input-focus
            focus:border-primary focus:bg-input-focus focus:ring-2 focus:ring-primary-light
            ${isPassword ? 'pr-11' : ''}
            ${error ? 'border-danger focus:ring-danger-light' : 'border-border-input'}
          `}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />

        {/* Password toggle */}
        {isPassword && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2
              bg-transparent border-none text-txt-muted cursor-pointer
              p-1 flex items-center justify-center rounded-md
              transition-all duration-150
              hover:text-txt-secondary hover:bg-white/5"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          className="flex items-center gap-1.5 mt-1.5 text-xs text-danger animate-[shake_0.3s_ease-in-out]"
          id={`${id}-error`}
          role="alert"
        >
          <AlertCircleIcon />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
