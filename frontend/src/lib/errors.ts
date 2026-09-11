interface AxiosLikeError {
  response?: { data?: { error?: unknown } };
  request?: unknown;
  message?: string;
}

// A zod .flatten() validation error shape, as returned by several backend routes.
interface FlattenedZodError {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}

const isFlattenedZodError = (value: unknown): value is FlattenedZodError =>
  typeof value === 'object' && value !== null && ('formErrors' in value || 'fieldErrors' in value);

// Extracts a user-facing message from a failed API call, distinguishing:
// - a real error response from the server (validation error, conflict, etc.)
// - the server being unreachable entirely (request made, no response — e.g. backend not running)
// - anything else (falls back to the provided default)
export const getErrorMessage = (err: unknown, fallback: string): string => {
  const axiosErr = err as AxiosLikeError;

  if (axiosErr?.response) {
    const raw = axiosErr.response.data?.error;
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (isFlattenedZodError(raw)) {
      const firstFieldError = raw.fieldErrors ? Object.values(raw.fieldErrors).flat()[0] : undefined;
      return raw.formErrors?.[0] || firstFieldError || fallback;
    }
    return fallback;
  }

  if (axiosErr?.request) {
    return "Serverga ulanib bo'lmadi. Backend ishga tushirilganligini tekshiring.";
  }

  return fallback;
};
