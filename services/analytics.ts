import { GoogleTagArgs } from 'types/analytics';

function gtag(_type: string, _identifyer: string, _args: GoogleTagArgs): void {
  // log.d("gtag -> arguments:", arguments);
  // TODO: should perhaps gather statistics in the future :)
}

export { gtag };
