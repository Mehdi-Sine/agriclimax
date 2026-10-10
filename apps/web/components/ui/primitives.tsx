"use client";

import {
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type ButtonHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "quiet" }) {
  return (
    <button
      type="button"
      className={`button button-${variant} ${className}`}
      {...props}
    />
  );
}
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Button aria-label={label} title={label} className="icon-button" {...props}>
      {children}
    </Button>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} {...props}>
        {children}
      </select>
    </div>
  );
}
/** Native datalist keeps text entry and keyboard selection without a custom ARIA widget. */
export function Combobox({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        list={`${id}-list`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={`${id}-list`}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}
export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`badge ${className}`}>{children}</span>;
}
export function Callout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="callout">
      <strong>{title}</strong>
      <div>{children}</div>
    </aside>
  );
}
export function Skeleton() {
  return <span className="skeleton" aria-hidden="true" />;
}
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  return (
    <span
      className="tooltip-wrap"
      tabIndex={0}
      aria-describedby={id}
      onMouseEnter={() => setDismissed(false)}
      onFocus={() => setDismissed(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setDismissed(true);
      }}
    >
      {children}
      <span
        role="tooltip"
        id={id}
        className={`tooltip ${dismissed ? "tooltip-dismissed" : ""}`}
      >
        {label}
      </span>
    </span>
  );
}
export function Tabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  // A labelled group of toggle buttons: no tabpanel semantics promised to callers.
  return (
    <div className="tabs" role="group" aria-label={label}>
      {options.map((option) => (
        <Button
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
/** Native modal makes the background inert; explicit Tab wrapping keeps focus inside. */
export function Dialog({
  title,
  trigger,
  children,
  kind = "dialog",
}: {
  title: string;
  trigger: string;
  children: ReactNode;
  kind?: "dialog" | "sheet" | "drawer";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const id = useId();
  return (
    <>
      <Button ref={opener} onClick={() => ref.current?.showModal()}>
        {trigger}
      </Button>
      <dialog
        ref={ref}
        className={`overlay overlay-${kind}`}
        aria-labelledby={id}
        onClose={() => opener.current?.focus()}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
          )).filter((node) => node.getClientRects().length > 0 && node.tabIndex >= 0);
          const first = controls[0], last = controls[controls.length - 1];
          if (!first) { event.preventDefault(); return; }
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) ref.current?.close();
        }}
      >
        <div className="overlay-content">
          <header>
            <h2 id={id}>{title}</h2>
            <IconButton label="Fermer" onClick={() => ref.current?.close()}>
              ×
            </IconButton>
          </header>
          {children}
        </div>
      </dialog>
    </>
  );
}
export function Sheet(props: Omit<Parameters<typeof Dialog>[0], "kind">) {
  return <Dialog {...props} kind="sheet" />;
}
export function Drawer(props: Omit<Parameters<typeof Dialog>[0], "kind">) {
  return <Dialog {...props} kind="drawer" />;
}
