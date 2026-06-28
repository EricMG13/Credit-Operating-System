export interface Issuer {
  id: string;
  name: string;
  ticker?: string;
  sector?: string | null;
  industry?: string;
  sub_sector?: string | null;
  country?: string;
  figi?: string;
  rating_sp?: string | null;
  rating_moody?: string | null;
  rating_fitch?: string | null;
}
