import { env } from "../config/env";
import { logger } from "../config/logger";

export type NxcTemplateVariables = Record<string, string>;

export type SendNxcTemplateWithPdfInput = {
  /** Full WhatsApp number with country code, no + (e.g. 919876543210). */
  to: string;
  templateId: string;
  language: string;
  /** Publicly reachable PDF URL or base64 (NXC Postman "Variable With PDF"). */
  file: string;
  fileName: string;
  variables: NxcTemplateVariables;
  /** Optional dynamic URL / quick-reply buttons. */
  buttons?: Record<string, string>;
};

const maskPhone = (to: string): string => {
  const digits = to.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `${digits.slice(0, 2)}******${digits.slice(-4)}`;
};

const messageStatusUrl = (): string => {
  try {
    const u = new URL(env.NXC_API_URL);
    u.pathname = u.pathname.replace(/\/create-message(-json)?\/?$/, "/message-status");
    if (!u.pathname.endsWith("/message-status")) {
      u.pathname = "/api/message-status";
    }
    return u.toString();
  } catch {
    return "https://waba.nxccontrols.in/api/message-status";
  }
};

/** Poll delivery a few times so logs show sent/failed instead of only queue Success. */
const pollNxcMessageStatus = async (
  taskId: string | number,
  templateId: string,
  to: string
): Promise<void> => {
  const delays = [3_000, 8_000, 15_000];
  for (const delay of delays) {
    await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch(messageStatusUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appkey: env.NXC_APP_KEY,
          authkey: env.NXC_AUTH_KEY,
          task_id: taskId,
        }),
      });
      const body = await res.text();
      const parsed = JSON.parse(body) as {
        data?: Array<{ status?: string; error?: string; wa_message_id?: string | null }> | {
          status?: string;
          error?: string;
          wa_message_id?: string | null;
        };
      };
      const row = Array.isArray(parsed.data) ? parsed.data[0] : parsed.data;
      const status = row?.status ?? "unknown";
      if (status === "pending") continue;
      if (status === "failed") {
        logger.error("WhatsApp NXC delivery failed", {
          taskId,
          templateId,
          to: maskPhone(to),
          error: row?.error,
          status,
        });
        return;
      }
      logger.info("WhatsApp NXC delivery status", {
        taskId,
        templateId,
        to: maskPhone(to),
        status,
        waMessageId: row?.wa_message_id,
      });
      return;
    } catch (err) {
      logger.warn("WhatsApp NXC status poll failed", { err, taskId });
    }
  }
};

/**
 * NXC WABA JSON API — Postman "Variable With PDF".
 * POST /create-message-json with template_id, file, file_name, variables.
 */
