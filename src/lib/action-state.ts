export type FormState = {
  error?: string;
  fields?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
  duplicates?: { id: string; name: string; address: string }[];
};

export const initialFormState: FormState = {};
