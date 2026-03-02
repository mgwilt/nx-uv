import * as React from "react";
import { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";

export type FormValue = string | boolean;

export type FormFieldDefinition = {
  key: string;
  label: string;
  type: "text" | "boolean" | "select";
  required?: boolean;
  help?: string;
  options?: string[];
  defaultValue?: FormValue;
  placeholder?: string;
};

export function ActionForm(props: {
  title: string;
  description?: string;
  fields: FormFieldDefinition[];
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (values: Record<string, FormValue>) => void;
}) {
  const {
    title,
    description,
    fields,
    submitLabel = "Preview",
    onCancel,
    onSubmit,
  } = props;

  const initialValues = useMemo(() => {
    const values: Record<string, FormValue> = {};
    for (const field of fields) {
      if (field.defaultValue !== undefined) {
        values[field.key] = field.defaultValue;
      } else if (field.type === "boolean") {
        values[field.key] = false;
      } else if (field.type === "select") {
        values[field.key] = field.options?.[0] ?? "";
      } else {
        values[field.key] = "";
      }
    }

    return values;
  }, [fields]);

  const [values, setValues] =
    useState<Record<string, FormValue>>(initialValues);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const actionStartIndex = fields.length;
  const previewIndex = actionStartIndex;
  const backIndex = actionStartIndex + 1;
  const maxIndex = fields.length + 1;

  useInput(
    (
      input: string,
      key: {
        escape?: boolean;
        return?: boolean;
        backspace?: boolean;
        delete?: boolean;
        ctrl?: boolean;
        meta?: boolean;
        upArrow?: boolean;
        downArrow?: boolean;
        leftArrow?: boolean;
        rightArrow?: boolean;
      },
    ) => {
      if (editingFieldKey) {
        if (key.escape) {
          setEditingFieldKey(null);
          setTextDraft("");
          return;
        }

        if (key.return) {
          const field = fields.find((entry) => entry.key === editingFieldKey);
          if (!field) {
            setEditingFieldKey(null);
            setTextDraft("");
            return;
          }

          setValues((current) => ({
            ...current,
            [field.key]: textDraft,
          }));
          setEditingFieldKey(null);
          setTextDraft("");
          return;
        }

        if (key.backspace || key.delete) {
          setTextDraft((current) =>
            current.slice(0, Math.max(0, current.length - 1)),
          );
          return;
        }

        if (!key.ctrl && !key.meta && input.length > 0) {
          setTextDraft((current) => `${current}${input}`);
        }
        return;
      }

      if (input.toLowerCase() === "q") {
        onCancel();
        return;
      }

      if (key.upArrow) {
        setError(null);
        setSelectedIndex((current) => Math.max(0, current - 1));
        return;
      }

      if (key.downArrow) {
        setError(null);
        setSelectedIndex((current) => Math.min(maxIndex, current + 1));
        return;
      }

      if (key.leftArrow || key.rightArrow) {
        if (selectedIndex >= fields.length) {
          return;
        }

        const field = fields[selectedIndex];
        if (!field || field.type !== "select") {
          return;
        }

        const options = field.options ?? [];
        if (options.length === 0) {
          return;
        }

        const current = String(values[field.key] ?? options[0]);
        const currentIndex = Math.max(options.indexOf(current), 0);
        const direction = key.rightArrow ? 1 : -1;
        const nextIndex =
          (currentIndex + direction + options.length) % options.length;

        setValues((prev) => ({
          ...prev,
          [field.key]: options[nextIndex],
        }));
        return;
      }

      if (!key.return) {
        return;
      }

      setError(null);

      if (selectedIndex === previewIndex) {
        const missing = fields.find((field) => {
          if (!field.required) {
            return false;
          }

          const value = values[field.key];
          return typeof value === "string" && value.trim().length === 0;
        });

        if (missing) {
          setError(`Field "${missing.label}" is required.`);
          return;
        }

        onSubmit(values);
        return;
      }

      if (selectedIndex === backIndex) {
        onCancel();
        return;
      }

      const field = fields[selectedIndex];
      if (!field) {
        return;
      }

      if (field.type === "boolean") {
        setValues((current) => ({
          ...current,
          [field.key]: !(current[field.key] === true),
        }));
        return;
      }

      if (field.type === "select") {
        const options = field.options ?? [];
        if (options.length === 0) {
          return;
        }

        const current = String(values[field.key] ?? options[0]);
        const currentIndex = Math.max(options.indexOf(current), 0);
        const nextIndex = (currentIndex + 1) % options.length;

        setValues((currentValues) => ({
          ...currentValues,
          [field.key]: options[nextIndex],
        }));
        return;
      }

      const current = String(values[field.key] ?? "");
      setTextDraft(current);
      setEditingFieldKey(field.key);
    },
  );

  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      {description ? <Text>{description}</Text> : null}
      <Text>Use arrows to navigate, Enter to edit/toggle, q to go back.</Text>
      <Box marginTop={1} flexDirection="column">
        {fields.map((field, index) => {
          const selected = index === selectedIndex;
          const editing = editingFieldKey === field.key;
          const rawValue = values[field.key];
          const value =
            field.type === "boolean"
              ? rawValue === true
                ? "true"
                : "false"
              : String(rawValue ?? "");

          const display =
            field.type === "text" && value.trim().length === 0
              ? (field.placeholder ?? "")
              : value;

          return (
            <Box key={field.key}>
              <Text color={selected ? "cyan" : undefined}>
                {selected ? "> " : "  "}
                {field.label}: {editing ? textDraft : display}
                {field.required ? " *" : ""}
              </Text>
            </Box>
          );
        })}

        <Text color={selectedIndex === previewIndex ? "cyan" : undefined}>
          {selectedIndex === previewIndex ? "> " : "  "}[{submitLabel}]
        </Text>
        <Text color={selectedIndex === backIndex ? "cyan" : undefined}>
          {selectedIndex === backIndex ? "> " : "  "}
          [Back]
        </Text>
      </Box>
      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
