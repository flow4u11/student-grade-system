"use client";
import {
  Children,
  isValidElement,
  useEffect,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type KeyboardEventHandler,
  type SelectHTMLAttributes,
} from "react";
import * as Primitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useLocale } from "./providers";
import { FieldLabelContext } from "./field-label";

type Choice = { value: string; label: string; disabled?: boolean };
function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? text(child.props.children)
        : String(child),
    )
    .join("");
}
function choices(children: ReactNode): Choice[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string;
        disabled?: boolean;
        children?: ReactNode;
      }>(child)
    )
      return [];
    if (child.type === "option")
      return [
        {
          value: String(child.props.value ?? text(child.props.children)),
          label: text(child.props.children),
          disabled: child.props.disabled,
        },
      ];
    return choices(child.props.children);
  });
}
const emptyValue = "__school_empty_choice__";

/** One themed selector, with a native form bridge for validation and FormData. */
export function Select({
  children,
  value,
  defaultValue,
  className,
  style,
  id,
  onChange,
  onInvalid,
  onKeyDown,
  ref,
  disabled,
  required,
  ...props
}: Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "multiple" | "size" | "onKeyDown"
> & {
  ref?: Ref<HTMLButtonElement>;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
}) {
  const { locale } = useLocale();
  const fieldLabel = useContext(FieldLabelContext);
  const items = choices(children);
  const initialValue = String(defaultValue ?? items[0]?.value ?? "");
  const [localValue, setValue] = useState(initialValue);
  const current = value === undefined ? localValue : String(value);
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [container, setContainer] = useState<HTMLElement | undefined>(
    undefined,
  );
  const bridge = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const form = bridge.current?.form;
    function reset() {
      setValue(initialValue);
      setInvalid(false);
      setOpen(false);
    }
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initialValue]);
  return (
    <span className={`select-control ${className || ""}`} style={style}>
      <Primitive.Root
        value={current || emptyValue}
        disabled={disabled}
        open={open}
        onOpenChange={(next) => {
          if (next && trigger.current?.matches(":disabled")) return;
          setContainer(trigger.current?.closest("dialog") ?? undefined);
          setOpen(next);
        }}
        onValueChange={(picked) => {
          const native = bridge.current;
          if (!native || native.matches(":disabled")) return;
          const next = picked === emptyValue ? "" : picked;
          setValue(next);
          setInvalid(false);
          native.value = next;
          native.dispatchEvent(new Event("change", { bubbles: true }));
        }}
      >
        <Primitive.Trigger
          ref={(element) => {
            trigger.current = element;
            if (typeof ref === "function") return ref(element);
            if (ref) ref.current = element;
          }}
          id={id}
          className="select-trigger"
          aria-label={props["aria-label"]}
          aria-labelledby={
            props["aria-labelledby"] ||
            (!props["aria-label"] ? fieldLabel : undefined)
          }
          aria-describedby={props["aria-describedby"]}
          aria-required={required}
          aria-invalid={invalid || props["aria-invalid"]}
          onKeyDown={onKeyDown}
        >
          <span className="select-value">
            {items.find((item) => item.value === current)?.label || "—"}
          </span>
          <Primitive.Icon className="select-chevron">
            <ChevronDown size={16} />
          </Primitive.Icon>
        </Primitive.Trigger>
        <Primitive.Portal container={container}>
          <Primitive.Content
            className="select-menu"
            position="popper"
            sideOffset={8}
            collisionPadding={12}
          >
            <Primitive.ScrollUpButton className="select-scroll">
              <ChevronUp size={14} />
            </Primitive.ScrollUpButton>
            <Primitive.Viewport className="select-viewport">
              {items.map((item) => (
                <Primitive.Item
                  className="select-option"
                  key={item.value}
                  value={item.value || emptyValue}
                  disabled={item.disabled}
                  textValue={item.label}
                >
                  <Primitive.ItemText>{item.label}</Primitive.ItemText>
                  <Primitive.ItemIndicator className="select-check">
                    <Check size={16} />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              ))}
            </Primitive.Viewport>
            <Primitive.ScrollDownButton className="select-scroll">
              <ChevronDown size={14} />
            </Primitive.ScrollDownButton>
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
      <select
        {...props}
        ref={bridge}
        className="select-form-bridge"
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
        required={required}
        value={current}
        onChange={(event) => onChange?.(event)}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
          onInvalid?.(event);
        }}
      >
        {children}
      </select>
      {invalid && (
        <span role="alert" className="select-error">
          {locale === "th"
            ? "กรุณาเลือกข้อมูลในช่องนี้"
            : "Please choose an option."}
        </span>
      )}
    </span>
  );
}
