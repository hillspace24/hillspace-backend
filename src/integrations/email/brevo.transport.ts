const BREVO_API = 'https://api.brevo.com/v3';

export type BrevoSender = {
  name: string;
  email: string;
};

export type BrevoSendOptions = {
  to: string;
  toName?: string;
  subject: string;
  text?: string;
  html?: string;
};

export type BrevoContactInput = {
  email: string;
  attributes?: Record<string, string>;
  listIds?: number[];
};

async function brevoRequest(
  apiKey: string,
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${BREVO_API}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function readError(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const parsed = JSON.parse(body) as { message?: string; code?: string };
    if (parsed.message) {
      return parsed.code ? `${parsed.code}: ${parsed.message}` : parsed.message;
    }
  } catch {
    // use raw body
  }
  return body.slice(0, 500) || res.statusText;
}

/** Confirms the API key is valid (GET /account). */
export async function verifyBrevoAccount(apiKey: string): Promise<void> {
  const res = await brevoRequest(apiKey, '/account', { method: 'GET' });
  if (!res.ok) {
    throw new Error(
      `Brevo account check failed (${res.status}): ${await readError(res)}`,
    );
  }
}

/** Transactional email via Brevo SMTP API (HTTPS, no SMTP ports). */
export async function sendViaBrevo(
  apiKey: string,
  sender: BrevoSender,
  options: BrevoSendOptions,
): Promise<void> {
  const payload: Record<string, unknown> = {
    sender,
    to: [
      {
        email: options.to,
        ...(options.toName ? { name: options.toName } : {}),
      },
    ],
    subject: options.subject,
  };
  if (options.html) {
    payload.htmlContent = options.html;
  }
  if (options.text) {
    payload.textContent = options.text;
  }

  const res = await brevoRequest(apiKey, '/smtp/email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      `Brevo send failed (${res.status}): ${await readError(res)}`,
    );
  }
}

/** Create or update a contact; optionally add to list(s). */
export async function upsertBrevoContact(
  apiKey: string,
  contact: BrevoContactInput,
): Promise<void> {
  const res = await brevoRequest(apiKey, '/contacts', {
    method: 'POST',
    body: JSON.stringify({
      email: contact.email,
      updateEnabled: true,
      ...(contact.attributes && Object.keys(contact.attributes).length
        ? { attributes: contact.attributes }
        : {}),
      ...(contact.listIds?.length ? { listIds: contact.listIds } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Brevo contact upsert failed (${res.status}): ${await readError(res)}`,
    );
  }
}

export function parseSender(
  fromHeader: string | undefined,
  fallbackEmail: string | undefined,
  fallbackName = 'HillSpace',
): BrevoSender | null {
  const combined = fromHeader?.trim();
  if (combined) {
    const match = combined.match(/^(.*?)<([^>]+)>$/);
    if (match) {
      const name = match[1].trim().replace(/^"|"$/g, '') || fallbackName;
      const email = match[2].trim();
      if (email.includes('@')) {
        return { name, email };
      }
    }
    if (combined.includes('@') && !combined.includes('<')) {
      return { name: fallbackName, email: combined };
    }
  }
  const email = fallbackEmail?.trim();
  if (email?.includes('@')) {
    return { name: fallbackName, email };
  }
  return null;
}
