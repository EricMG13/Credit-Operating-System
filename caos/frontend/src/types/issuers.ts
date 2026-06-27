export interface Issuer {
  id: string;
  name: string;
  ticker?: string;
  industry?: string;
  country?: string;
  figi?: string;
  rating_sp?: string | null;
  rating_moody?: string | null;
  rating_fitch?: string | null;
}
