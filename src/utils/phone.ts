const INDIA_PHONE_REGEX = /^[6-9]\d{9}$/;

export const isValidIndianPhone = (phone: string): boolean => INDIA_PHONE_REGEX.test(phone);

export const normalizePhone = (phone: string): string => {
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.length === 12 && digitsOnly.startsWith("91")
    ? digitsOnly.slice(2)
    : digitsOnly.slice(-10);
};

export const toE164 = (phone: string): string => `+91${normalizePhone(phone)}`;