export const sendNxcTemplateWithPdf = async (
  input: SendNxcTemplateWithPdfInput
): Promise<{ taskId?: string | number } | null> => {
  if (!env.NXC_APP_KEY || !env.NXC_AUTH_KEY) {
    logger.debug("[WhatsApp:nxc] skipped — missing NXC_APP_KEY / NXC_AUTH_KEY", {
      to: maskPhone(input.to),
      templateId: input.templateId,
    });
    return null;
  }

  const to = input.to.replace(/\D/g, "");
  const payload: Record<string, unknown> = {
    appkey: env.NXC_APP_KEY,
    authkey: env.NXC_AUTH_KEY,
    to: [to],
    template_id: input.templateId,
    language: input.language.trim(),
    file: input.file,
    file_name: input.fileName,
  };
  // Only include variables when the approved template body has {{n}} placeholders.
  // Sending extras causes Meta (#132000) param-count mismatch and status=failed.
  if (input.variables && Object.keys(input.variables).length > 0) {
    payload.variables = input.variables;
  }
  if (input.buttons && Object.keys(input.buttons).length > 0) {
    payload.buttons = input.buttons;
  }

  logger.info("WhatsApp NXC template request", {
    to: maskPhone(to),
    templateId: input.templateId,
    language: input.language,
    fileName: input.fileName,
    variableKeys: Object.keys(input.variables ?? {}),
  });

  const res = await fetch(env.NXC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.text();

  if (!res.ok) {
    logger.error("WhatsApp NXC template send failed", {
      to: maskPhone(to),
      templateId: input.templateId,
      status: res.status,
      body,
    });
    throw new Error(`NXC WhatsApp send failed (${res.status})`);
  }

  try {
    const parsed = JSON.parse(body) as {
      success?: boolean;
      message_status?: string;
      data?: { id?: string | number; task_id?: string | number; status_code?: number };
      message?: string;
    };
    const taskId = parsed.data?.task_id ?? parsed.data?.id;
    logger.info("WhatsApp NXC template accepted", {
      to: maskPhone(to),
      templateId: input.templateId,
      taskId,
      bodyPreview: body.slice(0, 300),
    });
    // Queue success ≠ delivery. Poll /message-status in the background when we have a task id.
    if (taskId != null) {
      void pollNxcMessageStatus(taskId, input.templateId, to);
    }
    return { taskId };
  } catch {
    logger.info("WhatsApp NXC template response (non-JSON)", {
      to: maskPhone(to),
      status: res.status,
      body: body.slice(0, 500),
    });
    return {};
  }
};

export type SendNxcTemplateTextInput = {
  /** Full WhatsApp number with country code, no + (e.g. 919876543210). */
  to: string;
  templateId: string;
  language: string;
  variables: NxcTemplateVariables;
};

/**
 * NXC WABA JSON API — plain text template, no document header. Same
 * create-message-json endpoint as sendNxcTemplateWithPdf, just without the
 * file/file_name fields (NXC only expects them when the approved template
 * actually has a document header component).
 */
export const sendNxcTemplateText = async (
  input: SendNxcTemplateTextInput
): Promise<{ taskId?: string | number } | null> => {
  if (!env.NXC_APP_KEY || !env.NXC_AUTH_KEY) {
    logger.debug("[WhatsApp:nxc] skipped — missing NXC_APP_KEY / NXC_AUTH_KEY", {
      to: maskPhone(input.to),
      templateId: input.templateId,
    });
    return null;
  }

  const to = input.to.replace(/\D/g, "");
  const payload: Record<string, unknown> = {
    appkey: env.NXC_APP_KEY,
    authkey: env.NXC_AUTH_KEY,
    to: [to],
    template_id: input.templateId,
    language: input.language.trim(),
  };
  if (input.variables && Object.keys(input.variables).length > 0) {
    payload.variables = input.variables;
  }

  logger.info("WhatsApp NXC text template request", {
    to: maskPhone(to),
    templateId: input.templateId,
    language: input.language,
    variableKeys: Object.keys(input.variables ?? {}),
  });

  const res = await fetch(env.NXC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.text();

  if (!res.ok) {
    logger.error("WhatsApp NXC text template send failed", {
      to: maskPhone(to),
      templateId: input.templateId,
      status: res.status,
      body,
    });
    throw new Error(`NXC WhatsApp send failed (${res.status})`);
  }

  try {
    const parsed = JSON.parse(body) as {
      data?: { id?: string | number; task_id?: string | number };
    };
    const taskId = parsed.data?.task_id ?? parsed.data?.id;
    logger.info("WhatsApp NXC text template accepted", {
      to: maskPhone(to),
      templateId: input.templateId,
      taskId,
      bodyPreview: body.slice(0, 300),
    });
    if (taskId != null) {
      void pollNxcMessageStatus(taskId, input.templateId, to);
    }
    return { taskId };
  } catch {
    logger.info("WhatsApp NXC text template response (non-JSON)", {
      to: maskPhone(to),
      status: res.status,
      body: body.slice(0, 500),
    });
    return {};
  }
};

/** Normalize Indian booking phone / WhatsApp to 91XXXXXXXXXX. */
export const toWhatsAppRecipient = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) {
    const ten = digits.slice(1);
    if (/^[6-9]\d{9}$/.test(ten)) return `91${ten}`;
  }
  if (digits.length >= 10) return digits;
  return null;
};
