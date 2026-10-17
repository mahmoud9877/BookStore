import { useCallback, useState } from "react";

/** Controlled-form state: `handleChange` works for text inputs, selects, textareas and file inputs. */
export default function useForm(initialValues) {
  const [values, setValues] = useState(initialValues);

  const handleChange = useCallback((event) => {
    const { name, value, files } = event.target;
    setValues((current) => ({ ...current, [name]: files ? files[0] : value }));
  }, []);

  return { values, setValues, handleChange };
}
