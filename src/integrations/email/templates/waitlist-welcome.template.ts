import { renderMail } from './mailgen.factory';
import { getPublicFrontendBaseUrl } from './email-urls';

export type WaitlistWelcomeParams = {
  fullName: string;
  city: string;
  persona: string;
};

export function buildWaitlistWelcomeEmail(params: WaitlistWelcomeParams) {
  const site = getPublicFrontendBaseUrl();
  const persona = params.persona.replace(/_/g, ' ');

  const email = {
    body: {
      name: params.fullName,
      intro: [
        'You are on the HillSpace waitlist. Welcome aboard.',
        `We have you down as a ${persona} in ${params.city}.`,
        'We will email you as soon as HillSpace opens in your area.',
      ],
      action: {
        instructions: 'Meanwhile, you can follow along on the website:',
        button: {
          color: '#2563eb',
          text: 'Visit HillSpace',
          link: site,
        },
      },
      outro: 'If you did not join this waitlist, you can ignore this email.',
    },
  };

  return {
    subject: 'HillSpace - You are on the waitlist',
    ...renderMail(email),
  };
}
