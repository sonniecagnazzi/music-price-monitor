export type MonitorType = 'CD' | 'LP';
export type MonitorSite = 'Medimops' | 'Momox';
export type LastStatus = 'never_checked' | 'ok' | 'below_target' | 'error';

export interface Monitor {
  id: string;
  type: MonitorType;
  artist: string;
  album: string;
  edition: string | null;
  site: MonitorSite;
  url: string;
  target_price: number;
  current_price: number | null;
  last_checked_at: string | null;
  last_status: LastStatus | null;
  last_error: string | null;
  alert_email: string | null;
  alert_sent: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: number;
  alert_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceCheck {
  monitor_id: string;
  checked_at: string;
  price: number | null;
  status: LastStatus;
  error: string | null;
}

export interface MonitorInput {
  type: MonitorType;
  artist: string;
  album: string;
  edition?: string | null;
  site: MonitorSite;
  url: string;
  target_price: number;
  alert_email?: string | null;
  is_active: boolean;
}
