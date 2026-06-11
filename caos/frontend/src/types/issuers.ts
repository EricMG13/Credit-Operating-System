export interface Issuer {
  id: string;
  name: string;
  ticker?: string;
  industry?: string;
  country?: string;
}

export interface Document {
  id: string;
  issuer_id: string;
  doc_type: string;
  file_name: string;
  minio_key: string;
  mnpi_flag: boolean;
  uploaded_at: string;
  fiscal_period?: string;
}
