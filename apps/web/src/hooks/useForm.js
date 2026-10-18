import { useCallback, useState } from "react";
import { getErrorMessage } from "../lib/api-client.js";
import { fieldErrors } from "../components/ui/FormField.jsx";

/**
 * Controlled form state plus the submit lifecycle shared by every form:
 * validate (Joi `schema` and/or a `validate(values)` returning `{ field: message }`),
 * show inline errors, then run the submit handler while tracking `isSubmitting`
 * and turning a thrown error into `formError` (via `errorMessage(err)` if given).
 *
 * `field(name)` returns the props a FormField needs: name, value, onChange, error.
 */
export default function useForm(initialValues, { schema, validate, errorMessage } = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((event) => {
    const { name, value, files } = event.target;
    setValues((current) => ({ ...current, [name]: files ? files[0] : value }));
  }, []);

  const field = (name) => ({ name, value: values[name], onChange: handleChange, error: errors[name] });

  const handleSubmit = (onValid) => async (event) => {
    event.preventDefault();
    setFormError("");
    const { error, value } = schema ? schema.validate(values, { abortEarly: false }) : { value: values };
    const nextErrors = { ...fieldErrors(error), ...validate?.(values) };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setIsSubmitting(true);
    try {
      await onValid(value);
    } catch (err) {
      setFormError(errorMessage ? errorMessage(err) : getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return { values, handleChange, field, errors, formError, isSubmitting, handleSubmit };
}
