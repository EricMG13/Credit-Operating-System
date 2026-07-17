export interface Issuer {
  id: string;
  name: string;
  ticker?: string | null;
  sector?: string | null;
  industry?: string | null;
  sub_sector?: string | null;
  country?: string | null;
  figi?: string | null;
  rating_sp?: string | null;
  rating_moody?: string | null;
  rating_fitch?: string | null;
  sponsor?: string | null;
}
