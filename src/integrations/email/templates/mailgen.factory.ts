import Mailgen = require('mailgen');
import { getPublicFrontendBaseUrl } from './email-urls';

/** Public HillSpace logo used when EMAIL_LOGO_URL is not set (e.g. on Render). */
const DEFAULT_EMAIL_LOGO_URL =
  'https://res.cloudinary.com/ar0uptfy/image/upload/f_png,w_240,c_fit,q_auto/hillspace/email-logo.png';

function resolveLogoUrl(): string {
  const raw = process.env.EMAIL_LOGO_URL?.trim() || DEFAULT_EMAIL_LOGO_URL;
  // Force https for email clients
  return raw.replace(/^http:\/\//i, 'https://');
}

/**
 * Returns a fresh Mailgen instance each time so FRONTEND_URL and EMAIL_LOGO_URL
 * are always read from the current process env (set at boot by NestJS ConfigModule).
 */
export function getMailgen(): Mailgen {
  const logoUrl = resolveLogoUrl();
  return new Mailgen({
    theme: 'default',
    product: {
      name: 'HillSpace',
      link: getPublicFrontendBaseUrl(),
      logo: logoUrl,
      // Keep email header compact — large logos get clipped in some clients
      logoHeight: '48px',
      copyright: 'HillSpace - Real Estate Marketplace',
    },
  });
}

/**
 * Shared HTML/text render for every transactional email (waitlist, verify,
 * password reset, login notice, etc.).
 */
export function renderMail(email: Mailgen.Content): {
  html: string;
  text: string;
} {
  const mailgen = getMailgen();
  const logoUrl = resolveLogoUrl();
  const html = applySharedEmailLayout(mailgen.generate(email) as string, logoUrl);

  return {
    html,
    text: mailgen.generatePlaintext(email) as string,
  };
}

/** Center the product logo in the header for all Mailgen emails / clients. */
function applySharedEmailLayout(html: string, logoUrl: string): string {
  const safeLogoUrl = logoUrl.replace(/"/g, '%22');
  const logoImg =
    `<img src="${safeLogoUrl}" alt="HillSpace" width="120" height="48" ` +
    `style="display:inline-block;margin:0 auto;width:120px;max-width:120px;height:48px;border:0;outline:none;text-decoration:none;" />`;

  return html.replace(
    /<td class="email-masthead"([^>]*)>([\s\S]*?)<\/td>/i,
    (_match, tdAttrs: string, inner: string) => {
      let attrs = tdAttrs;
      if (/\balign=/i.test(attrs)) {
        attrs = attrs.replace(/\balign="[^"]*"/i, 'align="center"');
      } else {
        attrs += ' align="center"';
      }
      if (/\bstyle="/i.test(attrs)) {
        attrs = attrs.replace(/\bstyle="/i, 'style="text-align:center;');
      } else {
        attrs += ' style="text-align:center;"';
      }

      let body = inner.replace(/<img\b[^>]*>/i, logoImg);
      body = body.replace(
        /(<a class="email-masthead_name"[^>]*style=")([^"]*)(")/i,
        '$1$2display:block;text-align:center;$3',
      );

      return (
        `<td class="email-masthead"${attrs}>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
        `<tr><td align="center" style="text-align:center;">${body}</td></tr>` +
        `</table></td>`
      );
    },
  );
}
