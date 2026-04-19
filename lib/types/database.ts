export type ProjectStatus =
  | "proposal"
  | "estimate"
  | "ordered"
  | "staffing"
  | "in_progress"
  | "completed"
  | "invoiced";

export type Carrier = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type Agency = {
  id: string;
  carrier_id: string;
  name: string;
  created_at: string;
};

export type Store = {
  id: string;
  agency_id: string;
  name: string;
  address: string | null;
  access_notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  entry_rules: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  store_id: string | null;
  assigned_staff_ids?: string[];
  title: string;
  status: ProjectStatus;
  start_at: string | null;
  end_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Staff = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  base_address: string | null;
  skills: string[];
  notes: string | null;
  created_at: string;
  updated_at?: string;
};

export type StaffNgStore = {
  id: string;
  staff_id: string;
  store_id: string;
  reason: string | null;
  created_at: string;
};

export type ProjectAttachment = {
  id: string;
  project_id: string;
  file_path: string;
  original_name: string | null;
  created_at: string;
};
